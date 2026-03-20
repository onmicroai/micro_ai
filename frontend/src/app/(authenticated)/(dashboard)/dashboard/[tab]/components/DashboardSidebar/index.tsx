"use client";

import { useCallback, useState } from "react";
import {
  DragDropContext,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { toast } from "react-toastify";
import axiosInstance from "@/utils/axiosInstance";
import { addMicroappToCollection } from "@/app/(authenticated)/app/(pages)/edit/[id]/utils/updateMicroappCollection";
import {
  collectionSidebarDroppableId,
  dashboardAppsListDroppableId,
  parseCollectionDropDestination,
} from "../../dashboardDndConstants";
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
import {
  Collection,
  type DashboardListScope,
} from "@/app/(authenticated)/(dashboard)/types";
import UserMenuDropdown from "@/components/modules/user-menu-dropdown/UserMenuDropdown";
import { useDashboardStore } from "../../store/dashboardStore";
import DashboardHeader from "../DashboardHeader";
import Modal from "../Modal";
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
  UserRound,
  UsersRound,
} from "lucide-react";

interface DashboardSidebarProps {
  children: React.ReactNode;
  collections: Collection[];
  activeTab: string;
  appCounts: { [key: string]: number };
  onCreateApp: () => void | Promise<void>;
  onCreateCollection: () => Promise<void>;
  updateCollectionName: (
    collectionId: number,
    newName: string
  ) => Promise<void>;
  isCreatingApp?: boolean;
  isCreatingCollection?: boolean;
}

const scopeButtonClass = (active: boolean) =>
  cn(
    active
      ? "bg-primary/10 text-primary dark:bg-white/5 dark:text-primary-350"
      : "hover:bg-gray-50 hover:text-primary dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white",
    "group flex gap-x-2 rounded-md p-2 text-sm font-medium leading-6 w-full text-left"
  );

export default function DashboardSidebar({
  children,
  collections,
  activeTab,
  onCreateApp,
  onCreateCollection,
  updateCollectionName,
  isCreatingApp = false,
  isCreatingCollection = false,
}: DashboardSidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<number | null>(
    null
  );
  const [editedName, setEditedName] = useState("");
  const [collectionToDelete, setCollectionToDelete] =
    useState<Collection | null>(null);
  const { listScope, setListScope, deleteCollection, reorderDashboardList } =
    useDashboardStore();
  const [flashCollectionId, setFlashCollectionId] = useState<number | null>(
    null
  );

  const flashCollectionRow = useCallback((collectionId: number) => {
    setFlashCollectionId(collectionId);
    window.setTimeout(() => setFlashCollectionId(null), 2000);
  }, []);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;

      const appMatch = draggableId.match(/^app-(\d+)$/);
      if (!appMatch) return;

      if (
        destination.droppableId === dashboardAppsListDroppableId &&
        source.droppableId === dashboardAppsListDroppableId
      ) {
        if (destination.index !== source.index) {
          await reorderDashboardList(
            source.index,
            destination.index,
            activeTab
          );
        }
        return;
      }

      const collectionId = parseCollectionDropDestination(
        destination.droppableId
      );
      if (collectionId == null) return;

      const appId = Number(appMatch[1]);
      const app = useDashboardStore.getState().apps.find((a) => a.id === appId);
      const title = app?.title ?? "App";
      const collectionName =
        collections.find((c) => c.id === collectionId)?.name ?? "collection";

      try {
        const api = axiosInstance();
        const res = await api.get(
          `/api/collection/app/${appId}/collections/`
        );
        const cols: { id: number }[] = res?.data?.data ?? [];
        if (cols.some((c) => c.id === collectionId)) {
          toast.info(
            `“${title}” is already in “${collectionName}”.`,
            { theme: "colored" }
          );
          flashCollectionRow(collectionId);
          return;
        }

        await addMicroappToCollection(appId, collectionId);
        toast.success(`Added “${title}” to “${collectionName}”.`, {
          theme: "colored",
        });
        flashCollectionRow(collectionId);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string; message?: string } } };
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Could not add app to collection.";
        toast.error(typeof msg === "string" ? msg : "Could not add app to collection.", {
          theme: "colored",
        });
      }
    },
    [activeTab, collections, flashCollectionRow, reorderDashboardList]
  );

  const setScope = (scope: DashboardListScope) => () => setListScope(scope);

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

  const SidebarContent = ({
    dropInstance,
  }: {
    dropInstance: "desktop" | "mobile";
  }) => (
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
              <div className="text-sm font-semibold uppercase leading-6 tracking-wider">
                Views
              </div>
              <ul role="list" className="-mx-2 mt-2 space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={setScope({ kind: "all" })}
                    className={scopeButtonClass(listScope.kind === "all")}
                  >
                    <SquareLibrary className="h-6 w-6 shrink-0" />
                    <span className="flex-1 truncate">All apps</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={setScope({ kind: "owned" })}
                    className={scopeButtonClass(listScope.kind === "owned")}
                  >
                    <UserRound className="h-6 w-6 shrink-0" />
                    <span className="flex-1 truncate">My apps</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={setScope({ kind: "shared" })}
                    className={scopeButtonClass(listScope.kind === "shared")}
                  >
                    <UsersRound className="h-6 w-6 shrink-0" />
                    <span className="flex-1 truncate">Shared with me</span>
                  </button>
                </li>
              </ul>
            </li>
            <li>
              <div className="flex items-center justify-between text-sm font-semibold uppercase leading-6 tracking-wider">
                <span>Collections</span>
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
                {collections.map((collection) => {
                  const isActive =
                    listScope.kind === "collection" &&
                    listScope.id === collection.id;
                  const isEditing = editingCollectionId === collection.id;
                  const isFlashing = flashCollectionId === collection.id;

                  if (isEditing) {
                    return (
                      <li key={collection.id}>
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
                      </li>
                    );
                  }

                  return (
                    <Droppable
                      key={collection.id}
                      droppableId={collectionSidebarDroppableId(
                        dropInstance,
                        collection.id
                      )}
                    >
                      {(dropProvided, snapshot) => (
                        <li
                          ref={dropProvided.innerRef}
                          {...dropProvided.droppableProps}
                          className={cn(
                            "rounded-md transition-colors",
                            snapshot.isDraggingOver &&
                              "bg-primary/10 dark:bg-primary/20",
                            isFlashing &&
                              "ring-2 ring-emerald-500/80 dark:ring-emerald-400/80"
                          )}
                        >
                          <div className="group flex gap-x-2 rounded-md p-2 text-sm font-medium leading-6 w-full items-center">
                            <button
                              type="button"
                              onClick={() =>
                                setListScope({
                                  kind: "collection",
                                  id: collection.id,
                                })
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
                          {dropProvided.placeholder}
                        </li>
                      )}
                    </Droppable>
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
    <DragDropContext onDragEnd={handleDragEnd}>
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
            <SidebarContent dropInstance="mobile" />
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
          <SidebarContent dropInstance="desktop" />
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
    </div>
    </DragDropContext>
  );
}
