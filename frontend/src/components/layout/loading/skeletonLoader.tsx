"use client";

import Image from "next/image";
import { LOGO_ALT, LOGO_SRC } from "@/constants/branding";

type SkeletonVariant = 'default' | 'app' | 'builder';

interface SkeletonLoaderProps {
  variant?: SkeletonVariant;
}

export default function SkeletonLoader({ variant = 'default' }: SkeletonLoaderProps) {
  if (variant === 'builder') {
    return (
      <div className="w-full min-h-screen bg-gray-100">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 h-16">
          <div className="flex items-center h-full w-full px-4 relative">
            <div className="flex items-center h-full">
              <Image
                src={LOGO_SRC}
                alt={LOGO_ALT}
                width={175}
                height={56}
                className="w-[175px] h-[56px] object-contain"
                priority
              />
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-gray-100 rounded-lg p-1">
              <div className="h-7 w-16 rounded-md bg-white shadow-sm animate-pulse" />
              <div className="h-7 w-20 rounded-md bg-gray-200 ml-1 animate-pulse" />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="h-7 w-[190px] rounded-full bg-gray-200 animate-pulse" />
              <div className="h-8 w-36 rounded-md bg-gray-200 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex">
          <div className="w-80 bg-white sticky top-16 h-screen flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-white">
              <div className="h-5 w-28 rounded-md bg-gray-200 animate-pulse" />
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
            </div>
            <div className="flex-1 overflow-hidden px-4">
              <div className="space-y-4 py-4">
                <div className="h-20 rounded-lg bg-gray-200 animate-pulse" />
                <div className="h-32 rounded-lg bg-gray-200 animate-pulse" />
                <div className="h-24 rounded-lg bg-gray-200 animate-pulse" />
                <div className="h-24 rounded-lg bg-gray-200 animate-pulse" />
              </div>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="w-full max-w-[900px] px-2 sm:px-4">
              <div className="pt-8 pb-24">
                <div className="mb-4 rounded-lg bg-white p-5 shadow-soft">
                  <div className="h-4 w-24 rounded-md bg-gray-200 animate-pulse" />
                  <div className="mt-4 h-8 w-2/3 rounded-md bg-gray-200 animate-pulse" />
                </div>
                <div className="mb-4 rounded-lg bg-white p-5 shadow-soft">
                  <div className="h-4 w-28 rounded-md bg-gray-200 animate-pulse" />
                  <div className="mt-4 h-24 rounded-md bg-gray-200 animate-pulse" />
                </div>
                <div className="rounded-lg bg-white p-5 shadow-soft">
                  <div className="h-4 w-20 rounded-md bg-gray-200 animate-pulse" />
                  <div className="mt-4 h-16 rounded-md bg-gray-200 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (variant === 'app') {
    return (
      <div className="w-full bg-gray-50 mx-auto p-4">

      <div className="h-screen max-w-3xl mx-auto my-4 bg-gray-200 rounded-xl shadow-md outline outline-1 outline-gray-300 -outline-offset-1 animate-pulse"/>
      
      </div>
    );
  }

  // Default full-width skeleton
  return (
    <div className="flex justify-start w-full">
      <div className="w-full h-24 bg-gray-200 outline outline-1 outline-gray-300 -outline-offset-1 rounded-md animate-pulse" />
    </div>
  );
}