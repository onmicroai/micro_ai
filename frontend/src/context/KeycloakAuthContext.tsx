"use client";

import {
   createContext,
   FC,
   ReactNode,
   useCallback,
   useContext,
   useEffect,
   useState,
} from "react";
import type { User } from "oidc-client-ts";
import { getUserManager, clearSessionPresent, redirectToRegister } from "@/utils/keycloakAuth";
import { useUserStore } from "@/store/userStore";

/**
 * Same isAuthenticated/login/logout shape as context/AuthContext.tsx so a
 * later swap doesn't require touching every consumer's call sites. Keycloak
 * owns both forms, so there's no authorizeUserWithJwt equivalent — oidc-
 * client-ts's signinRedirectCallback() (see app/auth-callback/page.tsx)
 * handles the token exchange internally regardless of which form the user
 * came back from.
 */
interface KeycloakAuthContextProps {
   isAuthenticated: boolean;
   user: User | null;
   login: (returnTo?: string) => Promise<void>;
   register: (returnTo?: string) => Promise<void>;
   logout: () => Promise<void>;
}

const KeycloakAuthContext = createContext<KeycloakAuthContextProps | undefined>(undefined);

interface KeycloakAuthProviderProps {
   children: ReactNode;
}

export const KeycloakAuthProvider: FC<KeycloakAuthProviderProps> = ({ children }) => {
   const [user, setUser] = useState<User | null>(null);
   // The old cookie-based AuthProvider bridged "credentials look valid" to
   // "go fetch the Django profile" via this same store — this is the
   // Keycloak-shaped equivalent of that bridge. Without it, useUserStore's
   // `user` never populates (nothing else calls its getUser()), which
   // silently breaks anything reading Django profile fields — e.g.
   // settings/profile's form staying empty even while genuinely
   // authenticated at the Keycloak level.
   const djangoUser = useUserStore((state) => state.user);
   const getDjangoUser = useUserStore((state) => state.getUser);

   useEffect(() => {
      if (typeof window === "undefined") return;

      const userManager = getUserManager();
      let cancelled = false;

      userManager.getUser().then((storedUser) => {
         if (!cancelled) setUser(storedUser);
      });

      const onUserLoaded = (loadedUser: User) => setUser(loadedUser);
      const onUserUnloaded = () => setUser(null);

      userManager.events.addUserLoaded(onUserLoaded);
      userManager.events.addUserUnloaded(onUserUnloaded);

      return () => {
         cancelled = true;
         userManager.events.removeUserLoaded(onUserLoaded);
         userManager.events.removeUserUnloaded(onUserUnloaded);
      };
   }, []);

   const login = useCallback(async (returnTo?: string): Promise<void> => {
      await getUserManager().signinRedirect({ state: returnTo });
   }, []);

   const register = useCallback(async (returnTo?: string): Promise<void> => {
      await redirectToRegister(returnTo);
   }, []);

   const logout = useCallback(async (): Promise<void> => {
      clearSessionPresent();
      await getUserManager().signoutRedirect();
   }, []);

   const isAuthenticated = !!user && !user.expired;

   useEffect(() => {
      if (!isAuthenticated || djangoUser !== null) return;
      const controller = new AbortController();
      getDjangoUser(controller.signal);
      return () => controller.abort();
   }, [isAuthenticated, djangoUser, getDjangoUser]);

   return (
      <KeycloakAuthContext.Provider value={{ isAuthenticated, user, login, register, logout }}>
         {children}
      </KeycloakAuthContext.Provider>
   );
};

export const useKeycloakAuth = (): KeycloakAuthContextProps => {
   const context = useContext(KeycloakAuthContext);
   if (!context) {
      throw new Error("useKeycloakAuth must be used within a KeycloakAuthProvider");
   }
   return context;
};
