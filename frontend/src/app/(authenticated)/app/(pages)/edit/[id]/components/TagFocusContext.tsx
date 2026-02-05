"use client";

import React, { createContext, useContext } from "react";

type TagFocusContextValue = {
  isTagFocusActive: boolean;
};

const TagFocusContext = createContext<TagFocusContextValue | undefined>(
  undefined,
);

export const TagFocusProvider = ({
  isTagFocusActive,
  children,
}: TagFocusContextValue & { children: React.ReactNode }) => (
  <TagFocusContext.Provider value={{ isTagFocusActive }}>
    {children}
  </TagFocusContext.Provider>
);

export const useTagFocusContext = () => {
  const context = useContext(TagFocusContext);
  if (!context) {
    return { isTagFocusActive: false };
  }
  return context;
};
