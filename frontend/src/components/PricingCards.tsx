import { CheckIcon } from "@heroicons/react/20/solid";
import axiosInstance from "@/utils/axiosInstance";
import { useRouter } from "next/navigation";

interface PricingCardsProps {
  showTopUp?: boolean;
  currentPlan?: string;
  onPlanSelect?: (plan: string) => Promise<void>;
}

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

export function PricingCards({ showTopUp = true, currentPlan, onPlanSelect }: PricingCardsProps) {
  const api = axiosInstance();
  const router = useRouter();

  const handleChoosePlan = async (tier: any) => {
    if (tier.name === currentPlan) return;
    
    const planName = tier.name === "+ Top Up" ? "TopUp" : tier.name;

    if (onPlanSelect) {
      await onPlanSelect(planName);
      return;
    }

    // Default behavior for non-subscription pages (like marketing page)
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

  const displayTiers = showTopUp ? pricing.tiers : pricing.tiers.filter(tier => tier.name !== "+ Top Up");

  return (
    <div className={classNames(
      "isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8",
      showTopUp 
        ? "md:max-w-2xl md:grid-cols-2 lg:max-w-4xl xl:mx-0 xl:max-w-none xl:grid-cols-4"
        : "md:max-w-2xl md:grid-cols-2 lg:max-w-4xl xl:mx-0 xl:max-w-none xl:grid-cols-3"
    )}>
      {displayTiers.map((tier) => (
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
            disabled={tier.name === currentPlan}
            className={classNames(
              tier.mostPopular
                ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500"
                : "text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:ring-indigo-300",
              "mt-6 block w-full rounded-md px-3 py-2 text-center text-sm/6 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
              tier.name === currentPlan ? "opacity-50 cursor-not-allowed" : ""
            )}
          >
            {tier.name === currentPlan ? "Plan Selected" : "Choose plan"}
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
  );
} 