"use client";

import axiosInstance from "@/utils/axiosInstance";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@heroicons/react/20/solid";
import { StripePricingTable } from "./StripePricingTable";

const pricing = {
  tiers: [
    {
      name: "Free",
      id: "tier-free",
      href: "/accounts/registration/",
      price: { monthly: "$0" },
      description: "Build and share apps with generous usage limits.",
      features: [
        "10,000 AI credits",
        "3 apps",
        "Basic AI Models (GPT 4o-mini, Claude Haiku, Google Gemini Flash, and more...",
      ],
      mostPopular: false,
    },
    {
      name: "Pro",
      id: "tier-pro",
      href: "/accounts/registration/",
      price: { monthly: "$16" },
      description: "Unlimited apps, advanced models, and additional analytics.",
      features: [
        "100,000 AI credits",
        "Unlimited apps",
        "Advanced AI Models (GPT 4o, Claude Sonnet, Google Gemini Pro, and more...",
      ],
      mostPopular: true,
    },
    {
      name: "Enterprise",
      id: "tier-enterprise",
      href: "/accounts/registration/",
      price: { monthly: "$79" },
      description:
        "Advanced analytics, SSO, credit sharing, and bring your own models.",
      features: [
        "400,000 AI credits",
        "Unlimited apps",
        "BYO AI Models",
        "Advanced analytics",
        "SSO",
        "Credit sharing",
      ],
      mostPopular: false,
    },
    {
      name: "+ Top Up",
      id: "tier-top-up",
      price: { monthly: "+ $20" },
      description:
        "Add more monthly credits to any plan. (Only very heavy users will need this.)",
      features: ["200,000 additional AI credits (credits do not roll over)"],
      mostPopular: false,
    },
  ],
};

function classNames(...classes: string[]): string {
  return classes.filter(Boolean).join(" ");
}

export function PricingSection() {
  const api = axiosInstance();
  const router = useRouter();

  const handleChoosePlan = async (tier: any) => {
    const planName = tier.name === "+ Top Up" ? "TopUp" : tier.name;

    if (tier.name === "Free") {
      router.push(tier.href);
      return;
    }

    try {
      const response = await api.post("/api/subscriptions/checkout-session/", {
        plan: planName,
        successUrl: `${window.location.origin}/settings/subscription?updated=success`,
        cancelUrl: `${window.location.origin}/settings/subscription?updated=failure`,
      });
      const checkoutUrl = response.data.url;
      localStorage.setItem("expectedPlan", planName);
      window.location.href = checkoutUrl;
    } catch (error: any) {
      console.error("Error creating checkout session:", error.response);
    }
  };

  return (
    <div className="mx-auto mt-16 mb-32 max-w-7xl px-6 sm:mt-32 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-base/7 font-semibold text-indigo-600">Pricing</h1>
        <p className="mt-2 text-balance text-5xl font-semibold tracking-tight text-gray-900 sm:text-6xl">
          Smart Pricing
        </p>
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-pretty text-center text-lg font-medium text-gray-600 sm:text-xl/8">
        No more paying for a license for every user. Start with a generous free
        tier, then only pay for the users who are creating apps.
      </p>
      <div className="isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 md:max-w-2xl md:grid-cols-2 lg:max-w-4xl xl:mx-0 xl:max-w-none xl:grid-cols-4">
        {pricing.tiers.map((tier) => (
          <div
            key={tier.id}
            className={classNames(
              tier.mostPopular
                ? "ring-2 ring-indigo-600"
                : "ring-1 ring-gray-200",
              "rounded-3xl p-8"
            )}
          >
            <h2
              id={tier.id}
              className={classNames(
                tier.mostPopular ? "text-indigo-600" : "text-gray-900",
                "text-lg/8 font-semibold"
              )}
            >
              {tier.name}
            </h2>
            <p className="mt-4 text-sm/6 text-gray-600">{tier.description}</p>
            <p className="mt-6 flex items-baseline gap-x-1">
              <span className="text-4xl font-semibold tracking-tight text-gray-900">
                {tier.price.monthly}
              </span>
              <span className="text-sm/6 font-semibold text-gray-600">
                /month
              </span>
            </p>
            <button
              onClick={() => handleChoosePlan(tier)}
              className={classNames(
                tier.mostPopular
                  ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500"
                  : "text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:ring-indigo-300",
                "mt-6 block w-full rounded-md px-3 py-2 text-center text-sm/6 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              )}
            >
              Choose plan
            </button>
            <ul role="list" className="mt-8 space-y-3 text-sm/6 text-gray-600">
              {tier.features.map((feature: string) => (
                <li key={feature} className="flex gap-x-3">
                  <CheckIcon
                    aria-hidden="true"
                    className="h-6 w-5 flex-none text-indigo-600"
                  />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-16 flex justify-center">
        <div className="w-full max-w-4xl rounded-lg bg-white p-8 shadow-md ring-1 ring-gray-200">
          <StripePricingTable />
        </div>
      </div>
    </div>
  );
}
