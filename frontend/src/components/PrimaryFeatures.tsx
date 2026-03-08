'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import clsx from 'clsx'
import {
  CubeTransparentIcon,
  ShareIcon,
  AcademicCapIcon,
  ChartBarIcon,
  CpuChipIcon,
} from '@heroicons/react/20/solid'

import { Container } from '@/components/Container'

const features = [
  {
    title: 'Build precision apps, not generic chats.',
    description:
      "Design focused workflows and structured interactions instead of open-ended chat. Control inputs, outputs, and pedagogy so every app does exactly what you need.",
    image: '/img/homepage/case_study.png',
    icon: CubeTransparentIcon,
  },
  {
    title: 'Share with anyone.',
    description:
      "Publish apps to colleagues, students, or the public with a single link. No login or licenses required from your users.",
    image: '/img/homepage/donnas/3.png',
    icon: ShareIcon,
  },
  {
    title: 'Integrate with your LMS.',
    description:
      "Embed apps in Canvas, Moodle, Blackboard, or any LTI-compatible platform. Keep everything in one place and sync grades and access automatically.",
    image: '/img/homepage/case_study_lms_sm.png',
    icon: AcademicCapIcon,
  },
  {
    title: 'Observe usage for continuous improvement.',
    description:
      'Track usage, cost, satisfaction, and accuracy so you can see where AI helps most and refine prompts and flows over time.',
    image: '/img/homepage/app_stats.png',
    icon: ChartBarIcon,
  },
  {
    title: 'Use any model.',
    description:
      'Use your favorite models from Claude, Gemini, OpenAI and others. New models are added regularly as they are released.',
    image: '/img/homepage/registration-bg.png',
    icon: CpuChipIcon,
  },
]

export function PrimaryFeatures() {
  const [tabOrientation, setTabOrientation] = useState<'horizontal' | 'vertical'>(
    'horizontal',
  )

  useEffect(() => {
    const lgMediaQuery = window.matchMedia('(min-width: 1024px)')

    function onMediaQueryChange({ matches }: { matches: boolean }) {
      setTabOrientation(matches ? 'vertical' : 'horizontal')
    }

    onMediaQueryChange(lgMediaQuery)
    lgMediaQuery.addEventListener('change', onMediaQueryChange)

    return () => {
      lgMediaQuery.removeEventListener('change', onMediaQueryChange)
    }
  }, [])

  return (
    <section
      id="features"
      aria-label="Features for running your books"
      className="relative overflow-hidden pb-28 sm:py-32"
    >
      {/* Solid dark continuation of Hero — no second gradient, smooth transition */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900 to-blue-950"
        aria-hidden="true"
      />

      <Container className="relative">
        <div className="max-w-2xl md:mx-auto md:text-center xl:max-w-none">
          <h2 className="mt-2 text-5xl tracking-tight font-semibold text-white sm:text-6xl">
          Go Where LLMs Can't
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-center text-lg font-medium tracking-tight text-blue-100 sm:text-xl/8">
          Generic Chatbots and custom GPTs can make it hard to create repeatable experiences, and impossible to track usage and outcomes.
          </p>
        </div>
        <TabGroup
          className="mt-16 grid grid-cols-1 items-center gap-y-2 pt-10 sm:gap-y-6 md:mt-20 lg:grid-cols-12 lg:pt-0"
          vertical={tabOrientation === 'vertical'}
        >
          {({ selectedIndex }) => (
            <>
              <div className="-mx-4 flex overflow-x-auto pb-4 sm:mx-0 sm:overflow-visible sm:pb-0 lg:col-span-5">
                <TabList className="relative z-10 flex gap-x-4 whitespace-nowrap px-4 sm:mx-auto sm:px-0 lg:mx-0 lg:block lg:gap-x-0 lg:gap-y-1 lg:whitespace-normal">
                  {features.map((feature, featureIndex) => {
                    const Icon = feature.icon
                    return (
                    <div
                      key={feature.title}
                      className={clsx(
                        'group relative rounded-full px-4 py-1 lg:rounded-l-xl lg:rounded-r-none lg:p-6',
                        selectedIndex === featureIndex
                          ? 'bg-white lg:bg-white/10 lg:ring-1 lg:ring-inset lg:ring-white/10'
                          : 'hover:bg-white/10 lg:hover:bg-white/5',
                      )}
                    >
                      <h3>
                        <Tab
                          className={clsx(
                            'font-display text-lg ui-not-focus-visible:outline-none flex items-center gap-2',
                            selectedIndex === featureIndex
                              ? 'text-blue-600 lg:text-white'
                              : 'text-blue-100 hover:text-white lg:text-white',
                          )}
                        >
                          <span className="absolute inset-0 rounded-full lg:rounded-l-xl lg:rounded-r-none" />
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
                            <Icon className="size-5" />
                          </span>
                          {feature.title}
                        </Tab>
                      </h3>
                      <p
                        className={clsx(
                          'mt-2 hidden text-sm lg:block',
                          selectedIndex === featureIndex
                            ? 'text-white'
                            : 'text-blue-100 group-hover:text-white',
                        )}
                      >
                        {feature.description}
                      </p>
                    </div>
                    )
                  })}
                </TabList>
              </div>
              <TabPanels className="lg:col-span-7">
                {features.map((feature) => (
                  <TabPanel key={feature.title} unmount={false}>
                    <div className="relative sm:px-6 lg:hidden">
                      <div className="absolute -inset-x-4 bottom-[-4.25rem] top-[-6.5rem] bg-white/10 ring-1 ring-inset ring-white/10 sm:inset-x-0 sm:rounded-t-xl" />
                      <p className="relative mx-auto max-w-2xl text-base text-white sm:text-center">
                        {feature.description}
                      </p>
                    </div>
                    <div className="mt-10 w-[45rem] overflow-hidden rounded-xl bg-slate-50 shadow-xl shadow-blue-900/20 sm:w-auto lg:mt-0 lg:w-[67.8125rem]">
                      <div className="relative aspect-[16/9]">
                        <Image
                          className="object-cover object-top"
                          src={feature.image}
                          alt=""
                          priority
                          fill
                          sizes="(min-width: 1024px) 67.8125rem, (min-width: 640px) 100vw, 45rem"
                        />
                      </div>
                    </div>
                  </TabPanel>
                ))}
              </TabPanels>
            </>
          )}
        </TabGroup>
      </Container>
    </section>
  )
}
