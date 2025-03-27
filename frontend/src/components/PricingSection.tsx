"use client";

import { PricingCards } from "./PricingCards";

export function PricingSection() {
  return (
    <div className="mx-auto mt-16 mb-32 max-w-7xl px-6 sm:mt-32 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-base/7 font-semibold text-indigo-600">Pricing</h1>
        <p className="mt-2 text-balance text-5xl font-semibold tracking-tight text-gray-900 sm:text-6xl">
          Smart Pricing
        </p>
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-pretty text-center text-lg font-medium text-gray-600 sm:text-xl/8">
        No more paying for a license for every user. Start with a generous free
        tier, then only pay for the users who are creating apps.
      </p>
      <PricingCards />
    </div>
  );
}
