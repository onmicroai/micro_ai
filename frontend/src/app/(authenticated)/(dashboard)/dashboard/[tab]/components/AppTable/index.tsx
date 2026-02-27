'use client'

import React, { useState, useEffect } from 'react';
import { FaTrashCan as TrashCan, FaRegCopy, FaShareNodes, FaPenToSquare, FaChartLine } from 'react-icons/fa6';
import { Bars3Icon } from '@heroicons/react/20/solid';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import Link from "next/link";
import { useDashboardStore } from '../../store/dashboardStore';
import axiosInstance from "@/utils/axiosInstance";
import { toast } from 'react-toastify';
import ShareModal from '../ShareModal';
import Modal from '../Modal';
import { AppSerialized } from '@/app/(authenticated)/(dashboard)/types';
import { cn } from '@/utils/cn';

interface AppTableProps {
  activeCollectionId: number | null;
  activeTab: string;
}

/**
 * AppTable component - A consolidated table that displays apps with filtering
 * Responds to sidebar filters (privacy categories and collection selection)
 */
const AppTable: React.FC<AppTableProps> = ({ 
  activeCollectionId, 
  activeTab
}) => {
  const { apps, appLoading, fetchApps, fetchAllApps, cloneApp, deleteApp } = useDashboardStore();
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppSerialized | null>(null);
  const api = axiosInstance();

  // Fetch apps when collection changes
  useEffect(() => {
    const controller = new AbortController();
    
    if (activeCollectionId === null) {
      // Fetch all apps when no specific collection is selected
      fetchAllApps(controller.signal);
    } else {
      // Fetch apps for specific collection
      fetchApps(activeCollectionId, controller.signal);
    }
    
    return () => controller.abort();
  }, [activeCollectionId, fetchApps, fetchAllApps]);

  // Filter apps based on privacy tab only
  // Collection filtering happens at the fetch level (fetchApps vs fetchAllApps)
  const filteredApps = apps
    .filter(app => activeTab === "all" || app?.privacy?.toLowerCase() === activeTab)
    .sort((a, b) => a.id - b.id);

  /**
   * Get privacy badge styling based on privacy type
   */
  const getPrivacyBadge = (privacy: string) => {
    const privacyLower = privacy.toLowerCase();
    const baseClasses = "inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full";
    
    const colorClasses = {
      public: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      private: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      restricted: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
    };

    return `${baseClasses} ${colorClasses[privacyLower as keyof typeof colorClasses] || colorClasses.private}`;
  };

  /**
   * Get privacy display name
   */
  const getPrivacyName = (privacy?: string) => {
    if (!privacy) return "Private";
    
    switch (privacy.toLowerCase()) {
      case "public": return "Public";
      case "private": return "Private";
      case "restricted": return "Restricted";
      default: return "Private";
    }
  };

  /**
   * Handle clone app action
   */
  const handleCloneClick = async (app: AppSerialized) => {
    if (app.copyAllowed) {
      await cloneApp(app.id);
    }
  };

  /**
   * Handle delete app action
   */
  const handleDeleteClick = (app: AppSerialized) => {
    setSelectedApp(app);
    setShowDeleteModal(true);
  };

  /**
   * Confirm delete action
   */
  const handleConfirmDelete = async () => {
    if (!selectedApp) return;

    try {
      const response = await api.delete(`/api/microapps/${selectedApp.id}/archive`);

      if (response.status === 200) {
        toast.success("App deleted successfully.", { theme: "colored" });
        deleteApp(selectedApp.id);
      } else {
        toast.error("Failed to delete the app.", { theme: "colored" });
      }
    } catch {
      toast.error("Error deleting the app.", { theme: "colored" });
    }
    
    setShowDeleteModal(false);
    setSelectedApp(null);
  };

  /**
   * Handle share app action
   */
  const handleShareClick = (app: AppSerialized) => {
    setSelectedApp(app);
    setShowShareMenu(true);
  };

  // Show loading state
  if (appLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Loading apps...</div>
      </div>
    );
  }

  // Show empty state
  if (filteredApps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No apps found in this collection.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <div className="p-6 space-y-0">
          {/* Table Header */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-4 py-3 px-0 border-b-2 border-gray-200 dark:border-gray-700">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              App Name
            </div>
            <div className="w-32 md:w-40 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Privacy
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Actions
            </div>
          </div>

        {/* Table Body - App Rows */}
        {filteredApps.map((app) => (
          <div 
            key={app.id}
            className="group relative border-b border-gray-100 hover:border-gray-200 transition-colors dark:border-gray-800 dark:hover:border-gray-700"
          >
            <div className="py-4 grid grid-cols-[1fr_auto_auto] gap-2 sm:gap-4 items-center">
              {/* App Title */}
              <div className="min-w-0">
                <Link 
                  href={`/app/edit/${app.hashId}`}
                  className="text-sm sm:text-base font-semibold text-gray-900 hover:text-primary transition-colors truncate block dark:text-white dark:hover:text-primary-350"
                >
                  {app.title}
                </Link>
              </div>

              {/* Privacy Badge */}
              <div className="flex-shrink-0">
                <span className={getPrivacyBadge(app.privacy)}>
                  {getPrivacyName(app.privacy)}
                </span>
              </div>

              {/* Actions - Mobile: Hamburger Menu, Desktop: Inline Buttons */}
              <div className="flex-shrink-0">
                {/* Mobile: Dropdown Menu */}
                <div className="sm:hidden">
                  <Menu as="div" className="relative inline-block text-left">
                    <MenuButton className="inline-flex items-center justify-center w-8 h-8 text-gray-700 hover:text-primary hover:bg-gray-100 rounded-md transition-colors dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800">
                      <span className="sr-only">Open actions menu</span>
                      <Bars3Icon className="h-5 w-5" aria-hidden="true" />
                    </MenuButton>

                    <MenuItems
                      transition
                      className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0 dark:bg-gray-800 dark:ring-gray-700"
                    >
                      <div className="py-1">
                        <MenuItem>
                          {({ focus }) => (
                            <Link
                              href={`/app/edit/${app.hashId}`}
                              className={cn(
                                focus ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-700 dark:text-gray-300',
                                'group flex items-center gap-x-3 px-4 py-2 text-sm'
                              )}
                            >
                              <FaPenToSquare className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </Link>
                          )}
                        </MenuItem>
                        <MenuItem>
                          {({ focus }) => (
                            <Link
                              href={`/app/${app.hashId}/stats`}
                              className={cn(
                                focus ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-700 dark:text-gray-300',
                                'group flex items-center gap-x-3 px-4 py-2 text-sm'
                              )}
                            >
                              <FaChartLine className="h-4 w-4" aria-hidden="true" />
                              Stats
                            </Link>
                          )}
                        </MenuItem>
                        <MenuItem>
                          {({ focus }) => (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleShareClick(app);
                              }}
                              className={cn(
                                focus ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white' : 'text-gray-700 dark:text-gray-300',
                                'group flex w-full items-center gap-x-3 px-4 py-2 text-sm'
                              )}
                            >
                              <FaShareNodes className="h-4 w-4" aria-hidden="true" />
                              Share
                            </button>
                          )}
                        </MenuItem>
                        <MenuItem disabled={!app.copyAllowed}>
                          {({ focus }) => (
                            <button
                              onClick={() => handleCloneClick(app)}
                              disabled={!app.copyAllowed}
                              className={cn(
                                app.copyAllowed
                                  ? focus 
                                    ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white' 
                                    : 'text-gray-700 dark:text-gray-300'
                                  : 'text-gray-400 cursor-not-allowed dark:text-gray-600',
                                'group flex w-full items-center gap-x-3 px-4 py-2 text-sm'
                              )}
                            >
                              <FaRegCopy className="h-4 w-4" aria-hidden="true" />
                              Clone {!app.copyAllowed && '(disabled)'}
                            </button>
                          )}
                        </MenuItem>
                        <div className="border-t border-gray-100 dark:border-gray-700" />
                        <MenuItem>
                          {({ focus }) => (
                            <button
                              onClick={() => handleDeleteClick(app)}
                              className={cn(
                                focus ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'text-red-600 dark:text-red-400',
                                'group flex w-full items-center gap-x-3 px-4 py-2 text-sm'
                              )}
                            >
                              <TrashCan className="h-4 w-4" aria-hidden="true" />
                              Delete
                            </button>
                          )}
                        </MenuItem>
                      </div>
                    </MenuItems>
                  </Menu>
                </div>

                {/* Desktop: Inline Buttons */}
                <div className="hidden sm:flex items-center gap-x-1">
                  {/* Edit */}
                  <Link 
                    href={`/app/edit/${app.hashId}`}
                    className="inline-flex items-center gap-x-1 px-2 py-1.5 text-xs font-medium text-gray-700 hover:text-primary hover:bg-gray-100 rounded-md transition-colors dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"
                    title="Edit app"
                  >
                    <FaPenToSquare className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </Link>

                  {/* Stats */}
                  <Link 
                    href={`/app/${app.hashId}/stats`}
                    className="inline-flex items-center gap-x-1 px-2 py-1.5 text-xs font-medium text-gray-700 hover:text-primary hover:bg-gray-100 rounded-md transition-colors dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"
                    title="View stats"
                  >
                    <FaChartLine className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Stats</span>
                  </Link>

                  {/* Share */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleShareClick(app);
                    }}
                    className="inline-flex items-center gap-x-1 px-2 py-1.5 text-xs font-medium text-gray-700 hover:text-primary hover:bg-gray-100 rounded-md transition-colors dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"
                    title="Share app"
                  >
                    <FaShareNodes className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Share</span>
                  </button>

                  {/* Clone */}
                  <button
                    onClick={() => handleCloneClick(app)}
                    disabled={!app.copyAllowed}
                    className={`inline-flex items-center gap-x-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      app.copyAllowed 
                        ? 'text-gray-700 hover:text-primary hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800' 
                        : 'text-gray-400 cursor-not-allowed dark:text-gray-600'
                    }`}
                    title={app.copyAllowed ? "Clone app" : "Cloning not allowed"}
                  >
                    <FaRegCopy className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Clone</span>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteClick(app)}
                    className="inline-flex items-center gap-x-1 px-2 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                    title="Delete app"
                  >
                    <TrashCan className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* Share Modal */}
      {selectedApp && (
        <ShareModal 
          app={selectedApp} 
          showModal={showShareMenu} 
          setShowModal={(show) => {
            setShowShareMenu(show);
            if (!show) setSelectedApp(null);
          }} 
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedApp && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedApp(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Delete Application"
          message={`Are you sure you want to delete "${selectedApp.title}"?`}
        />
      )}
    </>
  );
};

export default AppTable;

