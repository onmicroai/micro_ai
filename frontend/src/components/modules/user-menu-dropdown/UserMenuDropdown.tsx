"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { 
  ChevronUpIcon, 
  UserIcon, 
  Cog8ToothIcon,
  ArrowRightOnRectangleIcon,
  HomeIcon,
  CreditCardIcon,
} from '@heroicons/react/20/solid';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useUserMenu } from '@/hooks/useUserMenu';
import { cn } from '@/utils/cn';

interface UserMenuDropdownProps {
  /** Display mode: 'sidebar' for sidebar footer, 'navbar' for navbar */
  mode?: 'sidebar' | 'navbar';
  /** Optional className for the wrapper */
  className?: string;
}

/**
 * User menu dropdown component with credits display and navigation
 * Can be used in both sidebar and navbar contexts
 */
export default function UserMenuDropdown({ mode = 'sidebar', className }: UserMenuDropdownProps) {
  const { user, totalCredits, routes, handleLogout, navigateTo } = useUserMenu();
  const pathname = usePathname();

  const getIcon = (routeName: string) => {
    switch (routeName) {
      case 'Dashboard':
        return HomeIcon;
      case 'Subscription':
        return CreditCardIcon;
      case 'Profile':
        return UserIcon;
      case 'Logout':
        return ArrowRightOnRectangleIcon;
      default:
        return Cog8ToothIcon;
    }
  };

  if (mode === 'sidebar') {
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
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm/5 font-medium text-gray-900 dark:text-white">
                  {user?.firstName + ' ' + user?.lastName || user?.email?.split('@')[0] || 'User'}
                </span>
                <span className="block truncate text-xs/5 font-normal text-gray-500 dark:text-gray-400">
                  {user?.email || ''}
                </span>
              </span>
            </span>
            <ChevronUpIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </MenuButton>

          <MenuItems
            transition
            className="absolute bottom-full left-0 right-0 mb-1 mx-2 origin-bottom rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800 dark:ring-white/10 transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            {routes.map((route) => {
              const Icon = getIcon(route.name);
              const isActive = pathname === route.path;
              const isDivider = route.name === 'Logout';

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
                          'group flex w-full items-center gap-x-3 px-3 py-2 text-sm',
                          focus || isActive
                            ? 'bg-gray-50 text-primary dark:bg-white/5 dark:text-white'
                            : 'text-gray-700 dark:text-gray-300',
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-5 w-5',
                            focus || isActive
                              ? 'text-primary dark:text-white'
                              : 'text-gray-400 dark:text-gray-500',
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
                <CreditCardIcon className="h-5 w-5 text-primary" />
                Credits: {totalCredits ?? '-'}
              </span>
            </div>
          </MenuItems>
        </Menu>
      </div>
    );
  }

  // Navbar mode (existing userButton style)
  return (
    <div className={cn("relative inline-block text-left", className)}>
      <Menu as="div" className="relative">
        <div className="hidden md:flex items-center">
          <MenuButton className="flex items-center justify-center w-8 h-8 rounded-full overflow-hidden hover:ring-2 hover:ring-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200">
            <Image
              src={user?.profilePic || "/profile-pic.png"}
              width={24}
              height={24}
              alt="Profile picture"
              className="rounded-full object-cover"
              style={{ width: '100%', height: '100%' }}
            />
          </MenuButton>
        </div>

        <div className="md:hidden">
          <MenuButton className="flex flex-col justify-center items-center w-8 h-8 space-y-1.5">
            <div className="w-5 h-0.5 bg-gray-600"></div>
            <div className="w-5 h-0.5 bg-gray-600"></div>
            <div className="w-5 h-0.5 bg-gray-600"></div>
          </MenuButton>
        </div>

        <MenuItems
          transition
          className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 focus:outline-none transition duration-200 ease-in-out data-[closed]:scale-95 data-[closed]:opacity-0"
        >
          <div className="py-1">
            {routes.map((route) => {
              const isActive = pathname === route.path;
              const isDivider = route.name === 'Logout';

              return (
                <div key={route.name}>
                  {isDivider && (
                    <hr className="border-t border-gray-200 my-2" />
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
                          'block w-full px-4 py-2 text-sm text-left',
                          focus || isActive
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-700',
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
                Credits: {totalCredits ?? '-'}
              </span>
            </div>
          </div>
        </MenuItems>
      </Menu>
    </div>
  );
}

