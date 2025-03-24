"use client";

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { passwordResetSchema } from '@/utils/passwordValidation';
import { z } from 'zod';

interface FormData {
  new_password1: string;
  new_password2: string;
}

export default function PasswordResetConfirmPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    new_password1: '',
    new_password2: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    router.push('/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validate with Zod schema
    try {
      passwordResetSchema.parse(formData);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        setError(validationError.errors[0].message);
        setIsLoading(false);
        return;
      }
    }

    try {
      // Decode the UID from base64
      const decodedUid = decodeURIComponent(params.uid as string);
      const base64Decoded = Buffer.from(decodedUid, 'base64').toString('utf-8');
      
      const response = await fetch(`/api/auth/password/reset/confirm/${params.uid}/${params.token}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_password1: formData.new_password1,
          new_password2: formData.new_password2,
          uid: base64Decoded,
          token: params.token
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.uid || errorData.token) {
          throw new Error('Invalid or expired password reset link. Please request a new one.');
        }
        throw new Error(errorData.detail || 'Failed to reset password');
      }

      setIsSuccess(true);
      // Redirect to login page after 3 seconds
      setTimeout(() => {
        router.push('/accounts/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <div className="w-48 h-48 mx-auto mb-8">
              <DotLottieReact
                src="/img/success_animated.json"
                loop
                autoplay
              />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Password Reset Successful</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your password has been successfully reset.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Redirecting to login page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Reset Your Password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Please enter your new password below.
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="new_password1" className="block text-sm font-medium leading-6 text-gray-900">
              New Password
            </label>
            <div className="mt-2">
              <input
                id="new_password1"
                name="new_password1"
                type="password"
                required
                value={formData.new_password1}
                onChange={(e) => setFormData({ ...formData, new_password1: e.target.value })}
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="new_password2" className="block text-sm font-medium leading-6 text-gray-900">
              Confirm New Password
            </label>
            <div className="mt-2">
              <input
                id="new_password2"
                name="new_password2"
                type="password"
                required
                value={formData.new_password2}
                onChange={(e) => setFormData({ ...formData, new_password2: e.target.value })}
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
              />
            </div>
          </div>

          {formData.new_password1 && (
            <div className="rounded-md bg-gray-50 p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Password Requirements:</h4>
              <ul className="space-y-1">
                {['At least 8 characters', 'One uppercase letter', 'One lowercase letter', 'One number', 'One special character'].map((req, index) => (
                  <li key={index} className="flex items-center text-sm">
                    <span className={`mr-2 ${
                      (index === 0 && formData.new_password1.length >= 8) ||
                      (index === 1 && /[A-Z]/.test(formData.new_password1)) ||
                      (index === 2 && /[a-z]/.test(formData.new_password1)) ||
                      (index === 3 && /\d/.test(formData.new_password1)) ||
                      (index === 4 && /[!@#$%^&*]/.test(formData.new_password1))
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`}>
                      {(index === 0 && formData.new_password1.length >= 8) ||
                      (index === 1 && /[A-Z]/.test(formData.new_password1)) ||
                      (index === 2 && /[a-z]/.test(formData.new_password1)) ||
                      (index === 3 && /\d/.test(formData.new_password1)) ||
                      (index === 4 && /[!@#$%^&*]/.test(formData.new_password1))
                        ? '✓'
                        : '×'}
                    </span>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Password reset error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full justify-center rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </div>
        </form>

        <p className="mt-10 text-center text-sm text-gray-500">
          Remember your password?{' '}
          <a href="/accounts/login" className="font-semibold leading-6 text-primary-600 hover:text-primary-500">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
} 