// \microai-frontend\components\layout\navbar\navbar.tsx

"use client";
import Image from "next/image";
import Link from "next/link";
import UserButton from "@/components/modules/user-button/userButton";
import AuthButtons from "./authButtons";
import Logo from "@/img/logos/onMicroAI_logo_horiz_color-cropped.svg";
import { useUserStore } from "@/store/userStore";

function AuthUserButtons() {
   const { user } = useUserStore();

   return (
      <>
         {user ? (
            <UserButton />
         ) : (
            <div className="flex gap-2">
               <AuthButtons />
            </div>
         )}
      </>
   );
}

export default function PublicNavbar() {
   return (
      <nav className="bg-white border-b border-gray-200 dark:bg-black-dark">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
               <div>
                  <Link href="/">
                     <Image 
                        src={Logo} 
                        alt="Micro AI" 
                        width={150} 
                        height={40}
                        className="h-5 w-auto"
                        priority
                     />
                  </Link>
               </div>
               
               <div className="flex items-center gap-6">
                  {/* Navigation menu - hidden on mobile */}
                  <ul className="hidden md:flex items-center space-x-8">
                     <li>
                        <a href="/what-are-ai-microapps/" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                           What are MicroApps?
                        </a>
                     </li>
                     <li>
                        <a href="/pricing/" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                           Pricing
                        </a>
                     </li>
                     <li>
                        <a href="/about/" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                           About
                        </a>
                     </li>
                  </ul>

                  {/* Login/Signup section */}
                     <AuthUserButtons />

               </div>
            </div>
         </div>
      </nav>
   );
}