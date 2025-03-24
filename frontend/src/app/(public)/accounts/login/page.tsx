"use client";

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Login from '@/components/Login';
import { useDashboardStore } from '@/app/(authenticated)/(dashboard)/dashboard/[tab]/store/dashboardStore';

// Create a wrapper component that uses searchParams
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const cloneApp = useDashboardStore(state => state.cloneApp);
  const [error, setError] = useState('');

  // Move handlePendingRemix inside useEffect or wrap it in useCallback
  const handlePendingRemix = useCallback(async () => {
    const pendingRemixAppId = localStorage.getItem('pendingRemixAppId');
    if (pendingRemixAppId) {
      try {
        await cloneApp(parseInt(pendingRemixAppId));
        localStorage.removeItem('pendingRemixAppId');
      } catch (error) {
        console.error('Error handling pending remix:', error);
      }
    }
  }, [cloneApp]);

  // Only redirect if we detect user is already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      handlePendingRemix().then(() => {
        const nextPath = searchParams.get('next');
        router.push(nextPath || '/dashboard');
      });
    }
  }, [isAuthenticated, router, searchParams, handlePendingRemix]);

  const handleSubmit = async (data: { email: string; password: string }) => {
    try {
      setError('');
      await login(data.email, data.password);
      // The redirect will be handled by the useEffect above
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    }
  };

  // If already authenticated, don't show anything while redirecting
  if (isAuthenticated) {
    return null;
  }

  // Show login form by default
  return (
    <div className="min-h-screen bg-white">
      <Login onSubmit={handleSubmit} error={error} />
    </div>
  );
}

// Main page component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
} 