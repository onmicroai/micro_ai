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
import { AppSerialized } from "@/app/(authenticated)/(dashboard)/types";
import { cn } from "@/utils/cn";
import {
  ChartLine,
  Copy,
  PencilIcon,
  Share2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
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
  activeCollectionId: number | null;
  activeTab: string;
}

/** Placeholder metrics - replace with real API when available */
const PLACEHOLDER_METRICS = {
  totalUsage: 0,
  uniqueUsers: 0,
  totalCost: 0,
  avgCostPerUsage: 0,
};

/**
 * AppTable component - Card layout for apps with filtering
 * Default: privacy badge visible. On hover: title turns blue, action icons appear.
 */
const AppTable: React.FC<AppTableProps> = ({
  activeCollectionId,
  activeTab,
}) => {
  const { apps, appLoading, fetchApps, fetchAllApps, cloneApp, deleteApp } =
    useDashboardStore();
  const { user } = useUserStore();
  const currentUserId = Number(user?.id);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AppSerialized | null>(null);
  const api = axiosInstance();

  useEffect(() => {
    const controller = new AbortController();
    if (activeCollectionId === null) {
      fetchAllApps(controller.signal);
    } else {
      fetchApps(activeCollectionId, controller.signal);
    }
    return () => controller.abort();
  }, [activeCollectionId, fetchApps, fetchAllApps]);

  const filteredApps = apps
    .filter(
      (app) => activeTab === "all" || app?.privacy?.toLowerCase() === activeTab
    )
    .sort((a, b) => a.id - b.id);

  const getPrivacyBadge = (privacy: string) => {
    const privacyLower = privacy.toLowerCase();
    const baseClasses =
      "inline-flex items-center px-2.5 py-1 text-sm font-medium rounded-full";
    const colorClasses = {
      public:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      private: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      restricted:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    };
    return `${baseClasses} ${
      colorClasses[privacyLower as keyof typeof colorClasses] ||
      colorClasses.private
    }`;
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

  const formatMetrics = () => {
    const { totalUsage, uniqueUsers, totalCost, avgCostPerUsage } =
      PLACEHOLDER_METRICS;

    return (
      <div className="flex items-center gap-3">
        <span>{`Total usage: ${totalUsage}`}</span>
        <span>▪</span>
        <span>{`Unique users: ${uniqueUsers}`}</span>
        <span>▪</span>
        <span>{`Total cost (Credits): ${totalCost}`}</span>
        <span>▪</span>
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
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No apps found in this collection.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {filteredApps.map((app) => (
          <div
            key={app.id}
            className="group relative rounded-lg bg-white p-5 shadow-sm transition-colors dark:bg-gray-800"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left: Title + metrics */}
              <div className="min-w-0 flex-1">
                {/* Title - turns blue on hover */}
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

                {/* Metrics line */}
                <p className="mt-5 text-sm text-gray-400">{formatMetrics()}</p>
              </div>

              {/* Right: Privacy badge + action icons (under badge on hover) */}
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-1">
                  {/* Privacy badge - always visible */}
                  <span className={getPrivacyBadge(app.privacy)}>
                    {getPrivacyName(app.privacy)}
                  </span>
                  {/* Mobile: always-visible hamburger menu */}
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

                {/* Action icons - appear on hover below badge (desktop only) */}
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
        ))}
      </div>

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
