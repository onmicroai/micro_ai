"use client";

import React, { createContext, useContext } from "react";

/**
 * True when AppRuntimeView is the builder Preview shell (`showEditLink={false}`).
 * Drives `is_preview` on /run. Defaults to false when no provider (public app, embed).
 */
const RuntimePreviewContext = createContext(false);

export function RuntimePreviewProvider({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return (
    <RuntimePreviewContext.Provider value={value}>
      {children}
    </RuntimePreviewContext.Provider>
  );
}

export function useRuntimePreview(): boolean {
  return useContext(RuntimePreviewContext);
}
