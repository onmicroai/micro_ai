"use client";

import Footer from "@/components/layout/footer/footer";
import WaitlistMessage from "@/components/waitlist-message";
import { useUserStore } from "@/store/userStore";

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading: userIsLoading } = useUserStore();
  const enableWaitlist = process.env.NEXT_PUBLIC_ENABLE_WAITLIST === 'true';

  return (
    <>
      {/* Navbar removed - using sidebar navigation instead */}
      {userIsLoading ? (
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : (enableWaitlist && !user?.isBetaTester) ? (
        <WaitlistMessage />
      ) : (
        children
      )}

    </>
  );
}

