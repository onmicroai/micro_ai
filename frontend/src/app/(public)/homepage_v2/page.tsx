import { Hero } from '@/components/Hero'
import { PrimaryFeatures } from '@/components/PrimaryFeatures'
import { CardGrid } from '@/components/CardGrid'
import { CallToAction } from '@/components/CalltoAction'
import { PricingSection } from '@/components/PricingSection'
import mcq_image from '@/img/app_images/multiple-01.png'
import case_study_image from '@/img/app_images/case-study-01.png'
import video_reflection_image from '@/img/app_images/writing-01.png'

const cards = [
  {
    title: "MCQ Generator",
    imageUrl: mcq_image.src,
    description: "Generate multiple choice questions tailored to your content, audience, and teaching goals",
    appUrl: "/app/3b0fa16f-59bd-46"
  },
  {
    title: "Case Study Tutor",
    imageUrl: case_study_image.src,
    description: "Ask your students critical thinking questions about a shared case study and access the accuracy of their responses",
    appUrl: "/app/b917ced1-a097-4c"
  },
  {
    title: "Video Reflection",
    imageUrl: video_reflection_image.src,
    description: "Use Instructor Guidance and AI support to encourage students to engage critically with an instructional video without first relying on AI.",
    appUrl: "/app/third"
  }
];

<CardGrid cards={cards} />

export default function Home() {
  return (
    <>
      <main>
        <Hero />
        <PrimaryFeatures />
        <CardGrid cards={cards} />
        <CallToAction />
        <PricingSection />
      </main>
    </>
  )
}
