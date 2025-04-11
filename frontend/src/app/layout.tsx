import type { Metadata } from "next";
import "@/globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
   title: "Micro AI",
   description: "Build AI-Powered, Instructor-Guided Apps for Education",
   icons: {
      icon: [
         { url: '/img/favicons/favicon.ico' },
         { url: '/img/favicons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
         { url: '/img/favicons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
         { url: '/img/favicons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
         { url: '/img/favicons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [
         { url: '/img/favicons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
   },
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
