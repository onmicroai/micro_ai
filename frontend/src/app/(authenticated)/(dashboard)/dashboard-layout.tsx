"use client";

import Footer from "@/components/layout/footer/footer";
import PrivateNavbar from "@/components/layout/navbar/privateNavbar";
import { ToastContainer } from 'react-toastify';
import WaitlistMessage from "@/components/waitlist-message";
import { useUserStore } from "@/store/userStore";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading: userIsLoading } = useUserStore();
  const enableWaitlist = process.env.NEXT_PUBLIC_ENABLE_WAITLIST === 'true';

  return (
    <>
         <ToastContainer />
         <PrivateNavbar showCreateApp={enableWaitlist ? user?.isBetaTester : true}/>
      {userIsLoading ? (
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-gray-500">Loading...</div>
        </div>
         ) : (enableWaitlist && !user?.isBetaTester) ? (
        <WaitlistMessage />
      ) : (
        children
      )}
      <Footer />
    </>
  );
}
