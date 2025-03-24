"use client";

import React from 'react';
import Link from 'next/link';
import { BookOpen, Mail, School } from 'lucide-react';

const WaitlistMessage = () => {
   return (
      <div className="bg-white dark:bg-black-dark py-16 sm:py-24">
         <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
            <div className="relative isolate overflow-hidden bg-slate-800 px-6 py-24 shadow-2xl sm:rounded-3xl sm:px-24 xl:py-32">
               <h2 className="mx-auto max-w-3xl text-center text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  You are on the waitlist!
               </h2>
               <p className="mx-auto mt-6 max-w-lg text-center text-lg text-gray-300">
                  Currently, we are performing alpha testing and running private pilots with educational institutions. We hope to be available to everyone in early 2025.
               </p>
               <p className="mx-auto mt-6 max-w-lg text-center text-lg text-gray-300">
                  Here is what you can do while you wait:
               </p>
               
               <div className="mx-auto mt-10 max-w-2xl">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                     <Link 
                        href="/library"
                        className="flex flex-col items-center p-6 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                     >
                        <BookOpen className="w-8 h-8 text-white mb-3" />
                        <h3 className="text-white font-semibold">App Library</h3>
                        <p className="text-gray-300 text-sm text-center mt-2">
                           Check out our library of sample apps
                        </p>
                     </Link>

                     <a 
                        href="mailto:alphatesting@onmicro.ai"
                        className="flex flex-col items-center p-6 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                     >
                        <Mail className="w-8 h-8 text-white mb-3" />
                        <h3 className="text-white font-semibold">Alpha Testing</h3>
                        <p className="text-gray-300 text-sm text-center mt-2">
                           Apply to be an Alpha Tester
                        </p>
                     </a>

                     <a 
                        href="mailto:pilots@onmicro.ai"
                        className="flex flex-col items-center p-6 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                     >
                        <School className="w-8 h-8 text-white mb-3" />
                        <h3 className="text-white font-semibold">Private Pilots</h3>
                        <p className="text-gray-300 text-sm text-center mt-2">
                           Apply for a private pilot
                        </p>
                     </a>
                  </div>
               </div>

               <svg
                  viewBox="0 0 1024 1024"
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 -z-10 size-[64rem] -translate-x-1/2"
               >
                  <circle cx={512} cy={512} r={512} fill="url(#gradient)" fillOpacity="0.7" />
                  <defs>
                     <radialGradient
                        id="gradient"
                        cx={0}
                        cy={0}
                        r={1}
                        gradientUnits="userSpaceOnUse"
                        gradientTransform="translate(512 512) rotate(90) scale(512)"
                     >
                        <stop stopColor="#5C5EF1" />
                        <stop offset={1} stopColor="#E935C1" stopOpacity={0} />
                     </radialGradient>
                  </defs>
               </svg>
            </div>
         </div>
      </div>
   );
};

export default WaitlistMessage; 