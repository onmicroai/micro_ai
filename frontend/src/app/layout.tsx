import type { Metadata } from "next";
import "@/globals.css";
import { AuthProvider } from "@/context/AuthContext";

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
      <html lang="en">
         <body>
            <AuthProvider>
               {children}
            </AuthProvider>
         </body>
      </html>
   );
}
