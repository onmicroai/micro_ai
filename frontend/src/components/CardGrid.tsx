"use client";

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import Card from '@/components/layout/card/card'
import Button from '@/components/modules/button/button'
import { Container } from '@/components/Container'
import { buttonTypes } from '@/constants'

interface CardData {
  hashId?: string;
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
  const router = useRouter()

  return (
    <section
      id="try-now"
      aria-label="Try sample apps"
      className="relative overflow-hidden bg-slate-50 py-24 sm:py-32"
    >
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-gray-900 sm:text-6xl">
            See what your students would see
          </h2>
          <p className="mt-6 text-pretty text-lg font-medium text-gray-600 sm:text-xl/8">
            Browse sample apps. No sign-up needed. Like one? Remix it and make it your own.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card
              key={card.hashId ?? card.appUrl}
              title={card.title}
              iconName={card.iconName}
              imageUrl={card.imageUrl}
              description={card.description}
              appUrl={card.appUrl}
              ctaLabel="Try it"
              ctaVariant="button"
            />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/library"
            className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Browse the library <span aria-hidden="true" className="ml-1">&rarr;</span>
          </Link>
        </div>

        {/* Sign-up call, folded in from the old standalone CTA section */}
        <div className="mx-auto mt-20 flex max-w-6xl flex-col items-center gap-6 rounded-2xl bg-slate-900 px-6 py-10 text-center sm:px-12 lg:flex-row lg:justify-between lg:text-left">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Ready to build your own?
            </h3>
            <p className="mt-2 text-base text-blue-100 sm:text-lg">
              Every account includes free monthly usage.
            </p>
          </div>
          <div className="shrink-0">
            <Button
              type={buttonTypes.primary}
              text="Get started for free"
              onClick={() => router.push('/accounts/registration')}
            />
          </div>
        </div>
      </Container>
    </section>
  )
}
