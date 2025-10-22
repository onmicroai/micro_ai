import type { Metadata } from "next";
import { ToastContainer } from 'react-toastify';
import DashboardLayoutClient from "./dashboard-layout-client";

export const metadata: Metadata = {
  title: "Micro AI - Home",
  description: "Build AI-Powered, Instructor-Guided Apps for Education",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ToastContainer />
      <DashboardLayoutClient>
        {children}
      </DashboardLayoutClient>
    </>
  );
}