"use client";
import UserMenuDropdown from "@/components/modules/user-menu-dropdown";

/**
 * User button component for navbar
 * Uses the shared UserMenuDropdown component
 */
export default function UserButton() {
   return <UserMenuDropdown mode="navbar" />;
}
