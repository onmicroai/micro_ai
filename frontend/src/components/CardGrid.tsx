"use client";

import Card from '@/components/layout/card/card'

interface CardData {
  title: string;
  imageUrl?: string;
  iconName?: string;
  description: string;
  appUrl: string;
}

interface CardGridProps {
  cards: CardData[];
}

export function CardGrid({ cards }: CardGridProps) {
  return (
    <section
      id="try-now"
      aria-label="Try Sample Micro Apps"
      className="relative overflow-hidden bg-white pb-28 pt-20 sm:py-32"
    >
        <div className="max-w-2xl md:mx-auto md:text-center xl:max-w-none">
          <h2 className="mt-2 text-balance text-5xl font-semibold tracking-tight text-gray-900 sm:text-6xl">
            Try it out in 3...2...1...
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-center text-lg font-medium text-gray-600 sm:text-xl/8">
            Try a popular app. Clone and customize it for yourself. 
          </p>
        </div>
    <div className="mt-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => (
          <Card
            key={index}
            title={card.title}
            iconName={card.iconName}
            imageUrl={card.imageUrl}
            description={card.description}
            appUrl={card.appUrl}
          />
        ))}
      </div>
    </div>
    </section>
  )
}