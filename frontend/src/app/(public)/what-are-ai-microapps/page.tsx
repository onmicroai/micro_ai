"use client";

import { FaSliders, FaChartLine, FaCreditCard, FaPuzzlePiece, FaShieldHalved, FaCubes } from 'react-icons/fa6'
import hello_world_app from "@/img/hello_world_app.gif";
import Image from "next/image";

const features = [
  {
    name: 'Total Control.',
    description:
      'Design the inputs, outputs, and logic of your app, to keep your voice and pedagogy in the AI experience, and then share it with others.',
    icon: FaSliders,
  },
  {
    name: 'Insights.',
    description: 'Monitor usage, satisfaction, and outcomes with built-in analytics.',
    icon: FaChartLine,
  },
  {
    name: 'Pay for what you use.',
    description: 'Pay for app creators and usage. Stop paying for a license for everyone at your organization, regardless of usage. ',
    icon: FaCreditCard,
  },
  {
    name: 'Flexibility.',
    description: 'Apps have access to the major AI providers, or you can use your own. Use the best AI for the task.',
    icon: FaPuzzlePiece,
  },
  {
    name: 'Security.',
    description: 'Encrypted data at rest and no-training for data sent to AI providers.',
    icon: FaShieldHalved,
  },
  {
    name: 'Drag and Drop Development.',
    description: 'Design your app visually with drag and drop components, no coding required.',
    icon: FaCubes,
  },
]

export default function Example() {
  return (
    <div className="overflow-hidden bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="border-l-4 border-primary-600 pl-4">
          <h1 className="mt-2 text-pretty text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            What are AI Microapps?
          </h1>
        </div>
        <div className="mt-8 mb-8 rounded-xl bg-gray-50 p-6 shadow-sm">
          <p className="text-xl leading-relaxed text-gray-800">
          <strong className="text-primary">AI Microapps</strong> are the simplest way to build <strong>Instructor‑Guided, AI‑powered</strong> web apps that you can personalize and share.
            AI MicroApps are apps that put you in control of the <strong>inputs, the outputs, and the logic.</strong>
          </p>
        </div>
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 sm:gap-y-20 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          <div className="lg:pr-8">
            <div className="lg:max-w-lg">
              <dl className="mt-0 max-w-xl space-y-8 text-base/7 text-gray-600 lg:max-w-none">
                {features.map((feature) => (
                  <div key={feature.name} className="relative pl-9">
                    <dt className="inline font-semibold text-gray-900">
                      <feature.icon className="absolute left-1 top-1 size-5 text-primary-600" />
                      {feature.name}
                    </dt>{' '}
                    <dd className="inline">{feature.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <Image
            alt="Product screenshot"
            src={hello_world_app.src}
            width={2432}
            height={1442}
            className="w-[48rem] max-w-none rounded-xl shadow-xl ring-1 ring-gray-400/10 sm:w-[57rem] md:-ml-4 lg:-ml-0 lg:mt-0"
          />
        </div>
      </div>
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-6">
          <div className="border-l-4 border-primary-600 pl-4">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">Comparing Solutions</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              What about Chatbots and Custom GPTs?
            </h2>
          </div>

          <div className="mt-8 rounded-xl bg-gray-50 p-6 shadow-sm">
            <p className="text-xl leading-relaxed text-gray-800">
              <strong className="text-primary-700">Chatbots and Custom GPTs</strong> are for <strong>open-ended conversations</strong>. 
              They are great for tasks like customer support, language learning, advising, and more. 
              <span className="block mt-4">
                <strong className="text-primary-700">MicroApps</strong> are designed for <strong>distinct tasks</strong>, 
                like generating MCQ questions in a specific style, or delivering a classroom exercise where you want each student to have a similar experience.
              </span>
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">Control & Customization</h3>
              <p className="mt-4 text-gray-600">
                Chatbots allow you to specify your knowledge base and provide guidance on how an AI should behave. 
                Microapps do this too, and give you full control over the inputs you want to collect from the user, 
                the outputs you want the AI provide and hyper-fine-tuned instructions on how the AI should behave at each step.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">Analytics & Outcomes</h3>
              <p className="mt-4 text-gray-600">
                Because chatbots are open-ended, it is hard to analyze specific outcomes from the conversation. 
                Because of microapps repeatable nature and built-in scoring capabilites, MicroApps allow you to run 
                AI experiments and analyze outcomes.
              </p>
            </div>
          </div>
        </div>
      </div>



      <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
            How do I get started?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg/8 text-gray-600">
            The easiest way to get started is to use an app! Once you get a sense of how it works and how you want to change it for your own use, you can clone it and edit it to make it your own. 
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <a
              href="#"
              className="rounded-md bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
            >
              View the App Library
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}