"use client";

import { PricingCards } from "./PricingCards";

interface PricingSectionProps {
  /** Use "h1" when this section is the page's main heading (e.g. /pricing). */
  headingLevel?: "h1" | "h2";
}

export function PricingSection({ headingLevel = "h2" }: PricingSectionProps) {
  const Heading = headingLevel;
  return (
    <div className="mx-auto mt-16 mb-32 max-w-7xl px-6 sm:mt-32 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-base/7 font-semibold text-indigo-600">Pricing</p>
        <Heading className="mt-2 text-balance text-4xl font-semibold tracking-tight text-gray-900 sm:text-6xl">
          Pay for creators, not students
        </Heading>
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-pretty text-center text-lg font-medium text-gray-600 sm:text-xl/8">
        Plans that start at free with no per-student licenses.
      </p>
      <PricingCards />
    </div>
  );
}
