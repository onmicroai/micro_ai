'use client'

import { FaCircleCheck } from 'react-icons/fa6'
import field_labels from "@/img/building-microapps-101/field_labels.png";
import Image from "next/image";

export default function Example() {
  return (
    <div className="bg-white px-6 py-32 lg:px-8">
      <div className="mx-auto max-w-2xl text-base/7 text-gray-700">
        <p className="text-base/7 font-semibold text-indigo-600">Apps 101</p>
        <h1 className="mt-2 text-pretty text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
          How to Build an AI Microapp
        </h1>
        <p className="mt-8">You can build your first AI Microapp in less than 5 minutes...</p>
        <h3 className="mt-4 text-pretty font-semibold tracking-tight text-primary">
          Video Demo: Simple App
        </h3>
        <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-lg">
          <video className="h-full w-full" controls>
            <source
              src="https://d1jscdodpm97w5.cloudfront.net/Simple+App+4k.mp4"
              type="video/mp4"
            />
            Your browser does not support the video tag.
          </video>
        </div>
        <p className="mt-8 ">
          AI Microapps are made up of <strong>phases</strong>,<strong>fields</strong> and <strong>prompts</strong>.
        </p>
        <ul role="list" className="mt-4 max-w-2xl space-y-8 text-gray-600">
            <li className="flex gap-x-3">
              <FaCircleCheck aria-hidden="true" className="mt-1 size-5 flex-none text-primary" />
              <span>
                <strong className="font-semibold text-primary">Phases</strong> are &quot;turns&quot; in a conversation with AI. When you ask an AI to &quot;write me a recipe for chocolate chip cookies&quot; and the AI responds with &quot;Here&apos;s a recipe you can try...&quot;, that is a single turn in a conversation. An app can have one or multiple phases. 
              </span>
            </li>
        </ul>
        <ul role="list" className="mt-4 max-w-2xl space-y-8 text-gray-600">
            <li className="flex gap-x-3">
              <FaCircleCheck aria-hidden="true" className="mt-1 size-5 flex-none text-primary" />
              <span>
                <strong className="font-semibold text-primary">Fields</strong> are where you collect information from the user. Like, &quot;Do you like walnuts in your cookies?&quot;
              </span>
            </li>
        </ul>
        <ul role="list" className="mt-4 max-w-2xl space-y-8 text-gray-600">
            <li className="flex gap-x-3">
              <FaCircleCheck aria-hidden="true" className="mt-1 size-5 flex-none text-primary" />
              <span>
                <strong className="font-semibold text-primary">Prompts</strong> are how you tell the AI what to do. Like, &quot;Write a recipe for chocolate chip cookies. Don&apos;t include walnuts.&quot;
              </span>
            </li>
        </ul>

        <div className="mt-8 max-w-2xl">
          <div className="w-full rounded-xl bg-primary p-8 shadow-xl transition-all hover:shadow-2xl">
            <h3 className="text-2xl font-bold text-white">Phases</h3>
            

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl bg-white p-6 shadow-md">
                <h4 className="text-xl font-semibold text-gray-900">Fields</h4>

              </div>

              <div className="rounded-xl bg-secondary p-6 shadow-md">
                <h4 className="text-xl font-semibold text-gray-900">Prompts</h4>

              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 max-w-2xl">
          <p>
            You can combine phases, fields and prompts to make more complex apps...
          </p>        
          <h3 className="mt-4 text-pretty font-semibold tracking-tight text-primary">
            Video Demo: Moderate Complexity App
          </h3>
          <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-lg">
          <video className="h-full w-full" controls>
            <source
              src="https://d1jscdodpm97w5.cloudfront.net/Moderate+Complexity+App.mp4"
              type="video/mp4"
            />
            Your browser does not support the video tag.
            </video>
          </div>
          <h3 className="mt-16 text-pretty text-3xl font-semibold tracking-tight text-gray-900">Fields</h3>
          <p className="mt-6">Fields collect information from the user, and they use standard fields types like text input, checkboxes and radio buttons, dropdowns, etc. Each field has a label, a name, and an optional description.
          </p>
          <ul role="list" className="mt-8 max-w-2xl space-y-8 text-gray-600 pl-4">
            <li className="flex gap-x-3">
              <FaCircleCheck aria-hidden="true" className="mt-1 size-2 flex-none text-primary" />
              <span>
                <strong className="font-semibold text-primary">Label</strong> is the text that appears above the field, like the question. 
              </span>
            </li>
            <li className="flex gap-x-3">
              <FaCircleCheck aria-hidden="true" className="mt-1 size-2 flex-none text-primary" />
              <span>
                <strong className="font-semibold text-primary">Name</strong> Name is a short, sensible name for the field. You use this name when you add the field to your prompt.
              </span>
            </li>
            <li className="flex gap-x-3">
              <FaCircleCheck aria-hidden="true" className="mt-1 size-2 flex-none text-primary" />
              <span>
                <strong className="font-semibold text-primary">Description</strong> is extra descriptive text for your user. 
              </span>
            </li>
          </ul>
          <div className="mt-16 max-w-2xl">
          <Image
            alt="Field labels"
            src={field_labels.src}
            width={2432}
            height={1442}
            className="w-[48rem] max-w-2xl rounded-xl shadow-xl ring-1 ring-gray-400/10 sm:w-[57rem] md:-ml-4 lg:-ml-0 lg:mt-0"
          />
          </div>
          <h3 className="mt-16 text-pretty text-3xl font-semibold tracking-tight text-gray-900">Prompts</h3>
          <p className="mt-6">Prompts are how you tell the AI what to do. There are three kinds of prompts that you can use:.
          </p>
          <ul role="list" className="mt-8 max-w-2xl space-y-8 text-gray-600 pl-4">
            <li className="flex gap-x-3">
              <FaCircleCheck aria-hidden="true" className="mt-1 size-2 flex-none text-primary" />
              <span>
                <strong className="font-semibold text-primary">Prompts</strong> are standard text prompts, like you would use in a chatbot. Except that with MicroApps you can include placeholders for fields.
              </span>
            </li>
            <li className="flex gap-x-3">
              <FaCircleCheck aria-hidden="true" className="mt-1 size-2 flex-none text-primary" />
              <span>
                <strong className="font-semibold text-primary">AI Instructions</strong> are instructions for that specific step that you want the AI to follow. Use instructions when you want to give the AI specific instructions for a step.
              </span>
            </li>
            <li className="flex gap-x-3">
              <FaCircleCheck aria-hidden="true" className="mt-1 size-2 flex-none text-primary" />
              <span>
                <strong className="font-semibold text-primary">Fixed Responses</strong> are hard-coded responses that you want to output. The response will be exactly as you write it. You can use field placeholders here too.
              </span>
            </li>
          </ul>
          </div>
          <div className="mt-8 max-w-2xl">
          <p>
            Finally, you can include logic like field validation, conditional logic, and scoring to really control how you want the AI to behave based on your inputs. 
          </p>        
          <h3 className="mt-4 text-pretty font-semibold tracking-tight text-primary">
            Video Demo: Advanced App
          </h3>
          <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-lg">
          <video className="h-full w-full" controls>
            <source
              src="https://d1jscdodpm97w5.cloudfront.net/High+Complexity+App.mp4"
              type="video/mp4"
            />
            Your browser does not support the video tag.
            </video>
          </div>
          <h3 className="mt-16 text-pretty text-3xl font-semibold tracking-tight text-gray-900">Advanced Logic</h3>
          <p className="mt-6">You can build really precise apps by using a combination of field validation, conditional logic, and scored phases:
          </p>
          <ul role="list" className="mt-8 max-w-2xl space-y-8 text-gray-600 pl-4">
            <li className="flex gap-x-3">
              <FaCircleCheck aria-hidden="true" className="mt-1 size-2 flex-none text-primary" />
              <span>
                <strong className="font-semibold text-primary">Field Validation</strong> allows you to control whether or not a field is required, and what kind of input restrictions it has, like a minimum character count.
              </span>
            </li>
            <li className="flex gap-x-3">
              <FaCircleCheck aria-hidden="true" className="mt-1 size-2 flex-none text-primary" />
              <span>
                <strong className="font-semibold text-primary">Conditional Logic</strong> allows you include or exclude a field based on the value of another field. Conditional logic works with both input fields and prompts.
              </span>
            </li>
            <li className="flex gap-x-3">
              <FaCircleCheck aria-hidden="true" className="mt-1 size-2 flex-none text-primary" />
              <span>
                <strong className="font-semibold text-primary">Scored Phases</strong> use a rubric to score the user&apos;s response. Responses that don&apos;t meet the minimum score threshold will not be allowed to advance.
              </span>
            </li>
          </ul>
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
    </div>
  )
}
