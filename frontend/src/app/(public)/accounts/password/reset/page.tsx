"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import PasswordReset from '@/components/PasswordReset';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function PasswordResetPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = async (data: { email: string }) => {
    try {
      setError('');
      setIsLoading(true);
      
      // Create a new axios instance without auth headers
      const response = await fetch('/api/auth/password/reset/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: data.email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to send password reset email');
      }

      setIsEmailSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <div className="w-48 h-48 mx-auto mb-8">
              <DotLottieReact
                src="/img/email_animated.json"
                loop
                autoplay
              />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Check your email</h2>
            <p className="mt-2 text-sm text-gray-600">
              We&apos;ve sent you an email with instructions to reset your password.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Didn&apos;t receive the email? Check your spam folder or{' '}
              <button 
                onClick={() => setIsEmailSent(false)} 
                className="text-primary-600 hover:text-primary-500 font-semibold"
              >
                try again
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <PasswordReset onSubmit={handleSubmit} error={error} isLoading={isLoading} />
    </div>
  );
} 