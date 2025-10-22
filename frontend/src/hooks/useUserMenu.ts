import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axiosInstance from '@/utils/axiosInstance';
import { useAuth } from '@/context/AuthContext';
import { useUserStore } from '@/store/userStore';

export interface UserMenuRoute {
  name: string;
  path: string;
  action?: () => void | Promise<void>;
}

/**
 * Custom hook for user menu functionality
 * Provides credits, logout, and navigation logic
 */
export function useUserMenu() {
  const [totalCredits, setTotalCredits] = useState<number | null>(null);
  const router = useRouter();
  const { logout, isAuthenticated } = useAuth();
  const { user } = useUserStore();
  const api = axiosInstance();

  /**
   * Fetch user credits from API
   */
  const fetchCredits = useCallback(async (abortSignal: AbortSignal) => {
    try {
      const response = await api.get(`/api/microapps/user/billing`, {
        signal: abortSignal
      });
      const billingDetails = response.data.billing_details;
      const creditsRemaining = billingDetails?.[0]?.credits_remaining || 0;
      const topUpCredits = response.data.top_up_credits || 0;
      setTotalCredits(creditsRemaining + topUpCredits);
    } catch (error: unknown) {
      const errorName = error && typeof error === 'object' && 'name' in error ? error.name : null;
      if (errorName && errorName !== 'AbortError' && errorName !== 'CanceledError') {
        console.error('Error fetching credits:', error);
      }
    }
  }, [api]);

  /**
   * Handle user logout
   */
  const handleLogout = useCallback(async () => {
    try {
      setTotalCredits(null);
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [logout]);

  /**
   * Navigate to a route
   */
  const navigateTo = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  // Fetch credits when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const abortController = new AbortController();
      fetchCredits(abortController.signal);

      return () => abortController.abort();
    } else {
      setTotalCredits(null);
    }
  }, [fetchCredits, isAuthenticated]);

  // Define menu routes
  const routes: UserMenuRoute[] = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Subscription', path: '/settings/subscription' },
    { name: 'Profile', path: '/settings/profile' },
    { 
      name: 'Logout', 
      path: '#',
      action: handleLogout 
    },
  ];

  return {
    user,
    totalCredits,
    routes,
    handleLogout,
    navigateTo,
    isAuthenticated,
  };
}

