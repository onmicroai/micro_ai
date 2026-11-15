import Image from 'next/image'
import clsx from 'clsx'
import { Check, Minus } from 'lucide-react'
import {
  CubeTransparentIcon,
  ShareIcon,
  AcademicCapIcon,
  ChartBarIcon,
  CpuChipIcon,
} from '@heroicons/react/20/solid'

import { Container } from '@/components/Container'
import { PLATFORM_NAME } from '@/constants/branding'

// `gpts`: whether Custom GPTs & Gems also offer this. Our column is always a check.
const comparison = [
  { label: 'Purpose-built from your instructions and knowledge', gpts: true },
  { label: 'Guided, step-by-step activities, not just open chat', gpts: false },
  { label: "Students don't need an AI account", gpts: false },
  { label: 'Integrates with your LMS', gpts: false },
  { label: 'See how students use it', gpts: false },
  { label: 'Choose any AI model', gpts: false },
]

type Feature = {
  title: string
  description: string
  icon: typeof ShareIcon
  image: string
  imageClassName?: string
  className?: string
}

const features: Feature[] = [
  {
    title: 'Build precision apps, not just chats.',
    description:
      'Design focused, step-by-step activities instead of just open-ended chat. You control the inputs, the outputs, and the pedagogy.',
    icon: CubeTransparentIcon,
    image: '/img/homepage/case_study.png',
    imageClassName: 'object-left-top',
    className: 'lg:col-span-2',
  },
  {
    title: 'Share with anyone.',
    description:
      'Publish to colleagues, students, or the public with a single link. No logins or licenses for your users.',
    icon: ShareIcon,
    image: '/img/homepage/donnas/3.png',
    imageClassName: 'object-center',
  },
  {
    title: 'Integrate with your LMS.',
    description:
      'Embed apps in Canvas, Moodle, Blackboard, or any LTI-compatible platform.',
    icon: AcademicCapIcon,
    image: '/img/homepage/case_study_lms_sm.png',
    imageClassName: 'object-center',
  },
  {
    title: 'See what is working.',
    description:
      'Track usage, cost, satisfaction, and accuracy, then refine your app over time.',
    icon: ChartBarIcon,
    image: '/img/homepage/app_stats.png',
    imageClassName: 'object-left-top',
    className: 'lg:col-span-2',
  },
]

const models = ['Claude', 'Gemini', 'GPT']

function FeatureHeading({ icon: Icon, title }: { icon: Feature['icon']; title: string }) {
  return (
    <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
      <Icon className="h-5 w-5 shrink-0 text-blue-300" aria-hidden="true" />
      {title}
    </h3>
  )
}

export function PrimaryFeatures() {
  return (
    <section
      id="features"
      aria-label="Why educators choose us over custom GPTs"
      className="relative overflow-hidden py-24 sm:py-32"
    >
      <div
        className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900 to-blue-950"
        aria-hidden="true"
      />

      <Container className="relative">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Shareable Apps, with Pedagogical Insights
          </h2>
          <p className="mt-6 text-pretty text-lg font-medium tracking-tight text-blue-100 sm:text-xl/8">
            Always on, AI powered experiences are just the start. We've also added the tools and security that teachers need to bring them into the classroom. 
          </p>
        </div>

        {/* Comparison */}
        <div className="mx-auto mt-14 max-w-3xl overflow-hidden rounded-2xl bg-white/5 ring-1 ring-inset ring-white/10">
          <table className="w-full text-left text-sm sm:text-base">
            <thead>
              <tr className="border-b border-white/10">
                <th scope="col" className="px-4 py-4 font-medium text-blue-200 sm:px-6">
                  <span className="sr-only">Feature</span>
                </th>
                <th
                  scope="col"
                  className="w-24 px-2 py-4 text-center text-xs font-medium text-blue-200 sm:w-40 sm:text-sm"
                >
                  Custom GPTs &amp; Gems
                </th>
                <th
                  scope="col"
                  className="w-24 bg-indigo-500/15 px-2 py-4 text-center text-xs font-semibold text-white sm:w-40 sm:text-sm"
                >
                  {PLATFORM_NAME}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {comparison.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-4 py-3.5 font-medium text-blue-50 sm:px-6">
                    {row.label}
                  </th>
                  <td className="px-2 py-3.5 text-center">
                    {row.gpts ? (
                      <Check className="mx-auto h-5 w-5 text-blue-200" aria-label="Yes" />
                    ) : (
                      <Minus className="mx-auto h-5 w-5 text-slate-500" aria-label="No" />
                    )}
                  </td>
                  <td className="bg-indigo-500/15 px-2 py-3.5 text-center">
                    <Check className="mx-auto h-5 w-5 text-emerald-400" aria-label="Yes" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bento grid */}
        <div className="mt-20 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={clsx(
                'flex flex-col overflow-hidden rounded-2xl bg-white/5 ring-1 ring-inset ring-white/10',
                feature.className,
              )}
            >
              <div className="p-6 sm:p-8">
                <FeatureHeading icon={feature.icon} title={feature.title} />
                <p className="mt-2 text-sm text-blue-100 sm:text-base">{feature.description}</p>
              </div>
              <div className="relative mx-6 mt-auto h-56 overflow-hidden rounded-t-xl bg-slate-50 shadow-2xl shadow-black/40 sm:mx-8 sm:h-72">
                <Image
                  className={clsx('object-cover', feature.imageClassName)}
                  src={feature.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                />
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-6 rounded-2xl bg-white/5 p-6 ring-1 ring-inset ring-white/10 sm:p-8 lg:col-span-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <FeatureHeading icon={CpuChipIcon} title="Use any model." />
              <p className="mt-2 text-sm text-blue-100 sm:text-base">
                Pick the right model for each app. New models are added as they are released.
              </p>
            </div>
            <ul className="flex flex-wrap gap-3">
              {models.map((model) => (
                <li
                  key={model}
                  className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/15"
                >
                  {model}
                </li>
              ))}
              <li className="rounded-full px-5 py-2 text-sm font-medium text-blue-200 border border-dashed border-white/20">
                + more
              </li>
            </ul>
          </div>
        </div>
      </Container>
    </section>
  )
}
