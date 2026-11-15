"use client";

import { useEffect, useState } from "react";
import { Hero } from '@/components/Hero'
import { LogoCloud } from '@/components/LogoCloud'
import { PrimaryFeatures } from '@/components/PrimaryFeatures'
import { CardGrid } from '@/components/CardGrid'
import { CallToAction } from '@/components/CalltoAction'
import { PricingSection } from '@/components/PricingSection'
import { fetchPromotedApps, PromotedApp } from '@/utils/fetchPromotedApps'

export default function Home() {
  const [cards, setCards] = useState<PromotedApp[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchPromotedApps(3).then((apps) => {
      if (!cancelled) {
        setCards(apps);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <main>
        <Hero />
        <LogoCloud />
        <PrimaryFeatures />
        {/* CardGrid ends with its own sign-up call; fall back to the standalone CTA
            when no apps are promoted. */}
        {cards.length > 0 ? <CardGrid cards={cards} /> : <CallToAction />}
        <PricingSection />
      </main>
    </>
  )
}
