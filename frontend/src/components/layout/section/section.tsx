"use client";

import { sectionTypes } from "@/constants";

export default function Section({
  children,
  type,
  style,
}: {
  children: React.ReactNode;
  type?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={` ${
        type === sectionTypes.dashboard
      }`}
    >
      <div
        style={style}
        className={` ${
          type === sectionTypes.fullWidth
        } ${type === sectionTypes.last } ${
          type === sectionTypes.library 
        } ${type === sectionTypes.account } ${
          type === sectionTypes.dashboard
        }`}
      >
        {children}
      </div>
    </div>
  );
}
