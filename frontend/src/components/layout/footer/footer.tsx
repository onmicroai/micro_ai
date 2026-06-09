"use client";

import Image from "next/image";
import Section from "../section/section";
import { LOGO_ALT, LOGO_SRC, PLATFORM_NAME } from "@/constants/branding";
import { sectionTypes } from "@/constants";


export default function Footer() {
  return (
    <>
      <Section type={sectionTypes.fullWidth}>
        <footer className="bg-white dark:bg-black-dark">
          <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-12 gap-8">
            <div className="col-span-4 space-y-4">
              <Image 
                src={LOGO_SRC}
                alt={LOGO_ALT}
                className="h-5 w-auto" 
                width={150} 
                height={40}
              />
              <p className="text-gray-600 text-sm">
                {PLATFORM_NAME} is a no-code platform for educators to build AI-powered, instructor-guided tools for course development and assessment. Educators can leverage the scale and speed of AI while protecting their pedagogy.
              </p>
            </div>
            <div className="col-span-4"></div>

            <div className="col-span-2">
              <h3 className="font-semibold text-gray-900 mb-4">Product</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="hover:text-gray-900 cursor-pointer text-sm"><a href="/pricing/">Pricing</a></li>
                <li className="hover:text-gray-900 cursor-pointer text-sm"><a href="/what-are-ai-microapps/">What are MicroApps?</a></li>
                <li className="hover:text-gray-900 cursor-pointer text-sm"><a href="/library/">Apps Library</a></li>
              </ul>
            </div>

            <div className="col-span-2">
              <h3 className="font-semibold text-gray-900 mb-4">Company</h3>
              <ul className="space-y-2 text-gray-600">
                <li className="hover:text-gray-900 cursor-pointer text-sm"><a href="/about/">About</a></li>
                <li className="hover:text-gray-900 cursor-pointer text-sm"><a href="/terms/">Terms</a></li>
                <li className="hover:text-gray-900 cursor-pointer text-sm"><a href="/privacy/">Privacy</a></li>
              </ul>
            </div>
          </div>
        </footer>
      </Section>
      <Section type={sectionTypes.last} style={{ padding: "0" }}>
        <div className="dark:bg-black-dark">
          <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center border-t border-gray-200">
            <p className="text-gray-600 text-sm">© {new Date().getFullYear()} {PLATFORM_NAME}. All rights reserved.</p>

          </div>
        </div>
      </Section>
    </>
  );
}
