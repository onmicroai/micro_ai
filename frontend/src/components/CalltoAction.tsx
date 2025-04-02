"use client";

import Image from 'next/image'

import { Button } from '@/components/Button'
import { Container } from '@/components/Container'
import backgroundImage from '@/img/home_background.png'

export function CallToAction() {
  return (
    <section
      id="get-started-today"
      className="relative overflow-hidden bg-blue-600 py-32"
    >
      <Image
        className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
        src={backgroundImage}
        alt=""
        width={2347}
        height={1244}
        unoptimized
      />
      <Container className="relative">
        <div className="mx-auto max-w-lg text-center">
          <h2 className="font-display text-3xl tracking-tight text-white sm:text-4xl">
            Get started with free monthly usage
          </h2>
          <p className="mt-4 text-lg tracking-tight text-white">
            More than an intro offer. Get a generous tier of free usage every month when you sign up. Make today the day you start leveraging AI in pedagogically sound, data-driven ways to improve your classrooms. 
          </p>
          <Button href="/accounts/signup" color="white" className="mt-10">
            Get free monthly usage
          </Button>
        </div>
      </Container>
    </section>
  )
}
