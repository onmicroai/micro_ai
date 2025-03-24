"use client";

import React from 'react';
import { Icon } from '@iconify/react';
import Image from 'next/image';

interface CardProps {
  title: string;
  imageUrl?: string;
  iconName?: string;
  description: string;
  appUrl: string;
}

export default function Card({ title, imageUrl, iconName, description, appUrl }: CardProps) {
  return (
    <a 
      href={appUrl}
      className="block overflow-hidden rounded-lg bg-white shadow hover:shadow-lg transition-shadow"
    >
      <div className="relative w-full">
        <div className="absolute inset-0">
          {imageUrl ? (
            <Image 
              src={imageUrl} 
              alt={title} 
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : iconName && (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1E293B] to-[#594F7F]">
              <Icon 
                icon={iconName} 
                className="w-auto h-[90%] text-white" 
              />
            </div>
          )}
        </div>
        <div className="pt-[56.25%]"></div>
      </div>
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      </div>
      <div className="px-4 py-5 sm:p-6">
        <p className="text-gray-500">{description}</p>
      </div>
      <div className="px-4 py-4 sm:px-6">
        <span
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Launch App <span aria-hidden="true">&rarr;</span>
        </span>
      </div>
    </a>
  )
}
