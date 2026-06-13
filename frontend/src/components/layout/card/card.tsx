"use client";

import React from 'react';
import { Icon } from '@iconify/react';
import Image from 'next/image';
import { getPromoMonogram } from '@/utils/getPromoMonogram';

interface CardProps {
  title: string;
  imageUrl?: string;
  iconName?: string;
  description: string;
  appUrl: string;
}

function CardBadge({
  title,
  imageUrl,
  iconName,
}: Pick<CardProps, 'title' | 'imageUrl' | 'iconName'>) {
  const badgeClassName =
    'relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#1E293B] to-[#594F7F] ring-1 ring-gray-900/5';

  if (imageUrl) {
    return (
      <div className={badgeClassName} aria-hidden="true">
        <Image src={imageUrl} alt="" fill className="object-cover" sizes="40px" />
      </div>
    );
  }

  if (iconName) {
    return (
      <div className={badgeClassName} aria-hidden="true">
        <Icon icon={iconName} className="h-5 w-5 text-white" />
      </div>
    );
  }

  return (
    <div className={badgeClassName} aria-hidden="true">
      <span className="text-sm font-semibold tracking-tight text-white">
        {getPromoMonogram(title)}
      </span>
    </div>
  );
}

export default function Card({
  title,
  imageUrl,
  iconName,
  description,
  appUrl,
}: CardProps) {
  return (
    <a
      href={appUrl}
      className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <CardBadge title={title} imageUrl={imageUrl} iconName={iconName} />
        <h3 className="line-clamp-2 text-base font-semibold text-gray-900">
          {title}
        </h3>
      </div>

      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-gray-500">
        {description}
      </p>

      <span className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600">
        Launch App
        <span
          aria-hidden="true"
          className="ml-1 transition-transform group-hover:translate-x-0.5"
        >
          &rarr;
        </span>
      </span>
    </a>
  );
}
