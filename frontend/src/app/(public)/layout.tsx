import Footer from "@/components/layout/footer/footer";
import NavBarClientSwitch from "@/components/layout/navbar/NavBarClientSwitch";
import { ToastContainer } from 'react-toastify';
import { PLATFORM_NAME } from "@/constants/branding";

export const metadata = {
   title: PLATFORM_NAME,
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
         {/* Initial render will show PublicNavbar; client component will switch when auth state loads */}
         <NavBarClientSwitch />
         {children ? children : <div></div>}
         <Footer />
      </>
   );
}