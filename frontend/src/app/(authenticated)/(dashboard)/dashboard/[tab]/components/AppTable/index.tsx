"use client";

import React, { useState, useEffect } from "react";
import { FaArrowRightFromBracket } from "react-icons/fa6";
import { Bars3Icon } from "@heroicons/react/20/solid";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import Link from "next/link";
import { useDashboardStore } from "../../store/dashboardStore";
import axiosInstance from "@/utils/axiosInstance";
import { toast } from "react-toastify";
import { useUserStore } from "@/store/userStore";
import ShareModal from "../ShareModal";
import Modal from "../Modal";
import {
  AppSerialized,
  AppStats,
  DashboardListScope,
} from "@/app/(authenticated)/(dashboard)/types";
import { cn } from "@/utils/cn";
import {
  Badge,
  BadgeVariant,
} from "@/app/(authenticated)/app/(pages)/edit/[id]/components/ui/badge";
import {
  ChartLine,
  CirclePlus,
  Copy,
  GripVertical,
  PencilIcon,
  Share2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { dashboardAppsListDroppableId } from "../../dashboardDndConstants";
import { getSortedDashboardAppList } from "../../dashboardSortUtils";
import {
  DarkTooltip,
  DarkTooltipContent,
  DarkTooltipProvider,
  DarkTooltipTrigger,
} from "../ui/DarkTooltip";

/** Unified app action config - same icons for desktop and mobile */
type AppActionId = "edit" | "stats" | "share" | "clone" | "delete" | "leave";

interface AppActionConfig {
  id: AppActionId;
  label: string;
  Icon: LucideIcon | typeof FaArrowRightFromBracket;
  /** Link href - if set, renders as Link */
  getHref?: (app: AppSerialized) => string;
  /** Button action key */
  action?: "share" | "clone" | "delete" | "leave";
  isDisabled?: (app: AppSerialized) => boolean;
  isDanger?: boolean;
  /** Show only when user is owner */
  ownerOnly?: boolean;
  /** Show only when user is NOT owner (e.g. Leave) */
  adminOnly?: boolean;
}

const APP_ACTIONS: AppActionConfig[] = [
  {
    id: "edit",
    label: "Edit",
    Icon: PencilIcon,
    getHref: (app) => `/app/edit/${app.hashId}`,
  },
  {
    id: "stats",
    label: "Statistics",
    Icon: ChartLine,
    getHref: (app) => `/app/${app.hashId}/stats`,
  },
  { id: "share", label: "Share", Icon: Share2, action: "share" },
  {
    id: "clone",
    label: "Clone",
    Icon: Copy,
    action: "clone",
    isDisabled: (app) => !app.copyAllowed,
  },
  {
    id: "delete",
    label: "Delete",
    Icon: Trash2,
    action: "delete",
    isDanger: true,
    ownerOnly: true,
  },
  {
    id: "leave",
    label: "Leave",
    Icon: FaArrowRightFromBracket,
    action: "leave",
    isDanger: true,
    adminOnly: true,
  },
];

interface AppTableProps {
  activeTab: string;
  onCreateApp?: () => void | Promise<void>;
  isCreatingApp?: boolean;
}

function getEmptyStateMessage(
  listScope: DashboardListScope,
  activeTab: string,
  appsLength: number
): string {
  if (listScope.kind === "collection") {
    return "No apps in this collection. Drag apps here from All apps to organize them.";
  }
  if (listScope.kind === "owned") {
    return "You don't own any apps yet.";
  }
  if (listScope.kind === "shared") {
    return "You aren't an admin on any shared apps yet.";
  }
  if (activeTab !== "all" && appsLength > 0) {
    const label =
      activeTab.charAt(0).toUpperCase() + activeTab.slice(1).toLowerCase();
    return `No ${label.toLowerCase()} apps yet.`;
  }
  return "No apps found.";
}

/**
 * AppTable component - Card layout for apps with filtering
 * Default: privacy badge visible. On hover: title turns blue, action icons appear.
 */
const AppTable: React.FC<AppTableProps> = ({
  activeTab,
  onCreateApp,
  isCreatingApp = false,
}) => {
  const api = axiosInstance();
  const {
    apps,
    appLoading,
    fetchApps,
    fetchAllApps,
    cloneApp,
    deleteApp,
    listScope,
    globalDashboardOrderIds,
    collectionDashboardOrderIds,
    collectionOrderForId,
  } = useDashboardStore();
  const { user } = useUserStore();
  const currentUserId = Number(user?.id);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppSerialized | null>(null);

  const collectionFetchId =
    listScope.kind === "collection" ? listScope.id : null;

  useEffect(() => {
    const controller = new AbortController();
    if (collectionFetchId === null) {
      fetchAllApps(controller.signal);
    } else {
      fetchApps(collectionFetchId, controller.signal);
    }
    return () => controller.abort();
  }, [collectionFetchId, fetchApps, fetchAllApps]);

  const filteredApps = getSortedDashboardAppList(
    apps,
    listScope,
    activeTab,
    globalDashboardOrderIds,
    collectionDashboardOrderIds,
    collectionOrderForId
  );

  const getPrivacyVariant = (privacy: string): BadgeVariant => {
    switch (privacy?.toLowerCase()) {
      case "public":
        return "success";
      case "restricted":
        return "warning";
      default:
        return "muted";
    }
  };

  const getPrivacyName = (privacy?: string) => {
    if (!privacy) return "Private";
    switch (privacy.toLowerCase()) {
      case "public":
        return "Public";
      case "private":
        return "Private";
      case "restricted":
        return "Restricted";
      default:
        return "Private";
    }
  };

  const formatMetrics = (metrics: AppStats | undefined) => {
    const totalUsage = metrics?.sessions ?? 0;
    const uniqueUsers = metrics?.unique_users ?? 0;
    const totalCost = metrics?.total_credits ?? 0;
    const avgCostPerUsage = metrics?.avg_credits_session ?? 0;

    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pr-6">
        <span>{`Total usage: ${totalUsage}`}</span>
        <span className="text-gray-300 dark:text-gray-600">▪</span>
        <span>{`Unique users: ${uniqueUsers}`}</span>
        <span className="text-gray-300 dark:text-gray-600">▪</span>
        <span>{`Total cost (Credits): ${totalCost}`}</span>
        <span className="text-gray-300 dark:text-gray-600">▪</span>
        <span>{`Avg. cost per usage (Credits): ${avgCostPerUsage}`}</span>
      </div>
    );
  };

  const handleCloneClick = async (app: AppSerialized) => {
    if (app.copyAllowed) await cloneApp(app.id);
  };

  const handleDeleteClick = (app: AppSerialized) => {
    setSelectedApp(app);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedApp) return;
    try {
      const response = await api.delete(
        `/api/microapps/${selectedApp.id}/archive`
      );
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

  const handleShareClick = (app: AppSerialized) => {
    setSelectedApp(app);
    setShowShareMenu(true);
  };

  const handleLeaveClick = (app: AppSerialized) => {
    setSelectedApp(app);
    setShowLeaveModal(true);
  };

  const handleConfirmLeave = async () => {
    if (!selectedApp || !currentUserId) return;
    try {
      await api.delete(
        `/api/microapps/${selectedApp.id}/admins/${currentUserId}/`
      );
      toast.success(`You have left "${selectedApp.title}".`, {
        theme: "colored",
      });
      deleteApp(selectedApp.id);
    } catch {
      toast.error("Could not leave the app. Please try again.", {
        theme: "colored",
      });
    }
    setShowLeaveModal(false);
    setSelectedApp(null);
  };

  const isOwner = (app: AppSerialized) => app.role === "owner";

  const getVisibleActions = (app: AppSerialized) =>
    APP_ACTIONS.filter((a) => {
      if (a.ownerOnly && !isOwner(app)) return false;
      if (a.adminOnly && isOwner(app)) return false;
      return true;
    });

  const renderAction = (
    action: AppActionConfig,
    app: AppSerialized,
    variant: "icon" | "menu"
  ) => {
    const {
      Icon,
      label,
      getHref,
      action: actionKey,
      isDisabled,
      isDanger,
    } = action;
    const disabled = isDisabled?.(app) ?? false;

    const iconButtonClasses = cn(
      "inline-flex items-center justify-center rounded-md p-2 transition-colors",
      isDanger
        ? "text-red-500 hover:bg-red-50 dark:text-gray-400 dark:hover:bg-red-950/50 dark:hover:text-red-400"
        : disabled
        ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
        : "text-gray-400 hover:bg-gray-100 hover:text-primary dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-primary-350"
    );

    const menuItemClasses = (focus: boolean) =>
      cn(
        "flex w-full items-center gap-x-3 px-4 py-2 text-sm text-left",
        isDanger
          ? "text-red-600 dark:text-red-400"
          : "text-gray-500 dark:text-gray-300",
        focus &&
          (isDanger
            ? "bg-red-50 dark:bg-red-950/50"
            : "bg-gray-100 dark:bg-gray-700")
      );

    const icon = <Icon />;
    const tooltipText =
      disabled && action.id === "clone" ? "Cloning not allowed" : label;

    if (getHref) {
      const href = getHref(app);
      if (variant === "icon") {
        return (
          <DarkTooltipProvider key={action.id} delayDuration={300}>
            <DarkTooltip>
              <DarkTooltipTrigger asChild>
                <Link href={href} className={iconButtonClasses}>
                  {icon}
                </Link>
              </DarkTooltipTrigger>
              <DarkTooltipContent>{tooltipText}</DarkTooltipContent>
            </DarkTooltip>
          </DarkTooltipProvider>
        );
      }
      return (
        <MenuItem key={action.id}>
          {({ focus }) => (
            <Link href={href} className={menuItemClasses(focus)}>
              {icon}
              {label}
            </Link>
          )}
        </MenuItem>
      );
    }

    const onClick = () => {
      if (actionKey === "share") handleShareClick(app);
      if (actionKey === "clone") handleCloneClick(app);
      if (actionKey === "delete") handleDeleteClick(app);
      if (actionKey === "leave") handleLeaveClick(app);
    };

    if (variant === "icon") {
      const buttonEl = (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={iconButtonClasses}
        >
          {icon}
        </button>
      );
      return (
        <DarkTooltipProvider key={action.id} delayDuration={300}>
          <DarkTooltip>
            <DarkTooltipTrigger asChild>
              {disabled ? (
                <span className="inline-flex">{buttonEl}</span>
              ) : (
                buttonEl
              )}
            </DarkTooltipTrigger>
            <DarkTooltipContent>{tooltipText}</DarkTooltipContent>
          </DarkTooltip>
        </DarkTooltipProvider>
      );
    }

    return (
      <MenuItem key={action.id} disabled={disabled}>
        {({ focus }) => (
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              menuItemClasses(focus),
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            {icon}
            {label}
          </button>
        )}
      </MenuItem>
    );
  };

  if (appLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Loading apps...</div>
      </div>
    );
  }

  if (filteredApps.length === 0) {
    const showFirstAppCta =
      listScope.kind === "all" &&
      activeTab === "all" &&
      apps.length === 0 &&
      onCreateApp != null;

    if (showFirstAppCta) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create your first app
          </h2>
          <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Build a custom AI-powered experience for your learners. You can
            create an app by describing what you want it to do, and then tweak it as you like.
          </p>
          <button
            type="button"
            onClick={onCreateApp}
            disabled={isCreatingApp}
            className={cn(
              "mt-6 inline-flex items-center justify-center gap-x-2 rounded-lg bg-primary px-6 py-3 text-sm text-white shadow-sm transition-colors",
              isCreatingApp
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-primary-600"
            )}
          >
            <CirclePlus className="h-5 w-5 shrink-0" />
            {isCreatingApp ? "Creating..." : "Create your first app"}
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {getEmptyStateMessage(listScope, activeTab, apps.length)}
        </p>
      </div>
    );
  }

  return (
    <>
      <Droppable droppableId={dashboardAppsListDroppableId}>
        {(listProvided) => (
          <div
            ref={listProvided.innerRef}
            {...listProvided.droppableProps}
            className="space-y-3"
          >
            {filteredApps.map((app, index) => (
              <Draggable
                key={app.id}
                draggableId={`app-${app.id}`}
                index={index}
              >
                {(dragProvided, snapshot) => {
                  const { style, ...draggableProps } =
                    dragProvided.draggableProps;
                  return (
                  <div
                    ref={dragProvided.innerRef}
                    {...draggableProps}
                    style={style as React.CSSProperties}
                    className={cn(
                      "group relative rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:bg-gray-800",
                      snapshot.isDragging &&
                        "shadow-lg ring-2 ring-primary/50 dark:ring-primary-350/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-4">
                      <button
                        type="button"
                        {...dragProvided.dragHandleProps}
                        className="mt-0.5 shrink-0 cursor-grab touch-manipulation rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing dark:hover:bg-white/10 dark:hover:text-gray-300"
                        aria-label={`Drag to add “${app.title}” to a collection`}
                      >
                        <GripVertical className="h-5 w-5" />
                      </button>
                      {/* Left: Title + metrics */}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/app/edit/${app.hashId}`}
                          className={cn(
                            "text-lg font-semibold transition-colors duration-200",
                            "text-gray-900 group-hover:text-primary dark:text-white dark:group-hover:text-primary-350"
                          )}
                        >
                          {app.title}
                        </Link>
                        {!isOwner(app) && (
                          <span className="ml-2 inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Admin
                          </span>
                        )}

                        <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">
                          {formatMetrics(app.stats)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="flex items-center gap-1">
                          <Badge
                            variant={getPrivacyVariant(app.privacy)}
                            size="md"
                          >
                            {getPrivacyName(app.privacy)}
                          </Badge>
                          <div className="flex md:hidden">
                            <Menu as="div" className="relative border-none">
                              <MenuButton className="inline-flex items-center gap-x-1 rounded-md px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10">
                                <Bars3Icon className="h-5 w-5" />
                              </MenuButton>
                              <MenuItems
                                transition
                                className="absolute right-0 z-10 mt-2 w-48 origin-top-left rounded-md bg-white py-1 shadow-lg transition focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0 dark:bg-gray-800"
                              >
                                {getVisibleActions(app).map((action) => (
                                  <React.Fragment key={action.id}>
                                    {renderAction(action, app, "menu")}
                                  </React.Fragment>
                                ))}
                              </MenuItems>
                            </Menu>
                          </div>
                        </div>

                        <div
                          className={cn(
                            "hidden md:flex items-center gap-x-1 transition-all duration-200",
                            "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0"
                          )}
                        >
                          {getVisibleActions(app).map((action) =>
                            renderAction(action, app, "icon")
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                }}
              </Draggable>
            ))}
            {listProvided.placeholder}
          </div>
        )}
      </Droppable>

      {selectedApp && (
        <ShareModal
          app={selectedApp}
          showModal={showShareMenu}
          setShowModal={(show) => {
            setShowShareMenu(show);
            if (!show) setSelectedApp(null);
          }}
          isOwner={isOwner(selectedApp)}
        />
      )}

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

      {showLeaveModal && selectedApp && (
        <Modal
          isOpen={showLeaveModal}
          onClose={() => {
            setShowLeaveModal(false);
            setSelectedApp(null);
          }}
          onConfirm={handleConfirmLeave}
          title="Leave App"
          message={`Are you sure you want to remove yourself as an admin of "${selectedApp.title}"? You will lose access immediately.`}
        />
      )}
    </>
  );
};

export default AppTable;
