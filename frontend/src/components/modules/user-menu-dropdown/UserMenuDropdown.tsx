"use client";

import { useEffect, useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  ChevronRightIcon,
  UserIcon,
  Cog8ToothIcon,
  HomeIcon,
} from "@heroicons/react/20/solid";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUserMenu } from "@/hooks/useUserMenu";
import { cn } from "@/utils/cn";
import { CreditCard, LogOut } from "lucide-react";

interface UserMenuDropdownProps {
  /** Display mode: 'sidebar' for sidebar footer, 'navbar' for navbar */
  mode?: "sidebar" | "navbar";
  /** Optional className for the wrapper */
  className?: string;
}

/**
 * User menu dropdown component with credits display and navigation
 * Can be used in both sidebar and navbar contexts
 */
export default function UserMenuDropdown({
  mode = "sidebar",
  className,
}: UserMenuDropdownProps) {
  const { user, totalCredits, routes, navigateTo } = useUserMenu();
  const pathname = usePathname();

  const getIcon = (routeName: string) => {
    switch (routeName) {
      case "Dashboard":
        return HomeIcon;
      case "Subscription":
        return CreditCard;
      case "Profile":
        return UserIcon;
      case "Logout":
        return LogOut;
      default:
        return Cog8ToothIcon;
    }
  };

  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (mode === "sidebar") {
    return (
      <div className={cn("-mx-6 mt-auto", className)}>
        <Menu as="div" className="relative">
          <MenuButton className="flex w-full items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5">
            <span className="flex min-w-0 items-center gap-3">
              {user?.profilePic ? (
                <Image
                  src={user.profilePic}
                  width={32}
                  height={32}
                  alt="Profile picture"
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {user?.email?.[0]?.toUpperCase() || "U"}
                </div>
              )}

              <span className="min-w-0 flex-1 flex flex-col items-start">
                {(user?.firstName || user?.lastName) && (
                  <span className="block truncate text-sm/5 font-medium text-gray-900 dark:text-white">
                    {user?.firstName && user?.firstName}{" "}
                    {user?.lastName && user?.lastName}
                  </span>
                )}
                <span className="block truncate text-xs/5 font-normal text-gray-500 dark:text-gray-400">
                  {user?.email || ""}
                </span>
              </span>
            </span>
            <ChevronRightIcon
              className="h-5 w-5 shrink-0 text-gray-400"
              aria-hidden="true"
            />
          </MenuButton>

          <MenuItems
            transition
            anchor={isDesktop ? "right start" : "top"}
            className={cn(
              "z-50 min-w-[250px] rounded-lg bg-white py-1 shadow-lg focus:outline-none dark:bg-gray-800 transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 [--anchor-gap:8px]",
              isDesktop ? "origin-top-left -translate-y-4" : "origin-bottom"
            )}
          >
            {routes.map((route) => {
              const Icon = getIcon(route.name);
              const isActive = pathname === route.path;
              const isDivider = route.name === "Logout";

              return (
                <div key={route.name}>
                  {isDivider && (
                    <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
                  )}
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        onClick={async () => {
                          if (route.action) {
                            await route.action();
                          } else {
                            navigateTo(route.path);
                          }
                        }}
                        className={cn(
                          "group flex w-full items-center gap-x-3 px-3 py-2 text-sm",
                          focus || isActive
                            ? "bg-gray-50 text-primary dark:bg-white/5 dark:text-white"
                            : "text-gray-700 dark:text-gray-300"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            focus || isActive
                              ? "text-primary dark:text-white"
                              : "text-gray-400 dark:text-gray-500"
                          )}
                          aria-hidden="true"
                        />
                        {route.name}
                      </button>
                    )}
                  </MenuItem>
                </div>
              );
            })}

            <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />

            <div className="px-3 py-2">
              <span className="flex items-center gap-x-2 text-sm font-semibold text-gray-900 dark:text-white">
                <CreditCard className="h-5 w-5 text-primary" />
                Credits: {totalCredits ?? "-"}
              </span>
            </div>
          </MenuItems>
        </Menu>
      </div>
    );
  }

  // Navbar mode - separate Menu components for desktop and mobile since each needs its own MenuItems
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "User";

  const renderNavbarMenuItems = () => (
    <>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          {user?.profilePic ? (
            <Image
              src={user.profilePic}
              width={40}
              height={40}
              alt="Profile"
              className="rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {displayName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {user?.email || ""}
            </p>
          </div>
        </div>
      </div>
      {routes.map((route) => {
        const isActive = pathname === route.path;
        const isDivider = route.name === "Logout";

        return (
          <div key={route.name}>
            {isDivider && <hr className="border-t border-gray-200 my-2" />}
            <MenuItem>
              {({ focus }) => (
                <button
                  onClick={async () => {
                    if (route.action) {
                      await route.action();
                    } else {
                      navigateTo(route.path);
                    }
                  }}
                  className={cn(
                    "block w-full px-4 py-2 text-sm text-left",
                    focus || isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-700"
                  )}
                >
                  {route.name}
                </button>
              )}
            </MenuItem>
          </div>
        );
      })}
      <hr className="border-t border-gray-200 my-2" />
      <div className="px-4 py-2">
        <span className="block text-sm text-gray-900 font-semibold">
          Credits: {totalCredits ?? "-"}
        </span>
      </div>
    </>
  );

  return (
    <div className={cn("relative inline-block text-left", className)}>
      {/* Desktop Menu */}
      <Menu as="div" className="hidden md:block relative">
        <MenuButton className="flex items-center justify-center w-8 h-8 rounded-full overflow-hidden hover:ring-2 hover:ring-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200">
          <Image
            src={user?.profilePic || "/profile-pic.png"}
            width={24}
            height={24}
            alt="Profile picture"
            className="rounded-full object-cover"
            style={{ width: "100%", height: "100%" }}
          />
        </MenuButton>

        <MenuItems
          transition
          className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white z-[100] focus:outline-none transition duration-200 ease-in-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:bg-gray-800"
        >
          <div className="py-1">{renderNavbarMenuItems()}</div>
        </MenuItems>
      </Menu>

      {/* Mobile Menu */}
      <Menu as="div" className="md:hidden">
        <MenuItems
          transition
          className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white z-[100] focus:outline-none transition duration-200 ease-in-out data-[closed]:scale-95 data-[closed]:opacity-0 dark:bg-gray-800"
        >
          <div className="py-1">{renderNavbarMenuItems()}</div>
        </MenuItems>
      </Menu>
    </div>
  );
}
