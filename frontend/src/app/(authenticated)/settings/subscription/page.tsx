"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { toast } from "react-toastify";
import BillingUpdatePolling from "./billing-update-polling";
import { useRouter } from "next/navigation";

interface Subscription {
  id: string;
  price_id: string;
  status: string;
  period_start: number;
  period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  customer_id: number;
  current_period_end?: number;
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>("Free");
  const [spendAmount, setSpendAmount] = useState<number>(0);
  const [isPollingOpen, setIsPollingOpen] = useState<boolean>(false);
  const [pollingType, setPollingType] = useState<
    "subscription" | "credits" | null
  >(null);
  const api = axiosInstance();
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("updated") === "success") {
      const storedExpectedCredits = localStorage.getItem("expectedCredits");
      const storedExpectedPlan = localStorage.getItem("expectedPlan");
      if (storedExpectedCredits) {
        setPollingType("credits");
        setIsPollingOpen(true);
      } else if (storedExpectedPlan) {
        setPollingType("subscription");
        setIsPollingOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes] = await Promise.all([api.get("/api/auth/user/")]);
        const userData = userRes.data;
        setSubscription(userData.subscription);
        if (userData.plan) {
          setSelectedPlan(userData.plan);
        }
      } catch (error: any) {
        toast.error("Failed to load subscription data: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [api]);

  const handleManageSubscription = async () => {
    try {
      const response = await api.post("/api/subscriptions/portal-session/");
      window.location.href = response.data.url;
    } catch (error: any) {
      toast.error("Failed to open billing portal: " + error.message);
    }
  };

  const handleContinue = async () => {
    try {
      if (
        selectedPlan !== "Free" &&
        (!subscription ||
          subscription.status === "canceled" ||
          subscription.status === "incomplete_expired")
      ) {
        const response = await api.post(
          "/api/subscriptions/checkout-session/",
          {
            plan: selectedPlan,
            successUrl: `${window.location.origin}/settings/subscription?updated=success`,
            cancelUrl: `${window.location.origin}/settings/subscription?updated=failure`,
          }
        );
        window.location.href = response.data.url;
        localStorage.setItem("expectedPlan", selectedPlan);
      } else {
        const response = await api.post(
          "/api/subscriptions/update-subscription/",
          {
            plan: selectedPlan,
          }
        );

        if (response.data.url) {
          window.location.href = response.data.url;
        } else if (
          response.data.detail &&
          response.data.detail.includes("Downgrade scheduled")
        ) {
          toast.success("Downgrade scheduled at period end.");
        } else {
          toast.success(
            "Subscription update initiated. Please wait while we update your subscription."
          );
        }
      }
    } catch (error: any) {
      toast.error("Failed to update subscription: " + error.message);
    }
  };

  const handleSpendCredits = async () => {
    try {
      const response = await api.post("/api/subscriptions/spend-credits/", {
        amount: spendAmount,
      });

      if (response.data.checkout_url) {
        localStorage.setItem("expectedCredits", "200000");
        setPollingType("credits");
        window.location.href = response.data.checkout_url;
        return;
      }

      toast.success("Credits spent successfully!");
    } catch (error: any) {
      if (
        error.response?.status === 402 &&
        error.response?.data?.checkout_url
      ) {
        localStorage.setItem("expectedCredits", "200000");
        setPollingType("credits");
        window.location.href = error.response.data.checkout_url;
      } else {
        toast.error(
          "Failed to spend credits: " +
            (error.response?.data?.detail || error.message)
        );
      }
    }
  };

  const handlePollingClose = () => {
    setIsPollingOpen(false);
    window.history.replaceState(null, "", window.location.pathname);
    localStorage.removeItem("expectedPlan");
    localStorage.removeItem("expectedCredits");
    router.refresh();
  };

  const handleCancelDowngrade = async () => {
    try {
      await api.post("/api/subscriptions/cancel-downgrade/");
      toast.success("Downgrade cancelled successfully.");
      const userRes = await api.get("/api/auth/user/");
      setSubscription(userRes.data.subscription || userRes.data);
    } catch (error: any) {
      toast.error("Failed to cancel downgrade: " + error.message);
    }
  };

  return (
    <>
      {isPollingOpen && pollingType === "subscription" && (
        <BillingUpdatePolling
          type="subscription"
          open={isPollingOpen}
          onClose={handlePollingClose}
          expectedPlan={selectedPlan}
        />
      )}
      {isPollingOpen && pollingType === "credits" && (
        <BillingUpdatePolling
          type="credits"
          open={isPollingOpen}
          onClose={handlePollingClose}
          expectedCredits={200000}
        />
      )}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold">My Subscription</h1>
            <p className="text-gray-500">
              Choose the plan that best fits your needs below to gain access to
              additional functionality on our site!
            </p>
            <div className="mt-4">
              <button
                onClick={handleManageSubscription}
                className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50"
                disabled={!subscription}
              >
                Manage my Subscription
              </button>
            </div>
          </div>

          <div className="border p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Change Subscription Plan</h2>
            <div className="flex flex-col gap-4">
              <label className="text-gray-700">
                Select a plan:
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="ml-2 border rounded-md p-2"
                >
                  <option value="Free">Free</option>
                  <option value="Pro">Pro</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </label>
              <button
                onClick={handleContinue}
                className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground"
              >
                Continue
              </button>
              {subscription?.cancel_at_period_end && (
                <button
                  onClick={handleCancelDowngrade}
                  className="px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white"
                >
                  Cancel Downgrade
                </button>
              )}
            </div>
          </div>

          <div className="border p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">
              Spend Credits (Only for developers)
            </h2>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={spendAmount}
                onChange={(e) => setSpendAmount(Number(e.target.value))}
                className="border rounded-md p-2 w-24"
                placeholder="Amount"
              />
              <button
                onClick={handleSpendCredits}
                className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground"
              >
                Spend
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
