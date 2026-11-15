import Image from 'next/image'

import { Container } from '@/components/Container'

/**
 * Institution logos for the "trusted by" strip.
 *
 * To add a logo: drop the file in /public/img/logos/ and set `src`
 * (e.g. '/img/logos/state-university.svg') plus its pixel `width`/`height`.
 * Entries without `src` render as a placeholder box. Use a white logo on a
 * transparent background (the *-white files here); the originals are kept
 * alongside them.
 */
type Logo = {
  name: string
  src?: string
  width?: number
  height?: number
}

const logos: Logo[] = [
  { name: 'Middlesex Community College', src: '/img/logos/mcc-logo-white.png', width: 2300, height: 328 },
  { name: 'Northwestern University', src: '/img/logos/northwestern-white.svg', width: 2500, height: 603 },
  { name: 'University of Alaska Fairbanks', src: '/img/logos/uaf-logo-white.png', width: 1200, height: 259 },
  { name: "St. George's University", src: '/img/logos/sgu-logo-white.png', width: 500, height: 200 },
  { name: 'University of Georgia', src: '/img/logos/uga-logo-white.png', width: 631, height: 207 },
]

export function LogoCloud() {
  return (
    <section aria-label="Institutions using our platform" className="bg-slate-900 py-14 sm:py-16">
      <Container>
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-blue-200">
          Trusted by educators at
        </p>
        <ul className="mx-auto mt-10 grid max-w-6xl grid-cols-2 items-center gap-x-10 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {logos.map((logo, i) => (
            <li
              key={logo.name}
              className={
                // Center the last logo when it sits alone on a 2-column row
                i === logos.length - 1 && logos.length % 2 === 1
                  ? 'col-span-2 flex justify-center sm:col-span-1'
                  : 'flex justify-center'
              }
            >
              {logo.src ? (
                <Image
                  src={logo.src}
                  alt={logo.name}
                  width={logo.width ?? 160}
                  height={logo.height ?? 48}
                  className="h-12 w-auto max-w-[11rem] object-contain opacity-70 transition-opacity duration-200 hover:opacity-100"
                />
              ) : (
                <div className="flex h-12 w-40 items-center justify-center rounded-lg border border-dashed border-white/20 text-xs font-medium text-blue-200/70">
                  {logo.name}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
