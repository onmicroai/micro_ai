"use client";

import Link from "next/link";
import Image from "next/image";
import Logo from "@/img/logos/onMicroAI_logo_horiz_color-cropped.svg";
import { cn } from "@/utils/cn";
import { CirclePlus } from "lucide-react";

const PRIVACY_TABS = [
  { name: "All apps", value: "all" },
  { name: "Public", value: "public" },
  { name: "Private", value: "private" },
  { name: "Restricted", value: "restricted" },
] as const;

interface DashboardHeaderProps {
  activeTab: string;
  onCreateApp: () => Promise<void>;
  isCreatingApp?: boolean;
}

export default function DashboardHeader({
  activeTab,
  onCreateApp,
  isCreatingApp = false,
}: DashboardHeaderProps) {
  return (
    <header className="flex h-16 w-full min-w-0 shrink-0 items-center gap-x-4 bg-white sm:gap-x-6 dark:bg-gray-900">
      {/* Logo */}
      <div className="flex shrink-0">
        <Link href="/dashboard">
          <Image
            src={Logo}
            alt="OnMicro.AI"
            width={140}
            height={36}
            className="h-5 w-auto"
            priority
          />
        </Link>
      </div>

      {/* Privacy filter - segmented control (center) */}
      <div className="flex flex-1 justify-center overflow-x-auto">
        <nav
          className="inline-flex shrink-0 rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
          aria-label="Apps privacy filter"
        >
          {PRIVACY_TABS.map((tab) => {
            const href =
              tab.value === "all" ? "/dashboard" : `/dashboard/${tab.value}`;
            const isActive = activeTab === tab.value;

            return (
              <Link
                key={tab.value}
                href={href}
                className={cn(
                  "rounded-md px-5 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white text-primary shadow-sm dark:bg-gray-700 dark:text-primary-350"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                )}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Add new app button */}
      <div className="flex shrink-0">
        <button
          onClick={onCreateApp}
          disabled={isCreatingApp}
          className={cn(
            "inline-flex items-center gap-x-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors",
            isCreatingApp
              ? "cursor-not-allowed opacity-50"
              : "hover:bg-primary-600"
          )}
        >
          <CirclePlus />
          {isCreatingApp ? "Creating..." : "Add new app"}
        </button>
      </div>
    </header>
  );
}
