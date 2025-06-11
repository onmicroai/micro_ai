"use client";

import PrivateNavbar from "./privateNavbar";
import PublicNavbar from "./publicNavbar";
import { useAuth } from "@/context/AuthContext";

interface NavBarClientSwitchProps {
  showCreateApp?: boolean;
}

export default function NavBarClientSwitch({ showCreateApp }: NavBarClientSwitchProps) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? (
    <PrivateNavbar showCreateApp={showCreateApp} />
  ) : (
    <PublicNavbar />
  );
} 