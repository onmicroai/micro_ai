// \microai-frontend\components\layout\navbar\navbar.tsx

"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import UserButton from "@/components/modules/user-button/userButton";
import AuthButtons from "./authButtons";
import { LOGO_ALT, LOGO_SRC } from "@/constants/branding";
import { useUserStore } from "@/store/userStore";

const SCROLL_THRESHOLD = 32;

function AuthUserButtons({ isHomePage }: { isHomePage?: boolean }) {
   const { user } = useUserStore();

   return (
      <>
         {user ? (
            <UserButton />
         ) : (
            <div className="flex gap-2">
               <AuthButtons variant={isHomePage ? "light" : undefined} />
            </div>
         )}
      </>
   );
}

interface PublicNavbarProps {
   isHomePage?: boolean;
}

export default function PublicNavbar({ isHomePage = false }: PublicNavbarProps) {
   const [hasScrolled, setHasScrolled] = useState(false);

   useEffect(() => {
      if (!isHomePage) return;
      const onScroll = () => setHasScrolled(window.scrollY > SCROLL_THRESHOLD);
      onScroll(); // run once in case page loads scrolled
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
   }, [isHomePage]);

   const navClasses = isHomePage
      ? "fixed top-0 left-0 right-0 z-50 border-b border-white/10 transition-colors duration-300"
      : "bg-white border-b border-gray-200 dark:bg-black-dark";

   const linkClasses = isHomePage
      ? "text-white/90 hover:text-white"
      : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white";

   const logoClasses = isHomePage
      ? "h-5 w-auto brightness-0 invert"
      : "h-5 w-auto";

   return (
      <nav className={navClasses}>
         {/* Fade-in dark purple background when scrolled (home page only) */}
         {isHomePage && (
            <div
               className={`absolute inset-0 bg-slate-900  transition-opacity duration-300 -z-10 ${
                  hasScrolled ? "opacity-100" : "opacity-0"
               }`}
               aria-hidden
            />
         )}
         <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
               <div>
                  <Link href="/">
                     <Image
                        src={LOGO_SRC}
                        alt={LOGO_ALT}
                        width={150}
                        height={40}
                        className={logoClasses}
                        priority
                     />
                  </Link>
               </div>

               <div className="flex items-center gap-6">
                  {/* Navigation menu - hidden on mobile */}
                  <ul className="hidden md:flex items-center space-x-8">
                     <li>
                        <a href="/what-are-ai-microapps/" className={linkClasses}>
                           What are MicroApps?
                        </a>
                     </li>
                     <li>
                        <a href="/pricing/" className={linkClasses}>
                           Pricing
                        </a>
                     </li>
                     <li>
                        <a href="/about/" className={linkClasses}>
                           About
                        </a>
                     </li>
                  </ul>

                  {/* Login/Signup section */}
                  <AuthUserButtons isHomePage={isHomePage} />
               </div>
            </div>
         </div>
      </nav>
   );
}