import type { Metadata } from "next";
import DashboardLayout from "./dashboard-layout";
import { ToastContainer } from 'react-toastify';
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
         <DashboardLayout>
            {children}
         </DashboardLayout>
      </>
   );
}