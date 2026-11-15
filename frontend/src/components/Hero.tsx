"use client"

import Image from 'next/image'
import Link from 'next/link'
import Script from 'next/script'
import { BarChart3, BookOpen, Share2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import Button from '@/components/modules/button/button'
import { buttonTypes } from "@/constants";
import { Container } from '@/components/Container'
import home_bg from '@/img/home_background.png'

const STORYLANE_SRC = "https://app.storylane.io/demo/u4glvmovyicg?embed=inline"
const OPEN_SOURCE_LINK = "https://github.com/onmicroai/micro_ai"
const CALENDLY_URL = "https://calendly.com/curricume/onmicro-product-demo?hide_event_type_details=1&primary_color=5b5cf0"

declare global {
  interface Window {
    Calendly?: { initPopupWidget: (opts: { url: string }) => void }
  }
}

function Highlight({ children }: { children: ReactNode }) {
  return (
    <span className="font-semibold text-white">
      {children}
    </span>
  )
}

export function Hero() {
  const router = useRouter()

  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById("calendly-css")) return
    const link = document.createElement("link")
    link.id = "calendly-css"
    link.href = "https://assets.calendly.com/assets/external/widget.css"
    link.rel = "stylesheet"
    document.head.appendChild(link)

    const script = document.createElement("script")
    script.src = "https://assets.calendly.com/assets/external/widget.js"
    script.async = true
    document.body.appendChild(script)
  }, [])

  const openCalendly = () => {
    if (window.Calendly) {
      window.Calendly.initPopupWidget({ url: CALENDLY_URL })
    } else {
      window.open(CALENDLY_URL, "_blank", "width=700,height=700")
    }
  }

  return (
    <div className="relative overflow-hidden bg-white">
      {/* Same full-bleed background as PrimaryFeatures */}
      <div className="absolute inset-0 z-0">
        <Image
          className="h-full w-full object-cover"
          src={home_bg}
          alt=""
          fill
          priority
          quality={90}
        />
      </div>

      {/* Copy + CTAs — left/right above the fold */}
      <Container className="relative z-10 pt-16 pb-10 sm:pt-20 sm:pb-12 lg:pt-24 lg:pb-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-14 lg:items-center">
          {/* Left: headline + buttons — more width, larger type */}
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-white text-balance sm:text-5xl lg:text-6xl xl:text-7xl text-left">
              Your replacement for Custom GPTs, built for{' '}
              <span className="relative whitespace-nowrap text-blue-200">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 418 42"
                  className="absolute left-0 top-2/3 h-[0.58em] w-full fill-blue-400/90 -z-10"
                  preserveAspectRatio="none"
                >
                  <path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.07 1.214.828 1.121 9.595-1.176 9.072-2.377 17.15-3.92 39.246-7.496C123.565 7.986 157.869 4.492 195.942 5.046c7.461.108 19.25 1.696 19.17 2.582-.107 1.183-7.874 4.31-25.75 10.366-21.992 7.45-35.43 12.534-36.701 13.884-2.173 2.308-.202 4.407 4.442 4.734 2.654.187 3.263.157 15.593-.78 35.401-2.686 57.944-3.488 88.365-3.143 46.327.526 75.721 2.23 130.788 7.584 19.787 1.924 20.814 1.98 24.557 1.332l.066-.011c1.201-.203 1.53-1.825.399-2.335-2.911-1.31-4.893-1.604-22.048-3.261-57.509-5.556-87.871-7.36-132.059-7.842-23.239-.254-33.617-.116-50.627.674-11.629.54-42.371 2.494-46.696 2.967-2.359.259 8.133-3.625 26.504-9.81 23.239-7.825 27.934-10.149 28.304-14.005.417-4.348-3.529-6-16.878-7.066Z" />
                </svg>
                <span className="relative">educators</span>
              </span>
            </h1>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
              <Button type={buttonTypes.primary} text="Book a demo" onClick={openCalendly} />
              <Button type={buttonTypes.secondary} text="Get started for free" onClick={() => router.push("/accounts/registration")}>
              </Button>
            </div>
          </div>
          {/* Right: description + links — less width, slightly smaller type */}
          <div className="flex flex-col justify-center text-left lg:max-w-sm">
            <p className="text-pretty text-base font-medium tracking-tight text-blue-100 sm:text-lg">
              Create interactive, shareable learning experiences for your students.
            </p>
            <ul className="mt-5 space-y-3 text-base font-medium tracking-tight text-blue-100 sm:text-lg">
              <li className="flex items-start gap-3">
                <BookOpen className="mt-1 h-5 w-5 shrink-0 text-blue-200" aria-hidden="true" />
                <span>Add your own <Highlight>knowledge</Highlight> and <Highlight>instructions</Highlight>.</span>
              </li>
              <li className="flex items-start gap-3">
                <Share2 className="mt-1 h-5 w-5 shrink-0 text-blue-200" aria-hidden="true" />
                <span>Share them with a <Highlight>link</Highlight> or <Highlight>embed</Highlight> them in your LMS.</span>
              </li>
              <li className="flex items-start gap-3">
                <BarChart3 className="mt-1 h-5 w-5 shrink-0 text-blue-200" aria-hidden="true" />
                <span><Highlight>Review</Highlight> student usage.</span>
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">

              <Link
                href={OPEN_SOURCE_LINK}
                className="inline-flex items-center gap-2 text-blue-100 hover:text-white transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                We&apos;re open source
              </Link>
            </div>
          </div>
        </div>
      </Container>

      {/* Above-the-fold Storylane demo */}
      <div className="relative z-10 w-full px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Script
            src="https://js.storylane.io/js/v2/storylane.js"
            strategy="afterInteractive"
            data-verify-origin=""
          />
          <div
            className="sl-embed"
            style={{
              position: "relative",
              paddingBottom: "calc(62.73% + 25px)",
              width: "100%",
              height: 0,
              transform: "scale(1)",
            }}
          >
            <iframe
              loading="lazy"
              className="sl-demo"
              src={STORYLANE_SRC}
              name="sl-embed"
              allow="fullscreen"
              allowFullScreen
              title="How to turn a lesson into an always-on practice session"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: "1px solid rgba(63,95,172,0.35)",
                boxShadow: "0px 0px 18px rgba(26, 19, 72, 0.15)",
                borderRadius: "10px",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div
            aria-hidden="true"
            tabIndex={-1}
            inert
            style={{ display: "none", visibility: "hidden", width: "1px", height: "1px" }}
          >
            How to turn a lesson into an always-on practice session and share it with students using an AI app builder (onmicro.ai). The walkthrough takes about 60 seconds. Start by explaining what you want to build; anything the tool creates can be modified afterward. Adjust the generated app or add your own knowledge to customize it. Share the finished app with a direct link, copied from the Direct link option, or embed it in a learning management system (LMS). After the app is built, try it with the same experience students will have.
          </div>
        </div>
      </div>
    </div>
  )
}
