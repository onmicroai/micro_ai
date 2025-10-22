'use client'

import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, TransitionChild } from '@headlessui/react';
import {
  Bars3Icon,
  XMarkIcon,
  FolderIcon,
  HomeIcon,
  LockClosedIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  PlusIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';
import { FaPenToSquare } from 'react-icons/fa6';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/utils/cn';
import Logo from '@/img/logos/onMicroAI_logo_horiz_color-cropped.svg';
import { Collection } from '@/app/(authenticated)/(dashboard)/types';
import UserMenuDropdown from '@/components/modules/user-menu-dropdown/UserMenuDropdown';
import { useDashboardStore } from '../../store/dashboardStore';

interface DashboardSidebarProps {
  children: React.ReactNode;
  collections: Collection[];
  activeCollectionId: number | null;
  activeTab: string;
  appCounts: { [key: string]: number };
  onCreateApp: () => Promise<void>;
  onCreateCollection: () => Promise<void>;
  updateCollectionName: (collectionId: number, newName: string) => Promise<void>;
  isCreatingApp?: boolean;
  isCreatingCollection?: boolean;
}

const privacyNavigation = [
  { name: 'All Apps', value: 'all', icon: HomeIcon },
  { name: 'Public', value: 'public', icon: GlobeAltIcon },
  { name: 'Private', value: 'private', icon: LockClosedIcon },
  { name: 'Restricted', value: 'restricted', icon: ShieldCheckIcon },
];

export default function DashboardSidebar({ 
  children, 
  collections, 
  activeCollectionId,
  activeTab,
  appCounts,
  onCreateApp,
  onCreateCollection,
  updateCollectionName,
  isCreatingApp = false,
  isCreatingCollection = false,
}: DashboardSidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<number | null>(null);
  const [editedName, setEditedName] = useState("");
  const { setActiveCollectionId } = useDashboardStore();

  /**
   * Gets the URL for a privacy tab
   */
  const getTabUrl = (tabValue: string) => {
    return `/dashboard/${tabValue}`;
  };

  /**
   * Start editing a collection name
   */
  const startEditingCollection = (collection: Collection, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingCollectionId(collection.id);
    setEditedName(collection.name);
  };

  /**
   * Save edited collection name
   */
  const saveCollectionName = async (collectionId: number) => {
    const collection = collections.find(c => c.id === collectionId);
    if (editedName && editedName !== collection?.name) {
      await updateCollectionName(collectionId, editedName);
    }
    setEditingCollectionId(null);
    setEditedName("");
  };

  /**
   * Cancel editing
   */
  const cancelEditing = () => {
    setEditingCollectionId(null);
    setEditedName("");
  };

  /**
   * Handle keyboard events for collection name editing
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, collectionId: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveCollectionName(collectionId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  /**
   * Renders the sidebar content (navigation items and collections)
   */
  const SidebarContent = () => (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4 dark:bg-gray-900">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center">
        <Link href="/dashboard">
          <Image 
            src={Logo} 
            alt="Micro AI" 
            width={150} 
            height={40}
            className="h-5 w-auto"
            priority
          />
        </Link>
      </div>

      {/* Primary CTA - New App Button */}
      <button
        onClick={onCreateApp}
        disabled={isCreatingApp}
        className={cn(
          "flex w-full items-center justify-center gap-x-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors",
          isCreatingApp
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-primary-600"
        )}
      >
        <PlusIcon className="h-5 w-5" />
        {isCreatingApp ? 'Creating...' : 'New App'}
      </button>
      
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          {/* Privacy Categories Section */}
          <li>
            <div className="text-xs font-semibold leading-6 text-gray-400 mb-2">
              Filter by Privacy
            </div>
            <ul role="list" className="-mx-2 space-y-1">
              {privacyNavigation.map((item) => {
                const isActive = activeTab === item.value;
                const count = appCounts[item.value] || 0;
                // Use /dashboard for "all", /dashboard/[tab] for others
                const href = item.value === 'all' ? '/dashboard' : getTabUrl(item.value);
                
                return (
                  <li key={item.value}>
                    <Link
                      href={href}
                      className={cn(
                        isActive
                          ? 'bg-gray-50 text-primary dark:bg-white/5 dark:text-white'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-primary dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white',
                        'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6',
                      )}
                    >
                      <item.icon
                        aria-hidden="true"
                        className={cn(
                          isActive
                            ? 'text-primary dark:text-white'
                            : 'text-gray-400 group-hover:text-primary dark:group-hover:text-white',
                          'h-6 w-6 shrink-0',
                        )}
                      />
                      <span className="flex-1">{item.name}</span>
                      <span className={cn(
                        isActive 
                          ? 'text-primary dark:text-white' 
                          : 'text-gray-400',
                        'text-xs'
                      )}>
                        {count}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
          
          {/* Collections Section */}
          <li>
            <div className="flex items-center justify-between text-xs font-semibold leading-6 text-gray-400">
              <span>Your Collections</span>
              <button
                onClick={onCreateCollection}
                disabled={isCreatingCollection}
                className={cn(
                  "inline-flex items-center gap-x-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  isCreatingCollection
                    ? "cursor-not-allowed opacity-50 text-gray-400"
                    : "text-gray-500 hover:text-primary hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5"
                )}
                title="Create new collection"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New</span>
              </button>
            </div>
            <ul role="list" className="-mx-2 mt-2 space-y-1">
              {/* All Collections Option */}
              <li>
                <button
                  onClick={() => setActiveCollectionId(null)}
                  className={cn(
                    activeCollectionId === null
                      ? 'bg-gray-50 text-primary dark:bg-white/5 dark:text-white'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-primary dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white',
                    'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 w-full',
                  )}
                >
                  <span
                    className={cn(
                      activeCollectionId === null
                        ? 'border-primary text-primary dark:border-white/20 dark:text-white'
                        : 'border-gray-200 text-gray-400 group-hover:border-primary group-hover:text-primary dark:border-white/10 dark:group-hover:border-white/20 dark:group-hover:text-white',
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border bg-white text-[0.625rem] font-medium dark:bg-white/5',
                    )}
                  >
                    <RectangleStackIcon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate text-left">All Collections</span>
                </button>
              </li>
              
              {collections.map((collection) => {
                const isActive = activeCollectionId === collection.id;
                const isEditing = editingCollectionId === collection.id;
                
                return (
                  <li key={collection.id}>
                    {isEditing ? (
                      <div className="flex items-center gap-x-2 px-2 py-2">
                        <span
                          className={cn(
                            'border-primary text-primary dark:border-white/20 dark:text-white',
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border bg-white text-[0.625rem] font-medium dark:bg-white/5',
                          )}
                        >
                          <FolderIcon className="h-4 w-4" />
                        </span>
                        <input
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          onBlur={() => saveCollectionName(collection.id)}
                          onKeyDown={(e) => handleKeyDown(e, collection.id)}
                          autoFocus
                          className="flex-1 min-w-0 px-2 py-1 text-sm font-semibold border border-primary rounded focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:border-primary dark:text-white"
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveCollectionId(collection.id)}
                        className={cn(
                          isActive
                            ? 'bg-gray-50 text-primary dark:bg-white/5 dark:text-white'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-primary dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white',
                          'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 w-full',
                        )}
                      >
                        <span
                          className={cn(
                            isActive
                              ? 'border-primary text-primary dark:border-white/20 dark:text-white'
                              : 'border-gray-200 text-gray-400 group-hover:border-primary group-hover:text-primary dark:border-white/10 dark:group-hover:border-white/20 dark:group-hover:text-white',
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border bg-white text-[0.625rem] font-medium dark:bg-white/5',
                          )}
                        >
                          <FolderIcon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 truncate text-left">{collection.name}</span>
                        <button
                          onClick={(e) => startEditingCollection(collection, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                          title="Rename collection"
                        >
                          <FaPenToSquare className="h-3 w-3" />
                        </button>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>

          {/* User Profile Menu - Sticks to Bottom */}
          <li className="mt-auto">
            <UserMenuDropdown mode="sidebar" />
          </li>
        </ul>
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile sidebar */}
      <Dialog open={sidebarOpen} onClose={setSidebarOpen} className="relative z-50 lg:hidden">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-900/80 transition-opacity duration-300 ease-linear data-[closed]:opacity-0"
        />

        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            className="relative mr-16 flex w-full max-w-xs flex-1 transform transition duration-300 ease-in-out data-[closed]:-translate-x-full"
          >
            <TransitionChild>
              <div className="absolute left-full top-0 flex w-16 justify-center pt-5 duration-300 ease-in-out data-[closed]:opacity-0">
                <button type="button" onClick={() => setSidebarOpen(false)} className="-m-2.5 p-2.5">
                  <span className="sr-only">Close sidebar</span>
                  <XMarkIcon aria-hidden="true" className="h-6 w-6 text-white" />
                </button>
              </div>
            </TransitionChild>

            <SidebarContent />
          </DialogPanel>
        </div>
      </Dialog>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <SidebarContent />
      </div>

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-white px-4 py-4 shadow-sm sm:px-6 lg:hidden dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="-m-2.5 p-2.5 text-gray-700 lg:hidden dark:text-gray-400"
        >
          <span className="sr-only">Open sidebar</span>
          <Bars3Icon aria-hidden="true" className="h-6 w-6" />
        </button>
        <div className="flex-1 text-sm font-semibold leading-6 text-gray-900 dark:text-white">
          Dashboard
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="-m-2.5 p-2.5"
        >
          <span className="sr-only">Open user menu</span>
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">

          </div>
        </button>
      </div>

      {/* Main content */}
      <main className="lg:pl-72">
        <div className="px-4 py-10 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </>
  );
}

