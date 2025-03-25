"use client";

import { XMarkIcon } from '@heroicons/react/20/solid'
import { toast } from 'react-toastify';
import { useDashboardStore } from '@/app/(authenticated)/(dashboard)/dashboard/[tab]/store/dashboardStore';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface RemixBannerProps {
  onDismiss?: () => void;
  appId: number;
  copyAllowed: boolean;
}

export default function RemixBanner({ onDismiss, appId, copyAllowed }: RemixBannerProps) {
  const cloneApp = useDashboardStore(state => state.cloneApp);
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const handleRemixClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (!copyAllowed) {
      toast.error("This app cannot be remixed.", { theme: "colored" });
      return;
    }

    if (!isAuthenticated) {
      // Store the app ID to remix after login
      localStorage.setItem('pendingRemixAppId', appId.toString());
      // Redirect to login with return URL
      router.push(`/accounts/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    try {
      await cloneApp(appId); // Let the backend handle collection management
    } catch (error) {
      // Error handling is done in the store
      console.error('Error in remix:', error);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0">
      <div className="relative isolate flex items-center gap-x-6 overflow-hidden bg-gray-50 px-6 py-2.5 sm:px-3.5 sm:before:flex-1">
        <div
          aria-hidden="true"
          className="absolute left-[max(-7rem,calc(50%-52rem))] top-1/2 -z-10 -translate-y-1/2 transform-gpu blur-2xl"
        >
          <div
            style={{
              clipPath:
                'polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)',
            }}
            className="aspect-[577/310] w-[36.0625rem] bg-gradient-to-r from-[#4cffd4] to-[#5c5ef1] opacity-70"
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute left-[max(45rem,calc(50%+8rem))] top-1/2 -z-10 -translate-y-1/2 transform-gpu blur-2xl"
        >
          <div
            style={{
              clipPath:
                'polygon(74.8% 41.9%, 97.2% 73.2%, 100% 34.9%, 92.5% 0.4%, 87.5% 0%, 75% 28.6%, 58.5% 54.6%, 50.1% 56.8%, 46.9% 44%, 48.3% 17.4%, 24.7% 53.9%, 0% 27.9%, 11.9% 74.2%, 24.9% 54.1%, 68.6% 100%, 74.8% 41.9%)',
            }}
            className="aspect-[577/310] w-[36.0625rem] bg-gradient-to-r from-[#4cffd4] to-[#5c5ef1] opacity-70"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm/6 text-gray-900">
            <strong className="font-semibold">Like this app?&nbsp;&nbsp;</strong>
            Create your own version by remixing it.
          </p>
          <a
            href="#"
            className="flex-none rounded-full bg-gray-900 px-3.5 py-1 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
            onClick={handleRemixClick}
          >
            Remix this app <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
        <div className="flex flex-1 justify-end">
          <button 
            type="button" 
            className="-m-3 p-3 focus-visible:outline-offset-[-4px] hover:bg-gray-100 rounded-full"
            onClick={onDismiss}
          >
            <span className="sr-only">Dismiss</span>
            <XMarkIcon className="h-5 w-5 text-gray-900" />
          </button>
        </div>
      </div>
    </div>
  )
} 