"use client";

import { usePathname } from "next/navigation";
import PrivateNavbar from "./privateNavbar";
import PublicNavbar from "./publicNavbar";
import { useAuth } from "@/context/AuthContext";

interface NavBarClientSwitchProps {
  showCreateApp?: boolean;
}

export default function NavBarClientSwitch({ showCreateApp }: NavBarClientSwitchProps) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const isHomePage = pathname === "/";

  return isAuthenticated ? (
    <PrivateNavbar showCreateApp={showCreateApp} isHomePage={isHomePage} />
  ) : (
    <PublicNavbar isHomePage={isHomePage} />
  );
} 