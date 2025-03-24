'use client';

import { useEffect, useState } from 'react';
import axiosInstance from '@/utils/axiosInstance';
import { toast } from 'react-toastify';

interface BillingUpdatePollingProps {
  type: 'subscription' | 'credits';
  expectedPlan?: string;
  expectedCredits?: number;
  open: boolean;
  onClose: () => void;
}

export default function BillingUpdatePolling({
  type,
  expectedPlan,
  expectedCredits,
  open,
  onClose,
}: BillingUpdatePollingProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    let count = 0;
    const maxAttempts = 30;
    const controller = new AbortController();

    if (type === 'subscription') {
      if (!expectedPlan) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const intervalId = setInterval(async () => {
        try {
          const response = await axiosInstance().get('/api/auth/user/', {
            signal: controller.signal,
          });
          const userPlan = response.data.plan;
          if (userPlan && userPlan === expectedPlan) {
            clearInterval(intervalId);
            setIsLoading(false);
            localStorage.removeItem('expectedPlan');
            onClose();
            return;
          }
        } catch (error: any) {
          console.error('Error fetching user subscription:', error);
        }

        count++;
        if (count >= maxAttempts) {
          clearInterval(intervalId);
          setIsLoading(false);
          toast.error('Unable to fetch updated subscription data.');
          onClose();
        }
      }, 3000);

      return () => {
        clearInterval(intervalId);
        controller.abort();
      };
    } else if (type === 'credits') {
      if (expectedCredits === undefined) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const intervalId = setInterval(async () => {
        try {
          const response = await axiosInstance().get('/api/microapps/user/billing', {
            signal: controller.signal,
          });
          const billingDetails = response.data.billing_details;
          const creditsRemaining = billingDetails?.[0]?.credits_remaining || 0;
          const topUpCredits = response.data.top_up_credits || 0;
          const totalCredits = creditsRemaining + topUpCredits;

          if (totalCredits >= expectedCredits) {
            clearInterval(intervalId);
            setIsLoading(false);
            localStorage.removeItem('expectedCredits');
            onClose();
            return;
          }
        } catch (error: any) {
          console.error('Error fetching billing details:', error);
        }

        count++;
        if (count >= maxAttempts) {
          clearInterval(intervalId);
          setIsLoading(false);
          toast.error('Unable to fetch updated credits data.');
          onClose();
        }
      }, 3000);

      return () => {
        clearInterval(intervalId);
        controller.abort();
      };
    }
  }, [open, type, expectedPlan, expectedCredits, onClose]);

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-80">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-t-gray-400 border-gray-300 rounded-full animate-spin"></div>
            <p className="mt-4 text-lg font-medium">Processing...</p>
          </div>
        </div>
      )}
    </>
  );
}
