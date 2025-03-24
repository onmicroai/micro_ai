"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Register from '@/components/Register';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { registrationPasswordSchema } from '@/utils/passwordValidation';
import { z } from 'zod';

// Create a wrapper component that uses searchParams
function RegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, isAuthenticated } = useAuth();
  const [error, setError] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const nextPath = searchParams.get('next');
      router.push(nextPath || '/dashboard');
    }
  }, [isAuthenticated, router, searchParams]);

  const handleSubmit = async (data: { email: string; password1: string; password2: string }) => {
    try {
      setError('');
      setIsLoading(true);
      
      // Validate with Zod schema
      try {
        registrationPasswordSchema.parse({
          password1: data.password1,
          password2: data.password2
        });
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          setError(validationError.errors[0].message);
          setIsLoading(false);
          return;
        }
      }
      
      await register(data.email, data.password1);
      setIsRegistered(true);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  // If already authenticated, don't show anything while redirecting
  if (isAuthenticated) {
    return null;
  }

  if (isRegistered) {
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
              We&apos;ve sent you an email with a confirmation link. Please click the link to activate your account.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Didn&apos;t receive the email? Check your spam folder or{' '}
              <button 
                onClick={() => setIsRegistered(false)} 
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
      <Register onSubmit={handleSubmit} error={error} isLoading={isLoading} />
    </div>
  );
}

// Main page component with Suspense boundary
export default function RegistrationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegistrationContent />
    </Suspense>
  );
} 