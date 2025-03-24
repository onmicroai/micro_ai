import type { Metadata } from "next";
import Footer from "@/components/layout/footer/footer";
import PublicNavbar from "@/components/layout/navbar/publicNavbar";
import { ToastContainer } from 'react-toastify';

export const metadata: Metadata = {
   title: "Micro AI",
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
         <PublicNavbar/>
         {children ? children : <div></div>}
         <Footer />
      </>
   );
}