"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { toast } from "react-toastify";
import BillingUpdatePolling from "./billing-update-polling";
import { useRouter } from "next/navigation";
import { PricingCards } from "@/components/PricingCards";

interface Subscription {
  id: string;
  price_id: string;
  status: string;
  period_start: number;
  period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  customer_id: number;
  current_period_end?: number;
}

interface BillingDetails {
  credits_allocated: number;
  credits_used: number;
  credits_remaining: number;
  start_date: string;
  end_date: string;
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingDetails, setBillingDetails] = useState<BillingDetails | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [topUpCredits, setTopUpCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>("Free");
  const [isPollingOpen, setIsPollingOpen] = useState<boolean>(false);
  const [pollingType, setPollingType] = useState<
    "subscription" | "credits" | null
  >(null);
  const api = axiosInstance();
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("updated") === "success") {
      const storedExpectedCredits = localStorage.getItem("expectedCredits");
      const storedExpectedPlan = localStorage.getItem("expectedPlan");
      if (storedExpectedCredits) {
        setPollingType("credits");
        setIsPollingOpen(true);
      } else if (storedExpectedPlan) {
        setPollingType("subscription");
        setIsPollingOpen(true);
      }
    }
  }, []);

  const fetchCredits = async () => {
    try {
      const response = await api.get(`/api/microapps/user/billing`);
      const currentBillingCycle = response.data.billing_details[0];
      setBillingDetails(currentBillingCycle);
      setTopUpCredits(response.data.top_up_credits || 0);
    } catch (error: any) {
      console.error('Error fetching credits:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes] = await Promise.all([
          api.get("/api/auth/user/"),
          fetchCredits()
        ]);
        const userData = userRes.data;
        setUserData(userData);
        setSubscription(userData.subscription);
        if (userData.plan) {
          setSelectedPlan(userData.plan);
        }
      } catch (error: any) {
        toast.error("Failed to load subscription data: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [api]);

  const handleManageSubscription = async () => {
    try {
      const response = await api.post("/api/subscriptions/portal-session/");
      window.location.href = response.data.url;
    } catch (error: any) {
      toast.error("Failed to open billing portal: " + error.message);
    }
  };

  const handleContinue = async () => {
    try {
      if (
        selectedPlan !== "Free" &&
        (!subscription?.customer_id ||
          subscription?.status === "canceled" ||
          subscription?.status === "incomplete_expired")
      ) {
        const response = await api.post(
          "/api/subscriptions/checkout-session/",
          {
            plan: selectedPlan,
            successUrl: `${window.location.origin}/settings/subscription?updated=success`,
            cancelUrl: `${window.location.origin}/settings/subscription?updated=failure`,
          }
        );
        window.location.href = response.data.url;
        localStorage.setItem("expectedPlan", selectedPlan);
      } else {
        const response = await api.post(
          "/api/subscriptions/update-subscription/",
          {
            plan: selectedPlan,
          }
        );

        if (response.data.url) {
          window.location.href = response.data.url;
        } else if (
          response.data.detail &&
          response.data.detail.includes("Downgrade scheduled")
        ) {
          toast.success("Downgrade scheduled at period end.");
        } else {
          toast.success(
            "Subscription update initiated. Please wait while we update your subscription."
          );
        }
      }
    } catch (error: any) {
      toast.error("Failed to update subscription: " + error.message);
    }
  };


  const handlePollingClose = () => {
    setIsPollingOpen(false);
    window.history.replaceState(null, "", window.location.pathname);
    localStorage.removeItem("expectedPlan");
    localStorage.removeItem("expectedCredits");
    router.refresh();
  };

  const handleCancelDowngrade = async () => {
    try {
      await api.post("/api/subscriptions/cancel-downgrade/");
      toast.success("Downgrade cancelled successfully.");
      const userRes = await api.get("/api/auth/user/");
      setSubscription(userRes.data.subscription || userRes.data);
    } catch (error: any) {
      toast.error("Failed to cancel downgrade: " + error.message);
    }
  };

  return (
    <>
      {isPollingOpen && pollingType === "subscription" && (
        <BillingUpdatePolling
          type="subscription"
          open={isPollingOpen}
          onClose={handlePollingClose}
          expectedPlan={selectedPlan}
        />
      )}
      {isPollingOpen && pollingType === "credits" && (
        <BillingUpdatePolling
          type="credits"
          open={isPollingOpen}
          onClose={handlePollingClose}
          expectedCredits={200000}
        />
      )}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold">My Subscription</h1>
          </div>

          {/* Raw Subscription Details Display */}
          {userData && (
            <div className="mt-6">
              
              {billingDetails && (
                <div className="mb-6 space-y-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Plan:</span> {selectedPlan}
                    </p>
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Credits Usage</span>
                      <span>{billingDetails.credits_used.toLocaleString()} / {billingDetails.credits_allocated.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{ 
                          width: `${Math.min((billingDetails.credits_used / billingDetails.credits_allocated) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Plan Credits Remaining:</span> {billingDetails.credits_remaining.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Top-up Credits:</span> {topUpCredits.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Total Credits Available:</span> {(billingDetails.credits_remaining + topUpCredits).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Billing Period:</span> {new Date(billingDetails.start_date).toLocaleDateString()} - {new Date(billingDetails.end_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">
                        {userData.subscription?.cancel_at_period_end ? "Plan Expires on:" : "Next Renewal Date:"}
                      </span>{" "}
                      {new Date(billingDetails.end_date).toLocaleDateString()}
                      {userData.subscription?.cancel_at_period_end && (
                        <span className="text-red-500 ml-2">
                          (You will not be rebilled)
                        </span>
                      )}
                      {userData.subscription?.cancel_at_period_end && (
                        <button
                          onClick={handleCancelDowngrade}
                          className="px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white"
                        >
                          Cancel Downgrade
                        </button>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Replace the old plan selection with PricingCards */}
          <PricingCards 
            showTopUp={false} 
            currentPlan={selectedPlan} 
            onPlanSelect={async (plan) => {
              setSelectedPlan(plan);
              await handleContinue();
            }}
          />

          <div className="mt-8">
            <button
              onClick={handleManageSubscription}
              className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50"
              disabled={!subscription?.customer_id}
            >
              Manage my Payment Method
            </button>
          </div>
        </div>
      )}
    </>
  );
}
