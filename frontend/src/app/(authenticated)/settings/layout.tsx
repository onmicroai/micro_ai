'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Lock, CreditCard } from 'lucide-react';
import PrivateNavbar from '@/components/layout/navbar/privateNavbar';
import { ToastContainer } from 'react-toastify';

const menuItems = [
  {
    title: 'Profile',
    href: '/settings/profile',
    icon: User
  },
  {
    title: 'Password',
    href: '/settings/password',
    icon: Lock
  },
  {
    title: 'Subscription',
    href: '/settings/subscription',
    icon: CreditCard
  }
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <ToastContainer />
      <PrivateNavbar />
      <div className="min-h-screen dark:bg-black-dark">
        <div className="container max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 dark:bg-black-dark">
          <div className="space-y-6">
            {/* Navigation */}
            <div className="flex flex-col sm:flex-row gap-4">
              <aside className="w-full sm:w-64 space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors
                        ${isActive 
                          ? 'bg-primary text-primary-foreground' 
                          : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </aside>

              {/* Content */}
              <div className="flex-1">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 