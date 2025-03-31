'use client'

import { PricingSection } from '@/components/PricingSection'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import { FaPlus, FaMinus } from 'react-icons/fa6'

const faqs = [
  {
    question: "Who pays for usage?",
    answer:
      "Every interaction with a MicroApp uses credits from the creator/owner of the microapp. This allows us to only charge for app creators, while allowing apps to be shareable. This means that you should protect who has access to your apps, and consider using cheaper models like GPT-4o-mini when you can. Don't worry. You'll never be charged more than your monthly subscription amount. You'll simply run out of usage credits and either have to buy more or wait until the next month's cycle.",
  },
  {
    question: "How much usage do I get?",
    answer:
      "More than you think. For example, on the free tier you can generate over 4,000 multiple choice questions using the MCQ Generator with GPT 4o-mini and typical use cases. Model costs change frequently and each MicroApp is different, so we are working on stable usage guidelines and hope to provide those soon.",
  },
  // More questions...
]

export default function Example() {
  return (
    <div className="bg-white">
      <main>
        <PricingSection />

        {/* FAQ section */}
        <div className="mx-auto my-24 max-w-7xl px-6 sm:my-56 lg:px-8">
          <div className="mx-auto max-w-4xl divide-y divide-gray-900/10">
            <h2 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
              Frequently asked questions
            </h2>
            <dl className="mt-10 space-y-6 divide-y divide-gray-900/10">
              {faqs.map((faq) => (
                <Disclosure key={faq.question} as="div" className="pt-6">
                  <dt>
                    <DisclosureButton className="group flex w-full items-start justify-between text-left text-gray-900">
                      <span className="text-base/7 font-semibold">{faq.question}</span>
                      <span className="ml-6 flex h-7 items-center">
                        <FaPlus className="h-6 w-6 group-data-[open]:hidden" />
                        <FaMinus className="h-6 w-6 group-[&:not([data-open])]:hidden" />
                      </span>
                    </DisclosureButton>
                  </dt>
                  <DisclosurePanel as="dd" className="mt-2 pr-12">
                    <p className="text-base/7 text-gray-600">{faq.answer}</p>
                  </DisclosurePanel>
                </Disclosure>
              ))}
            </dl>
          </div>
        </div>
      </main>
    </div>
  )
}
