"use client";

import { useRef, useState } from 'react';
import { XMarkIcon, DocumentDuplicateIcon } from '@heroicons/react/20/solid'
import { toast } from 'react-toastify';
import { useDashboardStore } from '@/app/(authenticated)/(dashboard)/dashboard/[tab]/store/dashboardStore';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';

interface RemixBannerProps {
  onDismiss?: () => void;
  appId: number;
  copyAllowed: boolean;
}

export default function RemixBanner({ onDismiss, appId, copyAllowed }: RemixBannerProps) {
  const cloneApp = useDashboardStore(state => state.cloneApp);
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const remixInFlightRef = useRef(false);
  const [remixBusy, setRemixBusy] = useState(false);

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

    if (remixInFlightRef.current) {
      return;
    }
    remixInFlightRef.current = true;
    setRemixBusy(true);
    try {
      await cloneApp(appId); // Let the backend handle collection management
    } catch (error) {
      // Error handling is done in the store
      console.error('Error in remix:', error);
    } finally {
      remixInFlightRef.current = false;
      setRemixBusy(false);
    }
  };

  return (
    <div className="pointer-events-none fixed right-4 top-[1.5rem] z-40">
      <div className="group pointer-events-auto flex items-center gap-1 text-sm text-gray-500 opacity-60 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100">
        <a
          href="#"
          aria-busy={remixBusy}
          aria-disabled={remixBusy}
          aria-label="Remix: make your own copy of this app"
          tabIndex={remixBusy ? -1 : undefined}
          className={cn(
            "flex items-center rounded px-1 py-0.5 font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            remixBusy
              ? "pointer-events-none cursor-not-allowed opacity-60"
              : "group-hover:text-primary group-focus-within:text-primary"
          )}
          onClick={handleRemixClick}
        >
          <DocumentDuplicateIcon className="h-4 w-4 flex-none" aria-hidden="true" />
          <span className="ml-1.5">Remix</span>
          <span
            aria-hidden="true"
            className="ml-0 max-w-0 overflow-hidden whitespace-nowrap font-normal text-gray-600 opacity-0 transition-all duration-200 ease-out group-hover:ml-1.5 group-hover:max-w-[12rem] group-hover:opacity-100 group-focus-within:ml-1.5 group-focus-within:max-w-[12rem] group-focus-within:opacity-100"
          >
            · Make your own copy
          </span>
        </a>
        <button
          type="button"
          className="flex-none rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          onClick={onDismiss}
        >
          <span className="sr-only">Dismiss</span>
          <XMarkIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
