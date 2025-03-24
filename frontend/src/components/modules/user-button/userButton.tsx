"use client";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import axiosInstance from "@/utils//axiosInstance";
import { useAuth } from "@/context/AuthContext";
import { useUserStore } from "@/store/userStore";

const routes = [
   { name: "Dashboard", path: "/dashboard" },
];

export default function UserButton() {
   const [open, setOpen] = useState(false);
   const router = useRouter();
   const pathname = usePathname();
   const { logout, isAuthenticated } = useAuth();
   const { user } = useUserStore();
   const menuRef = useRef<HTMLDivElement | null>(null);
   const [totalCredits, setTotalCredits] = useState<number | null>(null);
   const api = axiosInstance();

   const fetchCredits = useCallback(async (abortSignal: AbortSignal) => {
      try {
         const response = await api.get(`/api/microapps/user/billing`, {
            signal: abortSignal
         });
         const billingDetails = response.data.billing_details;
         const creditsRemaining = billingDetails?.[0]?.credits_remaining || 0;
         const topUpCredits = response.data.top_up_credits || 0;
         setTotalCredits(creditsRemaining + topUpCredits);
      } catch (error: unknown) {
         const errorName = error && typeof error === 'object' && 'name' in error ? error.name : null;
         if (errorName && errorName !== 'AbortError' && errorName !== 'CanceledError') {
            console.error('Error fetching credits:', error);
         }
      }
   }, [api]);

   useEffect(() => {
      // Only fetch credits if user is authenticated
      if (isAuthenticated) {
         const abortController = new AbortController();
         fetchCredits(abortController.signal);

         return () => abortController.abort();
      } else {
         setTotalCredits(null);
      }
   }, [fetchCredits, isAuthenticated]);

   /**
    * Logout the user
    * @returns {Promise<void>}
    */
   const handleLogout = async () => {
      try {
         setTotalCredits(null); // Clear credits before logout
         await logout();
      } catch (error) {
         console.error('Logout error:', error);
      }
   };

   // Close menu when clicking outside or ESC button
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setOpen(false);
         }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
         if (event.key === "Escape") {
            setOpen(false);
         }
      };

      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
         document.removeEventListener("mousedown", handleClickOutside);
         document.removeEventListener("keydown", handleKeyDown);
      };
   }, [menuRef]);

   return (
      <div 
         className="relative inline-block text-left"
         ref={menuRef}
         onClick={() => setOpen(!open)}
      >
         <div className="hidden md:flex items-center">
            <button
               className={`flex items-center justify-center w-8 h-8 rounded-full overflow-hidden hover:ring-2 hover:ring-gray-200 focus:outline-none ${
                  open ? 'ring-2 ring-gray-200' : ''
               }`}
               onClick={() => setOpen(!open)}
            >
               <Image
                  src={user?.profilePic || "/profile-pic.png"}
                  width={24}
                  height={24}
                  alt="Profile picture"
                  className="rounded-full object-cover"
                  style={{ width: '100%', height: '100%' }}
               />
            </button>
         </div>

         <div className="md:hidden">
            <button
               className={`flex flex-col justify-center items-center w-8 h-8 space-y-1.5 ${
                  open ? 'opacity-50' : ''
               }`}
               onClick={() => setOpen(!open)}
            >
               <div className="w-5 h-0.5 bg-gray-600"></div>
               <div className="w-5 h-0.5 bg-gray-600"></div>
               <div className="w-5 h-0.5 bg-gray-600"></div>
            </button>
         </div>

         <div className={`absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50
            ${open ? 'block' : 'hidden'} transition-all duration-200 ease-in-out`}>
            <ul className="py-1">
               {routes.map((route, index) => (
                  <li
                     key={index}
                     className={`${
                        pathname == route.path ? 'bg-gray-100' : ''
                     }`}
                  >
                     <button
                        onClick={() => {
                           router.push(route.path);
                           setOpen(false);
                        }}
                        className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                     >
                        {route.name}
                     </button>
                  </li>
               ))}
               <li>
                  <button 
                     onClick={() => {
                        router.push('/settings/subscription');
                        setOpen(false);
                     }}
                     className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                  >
                     Subscription
                  </button>
               </li>
               <li>
                  <button 
                     onClick={() => {
                        router.push('/settings/profile');
                        setOpen(false);
                     }}
                     className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                  >
                     Profile
                  </button>
               </li>
               <li>
                  <button 
                     onClick={async () => {
                        await handleLogout();
                        setOpen(false);
                     }}
                     className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                  >
                     Logout
                  </button>
               </li>
               <li>
                  <hr className="border-t border-gray-200 my-2" />
               </li>
               <li>
                  <span className="block px-4 py-2 text-sm text-gray-900 font-semibold">Credits: {totalCredits ?? '-'}</span>
               </li>
            </ul>
         </div>
      </div>
   );
}
