"use client";

import Link from "next/link";
import Image from "next/image";
import { LOGO_ALT, LOGO_SRC } from "@/constants/branding";
import { useRouter } from "next/navigation";
import LogoIcon from "@/img/logos/small-logo.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/(authenticated)/app/(pages)/edit/[id]/components/ui/select";
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
  onCreateApp: () => void;
  isCreatingApp?: boolean;
}

export default function DashboardHeader({
  activeTab,
  onCreateApp,
  isCreatingApp = false,
}: DashboardHeaderProps) {
  const router = useRouter();

  const handlePrivacyChange = (value: string) => {
    router.push(value === "all" ? "/dashboard" : `/dashboard/${value}`);
  };

  return (
    <header className="flex h-16 w-full min-w-0 shrink-0 items-center gap-x-4 bg-white sm:gap-x-6 dark:bg-gray-900">
      {/* Logo - icon on mobile, full logo on desktop */}
      <div className="flex shrink-0">
        <Link href="/dashboard" className="flex items-center">
          <Image
            src={LogoIcon}
            alt={LOGO_ALT}
            width={36}
            height={36}
            className="h-9 w-9 lg:hidden"
            priority
          />
          <Image
            src={LOGO_SRC}
            alt={LOGO_ALT}
            width={140}
            height={36}
            className="h-5 w-auto hidden lg:block"
            priority
          />
        </Link>
      </div>

      {/* Privacy filter - segmented control on desktop, dropdown on mobile */}
      <div className="flex flex-1 justify-center overflow-x-auto min-w-0">
        {/* Mobile: custom select dropdown */}
        <div className="md:hidden w-full max-w-[140px]">
          <Select value={activeTab} onValueChange={handlePrivacyChange}>
            <SelectTrigger
              className="h-9 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
              aria-label="Apps privacy filter"
            >
              <SelectValue placeholder="Filter apps" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800">
              {PRIVACY_TABS.map((tab) => (
                <SelectItem key={tab.value} value={tab.value}>
                  {tab.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Desktop: segmented control */}
        <nav
          className="hidden md:inline-flex shrink-0 rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
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

      {/* Add new app button - icon only on mobile */}
      <div className="flex shrink-0">
        <button
          onClick={onCreateApp}
          disabled={isCreatingApp}
          title={isCreatingApp ? "Creating..." : "Add new app"}
          className={cn(
            "inline-flex items-center justify-center gap-x-2 rounded-lg bg-primary px-4 py-3 text-sm text-white shadow-sm transition-colors md:px-6",
            isCreatingApp
              ? "cursor-not-allowed opacity-50"
              : "hover:bg-primary-600"
          )}
        >
          <CirclePlus className="h-5 w-5 shrink-0" />
          <span className="hidden md:inline">
            {isCreatingApp ? "Creating..." : "Add new app"}
          </span>
        </button>
      </div>
    </header>
  );
}
