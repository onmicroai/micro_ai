"use client";

import { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface RegisterFormData {
  email: string;
  password1: string;
  password2: string;
}

interface RegisterProps {
  onSubmit: (data: RegisterFormData) => void;
  error?: string;
  isLoading?: boolean;
}

export default function Register({ onSubmit, error, isLoading }: RegisterProps) {
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password1: '',
    password2: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <svg width="88" height="59" viewBox="0 0 88 59" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-auto">
          <path
            d="M48.9529 55.3394C46.3467 55.3394 43.9316 53.9461 42.6312 51.6895L40.6916 48.3347L40.4566 47.8867L40.4402 47.9031L39.0196 45.4389L38.7683 44.9854L38.6863 44.8542L33.6869 36.205C31.4631 32.3366 25.8791 32.3366 23.6498 36.205L14.7055 51.695C13.4051 53.9516 10.9955 55.3394 8.39474 55.3394C1.931 55.3394 -2.08493 48.362 1.13327 42.7561L21.4151 7.64541C24.6333 2.04496 32.7253 2.04496 35.9435 7.64541L43.1831 20.1631L43.2978 20.3598L43.6639 21.01L45.7129 24.5779L45.7347 24.556L46.0844 25.2062L56.5641 43.3735H56.5422L56.5258 43.3899C59.1211 48.8647 55.1653 55.3448 48.9529 55.3448V55.3394Z"
            fill="#4F46E5"
          />
          <path
            d="M63.9019 7.7175C61.4411 3.45518 55.9919 1.99419 51.7309 4.45429C47.4699 6.91439 46.0105 12.364 48.4714 16.6263L68.1139 50.6482C70.5748 54.9105 76.024 56.3715 80.285 53.9114C84.546 51.4513 86.0053 46.0017 83.5445 41.7394L63.9019 7.7175Z"
            fill="#4F46E5"
          />
        </svg>
        <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          Create your account
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
              Email address
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password1" className="block text-sm font-medium leading-6 text-gray-900">
              Password
            </label>
            <div className="mt-2 relative">
              <input
                id="password1"
                name="password1"
                type={showPassword1 ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={formData.password1}
                onChange={(e) => setFormData({ ...formData, password1: e.target.value })}
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
                onClick={() => setShowPassword1(!showPassword1)}
              >
                {showPassword1 ? (
                  <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <EyeIcon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="password2" className="block text-sm font-medium leading-6 text-gray-900">
              Confirm Password
            </label>
            <div className="mt-2 relative">
              <input
                id="password2"
                name="password2"
                type={showPassword2 ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={formData.password2}
                onChange={(e) => setFormData({ ...formData, password2: e.target.value })}
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 sm:text-sm/6"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
                onClick={() => setShowPassword2(!showPassword2)}
              >
                {showPassword2 ? (
                  <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <EyeIcon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Registration error
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
                  Signing up...
                </>
              ) : (
                'Sign up'
              )}
            </button>
          </div>
        </form>

        <p className="mt-10 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <a href="/accounts/login" className="font-semibold leading-6 text-primary-600 hover:text-primary-500">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
} 