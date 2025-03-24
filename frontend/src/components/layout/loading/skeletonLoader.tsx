"use client";

type SkeletonVariant = 'default' | 'app';

interface SkeletonLoaderProps {
  variant?: SkeletonVariant;
}

export default function SkeletonLoader({ variant = 'default' }: SkeletonLoaderProps) {
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