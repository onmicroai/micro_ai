/**
 * Legacy route for backwards compatibility with bookmarked URLs.
 * Redirects to /dashboard with the collection filter applied.
 */
'use client'

import { useEffect } from "react";
import { useParams, useRouter } from 'next/navigation';
import { useDashboardStore } from '../store/dashboardStore';

const LegacyDashboard = () => {
  const router = useRouter();
  const params = useParams() ?? {};
  const activeTab = (params.tab as string) || 'all';
  const pageCollectionId = (params.id as string) || '';
  const { setActiveCollectionId } = useDashboardStore();

  useEffect(() => {
    // Set the collection filter based on the URL parameter
    if (pageCollectionId) {
      const collectionId = parseInt(pageCollectionId);
      if (!isNaN(collectionId)) {
        setActiveCollectionId(collectionId);
      }
    }
    
    // Redirect to the new dashboard URL structure
    // Use /dashboard for "all" tab, /dashboard/[tab] for others
    const redirectUrl = activeTab === 'all' ? '/dashboard' : `/dashboard/${activeTab}`;
    router.replace(redirectUrl);
  }, [pageCollectionId, activeTab, setActiveCollectionId, router]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="text-gray-500">Redirecting...</div>
    </div>
  );
};

export default LegacyDashboard;
