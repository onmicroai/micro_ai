'use client'

import microai_metal from "@/img/about/microai_metal.png";
import microai_paper from "@/img/about/microai_paper.png";
import microai_abstract from "@/img/about/microai_abstract.png";
import student from "@/img/about/student.jpg";
import educator from "@/img/about/educator1.jpg";
import online_education from "@/img/about/online_education.jpg";
import Image from "next/image";

export default function About() {
    return (
      <div className="overflow-hidden bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-2xl px-6 lg:max-w-7xl lg:px-8">
          <div className="max-w-4xl">
            <p className="text-base/7 font-semibold text-indigo-600">About OnMicro.AI</p>
            <h1 className="mt-2 text-pretty text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
              AI Agency for Educators
            </h1>
          </div>
          <section className="mt-20 grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-16">
            <div className="lg:pr-8">
              <h2 className="text-pretty text-2xl font-semibold tracking-tight text-gray-900">Our mission</h2>
              <p className="mt-6 text-base/7 text-gray-600">
              OnMicro.AI&apos;s mission is to provide <strong className="text-primary">agency over AI for educators</strong> through tools and research. Agency over AI means putting educators in the driver&apos;s seat. It&apos;s about making sure that AI is not a black box of complex algorithms, but a tool that serves your vision and your students&apos; needs. Whether you&apos;re creating lesson plans, automating assessments, or crafting engaging learning experiences, OnMicro.AI provides resources to make AI work for you, not the other way around.
              </p>
              <h2 className="text-pretty text-2xl mt-12 mb-6 font-semibold tracking-tight text-gray-900">What can you do with OnMicro.AI?</h2>
              <p className="mt-6 text-base/7 text-gray-600">OnMicro.AI allows you to build and share instructor-guided, AI-powered apps with anyone.</p>
              <ul className="mt-4 space-y-4 text-base/7 text-gray-600 list-disc pl-5">
                <li>Build <strong className="text-primary">time-saving apps</strong> for common tasks that you do often, like generating multiple choice questions. Refine your apps over time to sound and act more like you, not like an off-the-shelf AI model.</li>
                <li>Create and share <strong className="text-primary">exercises and assessments</strong> with your students. Generative AI allows educators to set up critical thinking exercises like debates or case studies that are guided by the instructor voice, but available anytime and with immediate feedback for students.</li>
                <li>Create and share <strong className="text-primary">accelerators</strong> with your <strong className="text-primary">teams</strong>. Working on a task where AI could help, like mapping competencies to content. Have your AI champion build a simple app and share it with the team so that everyone can take advantage of AI in a consistent way.</li> 
              </ul>
              <h2 className="text-pretty text-2xl mt-12 mb-6 font-semibold tracking-tight text-gray-900">Alpha Mode</h2>
              <p className="mt-6 text-base/7 text-gray-600">OnMicro.AI is currently in <strong className="text-primary">Alpha mode</strong>. That means we are doing closed testing with a select set of users to get feedback, prioritize features, and squash bugs. If you&apos;d like to be an alpha tester please reach out to john@onmicro.ai</p>
            </div>
            <div className="pt-16 lg:row-span-2 lg:-mr-16 xl:mr-auto">
              <div className="-mx-8 grid grid-cols-2 gap-4 sm:-mx-16 sm:grid-cols-4 lg:mx-0 lg:grid-cols-2 lg:gap-4 xl:gap-8">
                <div className="aspect-square overflow-hidden rounded-xl shadow-xl outline outline-1 -outline-offset-1 outline-black/10">
                  <Image
                    alt=""
                    src={educator}
                    className="block size-full object-cover"
                  />
                </div>
                <div className="-mt-8 aspect-square overflow-hidden rounded-xl shadow-xl outline outline-1 -outline-offset-1 outline-black/10 lg:-mt-40">
                  <Image
                    alt=""
                    src={microai_abstract}
                    className="block size-full object-cover"
                  />
                </div>
                <div className="aspect-square overflow-hidden rounded-xl shadow-xl outline outline-1 -outline-offset-1 outline-black/10">
                  <Image
                    alt=""
                    src={microai_paper}
                    className="block size-full object-cover"
                  />
                </div>
                <div className="-mt-8 aspect-square overflow-hidden rounded-xl shadow-xl outline outline-1 -outline-offset-1 outline-black/10 lg:-mt-40">
                  <Image
                    alt=""
                    src={student}
                    className="block size-full object-cover"
                  />
                </div>
                <div className="aspect-square overflow-hidden rounded-xl shadow-xl outline outline-1 -outline-offset-1 outline-black/10">
                  <Image
                    alt=""
                    src={online_education}
                    className="block size-full object-cover"
                  />
                </div>
                <div className="-mt-8 aspect-square overflow-hidden rounded-xl shadow-xl outline outline-1 -outline-offset-1 outline-black/10 lg:-mt-40">
                  <Image
                    alt=""
                    src={microai_metal}
                    className="block size-full object-cover"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }
  