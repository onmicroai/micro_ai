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
import { getUserManager, clearSessionPresent } from "@/utils/keycloakAuth";

/**
 * Same isAuthenticated/login/logout shape as context/AuthContext.tsx so a
 * later swap doesn't require touching every consumer's call sites — but
 * login/register collapse into a single login() (Keycloak owns the login
 * *and* registration form; there's nothing left for this app to submit
 * credentials to), and there's no authorizeUserWithJwt equivalent, since
 * oidc-client-ts's signinRedirectCallback() (see app/auth-callback/page.tsx)
 * handles the token exchange internally.
 */
interface KeycloakAuthContextProps {
   isAuthenticated: boolean;
   user: User | null;
   login: (returnTo?: string) => Promise<void>;
   logout: () => Promise<void>;
}

const KeycloakAuthContext = createContext<KeycloakAuthContextProps | undefined>(undefined);

interface KeycloakAuthProviderProps {
   children: ReactNode;
}

export const KeycloakAuthProvider: FC<KeycloakAuthProviderProps> = ({ children }) => {
   const [user, setUser] = useState<User | null>(null);

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

   const logout = useCallback(async (): Promise<void> => {
      clearSessionPresent();
      await getUserManager().signoutRedirect();
   }, []);

   const isAuthenticated = !!user && !user.expired;

   return (
      <KeycloakAuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
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
