"use client";

import { useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  TransitionChild,
} from "@headlessui/react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { Bars3Icon, XMarkIcon, FolderIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { cn } from "@/utils/cn";
import { Collection } from "@/app/(authenticated)/(dashboard)/types";
import UserMenuDropdown from "@/components/modules/user-menu-dropdown/UserMenuDropdown";
import { useDashboardStore } from "../../store/dashboardStore";
import DashboardHeader from "../DashboardHeader";
import Modal from "../Modal";
import CreateAppModal from "../CreateAppModal";
import {
  DarkTooltip,
  DarkTooltipContent,
  DarkTooltipProvider,
  DarkTooltipTrigger,
} from "../ui/DarkTooltip";
import {
  CirclePlus,
  EllipsisVertical,
  FolderClosedIcon,
  Info,
  Pencil,
  Settings,
  SquareLibrary,
  Trash2,
} from "lucide-react";

interface DashboardSidebarProps {
  children: React.ReactNode;
  collections: Collection[];
  activeCollectionId: number | null;
  activeTab: string;
  appCounts: { [key: string]: number };
  onCreateApp: () => void;
  onCreateCollection: () => Promise<void>;
  updateCollectionName: (
    collectionId: number,
    newName: string
  ) => Promise<void>;
  isCreatingApp?: boolean;
  isCreatingCollection?: boolean;
  showCreateAppModal?: boolean;
  setShowCreateAppModal?: (show: boolean) => void;
  onConfirmCreateApp?: (
    values: import("../CreateAppModal").CreateAppFormValues
  ) => void | Promise<void>;
}

export default function DashboardSidebar({
  children,
  collections,
  activeCollectionId,
  activeTab,
  onCreateApp,
  onCreateCollection,
  updateCollectionName,
  isCreatingApp = false,
  isCreatingCollection = false,
  showCreateAppModal = false,
  setShowCreateAppModal,
  onConfirmCreateApp,
}: DashboardSidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<number | null>(
    null
  );
  const [editedName, setEditedName] = useState("");
  const [collectionToDelete, setCollectionToDelete] =
    useState<Collection | null>(null);
  const { setActiveCollectionId, deleteCollection } = useDashboardStore();

  const startEditingCollection = (
    collection: Collection,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingCollectionId(collection.id);
    setEditedName(collection.name);
  };

  const saveCollectionName = async (collectionId: number) => {
    const collection = collections.find((c) => c.id === collectionId);
    if (editedName && editedName !== collection?.name) {
      await updateCollectionName(collectionId, editedName);
    }
    setEditingCollectionId(null);
    setEditedName("");
  };

  const cancelEditing = () => {
    setEditingCollectionId(null);
    setEditedName("");
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    collectionId: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveCollectionName(collectionId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  };

  const handleConfirmDeleteCollection = async () => {
    if (collectionToDelete) {
      await deleteCollection(collectionToDelete.id);
      setCollectionToDelete(null);
    }
  };

  const SidebarContent = () => (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-white text-gray-500 dark:bg-gray-500",
        "h-full max-h-full"
      )}
    >
      {/* Scrollable: collections only — Account stays in the footer below */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2 pt-4">
        <nav>
          <ul role="list" className="flex flex-col gap-y-7">
            <li>
              <div className="flex items-center justify-between text-sm font-semibold uppercase leading-6 tracking-wider">
                <span>Your Collections</span>
                <button
                  onClick={onCreateCollection}
                  disabled={isCreatingCollection}
                  className={cn(
                    "inline-flex items-center gap-x-1 rounded-md px-2 py-1 font-medium text-primary transition-colors",
                    isCreatingCollection
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-primary/10 dark:hover:bg-white/5"
                  )}
                  title="Create new collection"
                >
                  <CirclePlus className="w-4 h-4" />
                  Add
                </button>
              </div>
              <ul role="list" className="-mx-2 mt-2 space-y-1">
                <li>
                  <button
                    onClick={() => setActiveCollectionId(null)}
                    className={cn(
                      activeCollectionId === null
                        ? "bg-primary/10 text-primary dark:bg-white/5 dark:text-primary-350"
                        : " hover:bg-gray-50 hover:text-primary dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white",
                      "group flex gap-x-2 rounded-md p-2 text-sm font-medium leading-6 w-full"
                    )}
                  >
                    <SquareLibrary />
                    <span className="flex-1 truncate text-left">
                      All collections
                    </span>
                  </button>
                </li>

                {collections.map((collection) => {
                  const isActive = activeCollectionId === collection.id;
                  const isEditing = editingCollectionId === collection.id;

                  return (
                    <li key={collection.id}>
                      {isEditing ? (
                        <div className="flex items-center gap-x-2 px-2 py-2">
                          <FolderClosedIcon />
                          <input
                            type="text"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            onBlur={() => saveCollectionName(collection.id)}
                            onKeyDown={(e) => handleKeyDown(e, collection.id)}
                            autoFocus
                            className="flex-1 min-w-0 rounded border border-primary px-2 py-1 text-sm focus:border-transparent focus:ring-2 focus:ring-primary dark:border-primary dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                      ) : (
                        <div className="group flex gap-x-2 rounded-md p-2 text-sm font-medium leading-6 w-full items-center">
                          <button
                            onClick={() =>
                              setActiveCollectionId(collection.id)
                            }
                            className={cn(
                              isActive
                                ? "bg-primary/10 text-primary dark:bg-white/5 dark:text-primary-350"
                                : "hover:bg-gray-50 hover:text-primary  dark:hover:bg-white/5 dark:hover:text-white",
                              "flex gap-x-2 flex-1 min-w-0 rounded-md -m-2 p-2 text-left"
                            )}
                          >
                            <FolderIcon
                              className={cn(
                                isActive
                                  ? "text-primary"
                                  : "group-hover:text-primary",
                                "h-6 w-6 shrink-0"
                              )}
                            />
                            <span className="flex-1 truncate text-left">
                              {collection.name}
                            </span>
                            <Menu as="div" className="relative">
                              <DarkTooltipProvider delayDuration={300}>
                                <DarkTooltip>
                                  <DarkTooltipTrigger asChild>
                                    <MenuButton
                                      onClick={(e) => e.stopPropagation()}
                                      className="rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-0"
                                    >
                                      <EllipsisVertical className="h-4 w-4" />
                                    </MenuButton>
                                  </DarkTooltipTrigger>
                                  <DarkTooltipContent>
                                    Collection actions
                                  </DarkTooltipContent>
                                </DarkTooltip>
                              </DarkTooltipProvider>
                              <MenuItems
                                transition
                                className="absolute right-0 z-20 mt-1 w-40 origin-top-right rounded-md bg-white py-1 shadow-lg transition focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0 dark:bg-gray-800"
                              >
                                <MenuItem>
                                  {({ focus }) => (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        startEditingCollection(collection, e);
                                      }}
                                      className={cn(
                                        focus
                                          ? "bg-gray-100 dark:bg-gray-700"
                                          : "",
                                        "flex w-full items-center gap-x-2 px-4 py-2 text-sm text-left text-gray-500 dark:text-gray-300"
                                      )}
                                    >
                                      <Pencil className="h-4 w-4" />
                                      Edit
                                    </button>
                                  )}
                                </MenuItem>
                                <MenuItem>
                                  {({ focus }) => (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setCollectionToDelete(collection);
                                      }}
                                      className={cn(
                                        focus
                                          ? "bg-red-50 dark:bg-red-950/50"
                                          : "",
                                        "flex w-full items-center gap-x-2 px-4 py-2 text-sm text-left text-red-600 dark:text-red-400"
                                      )}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete
                                    </button>
                                  )}
                                </MenuItem>
                              </MenuItems>
                            </Menu>
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          </ul>
        </nav>
      </div>

      {/* Pinned to bottom of sidebar viewport (desktop) / panel (mobile) */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-6 pb-4 pt-4 dark:border-gray-700 dark:bg-gray-500">
        <div className="text-xs font-semibold uppercase leading-6 tracking-wider dark:text-gray-500 mb-2">
          Account
        </div>
        <ul role="list" className="-mx-2 space-y-1">
          <li>
            <Link
              href="/help"
              className="group flex gap-x-3 rounded-md p-2 text-sm font-medium leading-6 hover:bg-gray-50 hover:text-primary dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <Info className="h-6 w-6 shrink-0  group-hover:text-primary" />
              Help
            </Link>
          </li>
          <li>
            <Link
              href="/settings/profile"
              className="group flex gap-x-3 rounded-md p-2 text-sm font-medium leading-6 hover:bg-gray-50 hover:text-primary dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <Settings className="h-6 w-6 shrink-0 group-hover:text-primary" />
              Settings
            </Link>
          </li>
        </ul>

        <div className="mt-4 -mx-2">
          <UserMenuDropdown mode="sidebar" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Mobile sidebar overlay */}
      <Dialog
        open={sidebarOpen}
        onClose={setSidebarOpen}
        className="relative z-50 lg:hidden"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-900/80 transition-opacity duration-300 ease-linear data-[closed]:opacity-0"
        />
        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            className="relative mr-16 flex h-full max-h-full min-h-0 w-full max-w-xs flex-1 flex-col overflow-hidden transform transition duration-300 ease-in-out data-[closed]:-translate-x-full"
          >
            <TransitionChild>
              <div className="absolute left-full top-0 flex w-16 justify-center pt-5 duration-300 ease-in-out data-[closed]:opacity-0">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="-m-2.5 p-2.5"
                >
                  <span className="sr-only">Close sidebar</span>
                  <XMarkIcon
                    aria-hidden="true"
                    className="h-6 w-6 text-white"
                  />
                </button>
              </div>
            </TransitionChild>
            <SidebarContent />
          </DialogPanel>
        </div>
      </Dialog>

      {/* Header - full width, above sidebar and content */}
      <header className="sticky top-0 z-30 flex shrink-0 items-center gap-x-2 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-4 sm:px-6 lg:px-8 dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="-m-2.5 shrink-0 p-2.5 text-gray-700 lg:hidden dark:text-gray-400"
        >
          <span className="sr-only">Open sidebar</span>
          <Bars3Icon aria-hidden="true" className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <DashboardHeader
            activeTab={activeTab}
            onCreateApp={onCreateApp}
            isCreatingApp={isCreatingApp}
          />
        </div>
      </header>

      {/* Sidebar + content - below header */}
      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "hidden w-72 shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-white lg:flex dark:border-gray-700 dark:bg-gray-900",
            /* Viewport-height column: collections scroll inside; Account stays at bottom. */
            "lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:max-h-[calc(100vh-4rem)] lg:self-start"
          )}
        >
          <SidebarContent />
        </aside>

        {/* Page content */}
        <main className="min-w-0 flex-1">
          <div className="px-4 py-6 sm:px-6">{children}</div>
        </main>
      </div>

      {/* Delete collection confirmation modal */}
      {collectionToDelete && (
        <Modal
          isOpen={!!collectionToDelete}
          onClose={() => setCollectionToDelete(null)}
          onConfirm={handleConfirmDeleteCollection}
          title="Delete Collection"
          message={`Are you sure that you want to delete "${collectionToDelete.name}"? All apps added to this collection will remain and won’t be deleted.`}
          confirmText="Delete"
        />
      )}

      {/* Create app modal */}
      {setShowCreateAppModal && onConfirmCreateApp && (
        <CreateAppModal
          isOpen={showCreateAppModal}
          onClose={() => setShowCreateAppModal(false)}
          onConfirm={onConfirmCreateApp}
          collections={collections}
          defaultCollectionId={activeCollectionId ?? collections[0]?.id ?? null}
          isLoading={isCreatingApp}
        />
      )}
    </div>
  );
}
