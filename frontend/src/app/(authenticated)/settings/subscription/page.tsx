"use client";

import { useEffect, useState, useCallback } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { toast } from "react-toastify";
import BillingUpdatePolling from "./billing-update-polling";
import { useRouter } from "next/navigation";
import { PricingCards } from "@/components/PricingCards";

const stripeEnabled = Boolean(
  process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY?.trim(),
);

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

interface BillingDetails {
  credits_allocated: number;
  credits_used: number;
  credits_remaining: number;
  start_date: string;
  end_date: string;
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingDetails, setBillingDetails] = useState<BillingDetails | null>(
    null,
  );
  const [userData, setUserData] = useState<any>(null);
  const [topUpCredits, setTopUpCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string>("Free");
  const [isPollingOpen, setIsPollingOpen] = useState<boolean>(false);
  const [pollingType, setPollingType] = useState<
    "subscription" | "credits" | null
  >(null);
  const [appQuota, setAppQuota] = useState<null | {
    limit: number;
    used: number;
    remaining: number;
    can_create: boolean;
  }>(null);
  const [couponCode, setCouponCode] = useState<string>("");
  const [couponLoading, setCouponLoading] = useState<boolean>(false);
  const [couponError, setCouponError] = useState<string>("");
  const [couponSuccess, setCouponSuccess] = useState<string>("");
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

  const fetchCredits = useCallback(async () => {
    try {
      const response = await api.get(`/api/microapps/user/billing`);
      const currentBillingCycle = response.data.billing_details[0];
      setBillingDetails(currentBillingCycle);
      setTopUpCredits(response.data.top_up_credits || 0);
    } catch (error: any) {
      console.error("Error fetching credits:", error);
    }
  }, [api]);

  useEffect(() => {
    let isMounted = true;
    const timeoutId: NodeJS.Timeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
        toast.error("Request timeout. Please refresh the page.");
      }
    }, 30000); // 30 second timeout

    const fetchData = async () => {
      try {
        const [userRes] = await Promise.all([
          api.get("/api/auth/user/"),
          fetchCredits(),
        ]);

        if (!isMounted) return;

        const userData = userRes.data;
        setUserData(userData);
        setSubscription(userData.subscription);
        if (userData.plan) {
          setSelectedPlan(userData.plan);
        }
        // Fetch app quota after user is loaded
        const quotaRes = await api.get("/api/microapps/quota/");
        if (quotaRes.data && quotaRes.data.data) {
          setAppQuota(quotaRes.data.data);
        }
      } catch (error: any) {
        if (isMounted) {
          toast.error("Failed to load subscription data: " + error.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [api, fetchCredits]);

  const handleManageSubscription = async () => {
    try {
      const response = await api.post("/api/subscriptions/portal-session/");
      window.location.href = response.data.url;
    } catch (error: any) {
      toast.error("Failed to open billing portal: " + error.message);
    }
  };

  const handlePlanSelection = async (plan: string) => {
    setSelectedPlan(plan);

    try {
      if (
        plan !== "Free" &&
        (!subscription?.customer_id ||
          subscription?.status === "canceled" ||
          subscription?.status === "incomplete_expired")
      ) {
        const response = await api.post(
          "/api/subscriptions/checkout-session/",
          {
            plan: plan,
            successUrl: `${window.location.origin}/settings/subscription?updated=success`,
            cancelUrl: `${window.location.origin}/settings/subscription?updated=failure`,
          },
        );
        window.location.href = response.data.url;
        localStorage.setItem("expectedPlan", plan);
      } else {
        const response = await api.post(
          "/api/subscriptions/update-subscription/",
          {
            plan: plan,
          },
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
            "Subscription update initiated. Please wait while we update your subscription.",
          );
        }
      }
    } catch (error: any) {
      toast.error("Failed to update subscription: " + error.message);
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

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }

    if (couponLoading) {
      return; // Prevent multiple simultaneous requests
    }

    setCouponLoading(true);
    setCouponError("");
    setCouponSuccess("");

    try {
      const response = await api.post("/api/subscriptions/redeem-coupon/", {
        coupon_code: couponCode.trim(),
      });

      if (response.data.success) {
        setCouponSuccess(response.data.message);
        setCouponCode("");

        // Refresh the page data to show updated values
        const [userRes, quotaRes] = await Promise.all([
          api.get("/api/auth/user/"),
          api.get("/api/microapps/quota/"),
          fetchCredits(),
        ]);

        const userData = userRes.data;
        setUserData(userData);
        setSubscription(userData.subscription);
        if (userData.plan) {
          setSelectedPlan(userData.plan);
        }

        if (quotaRes.data && quotaRes.data.data) {
          setAppQuota(quotaRes.data.data);
        }

        // Clear success message after 5 seconds
        setTimeout(() => setCouponSuccess(""), 5000);
      } else {
        setCouponError(response.data.error || "Failed to redeem coupon");
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        "Failed to redeem coupon";
      setCouponError(errorMessage);
    } finally {
      setCouponLoading(false);
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
            <h1 className="text-2xl font-bold">
              {stripeEnabled ? "My Subscription" : "Usage"}
            </h1>
          </div>

          {/* Raw Subscription Details Display */}
          {userData && (
            <div className="mt-6">
              {billingDetails && (
                <div className="flex flex-col items-center mt-4 mb-4">
                  <div className="rounded-lg w-full bg-background border divide-y">
                    {/* Header Section */}
                    <div className="flex max-sm:flex-col justify-between items-center max-sm:items-start gap-3 px-6 py-4">
                      <span className="font-semibold text-base">
                        {stripeEnabled
                          ? "Subscription Details"
                          : "Usage Details"}
                      </span>
                      {stripeEnabled && (
                        <button
                          onClick={handleManageSubscription}
                          className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground disabled:opacity-50"
                          disabled={!subscription?.customer_id}
                        >
                          Manage my Payment Method
                        </button>
                      )}
                    </div>

                    {/* Plan Section */}
                    <div className="flex gap-4 px-6 py-4 items-center justify-between">
                      <span className="font-medium text-sm text-gray-700">
                        Current Plan
                      </span>
                      <div className="inline-flex items-center text-xs px-2.5 h-6 rounded-full font-medium bg-gray-alpha-100">
                        {selectedPlan}
                      </div>
                    </div>

                    {/* Subscription Status */}
                    {stripeEnabled && (
                      <div className="flex gap-4 px-6 py-4 items-center justify-between">
                        <span className="font-medium text-sm text-gray-700">
                          Subscription status
                        </span>
                        <div className="inline-flex items-center text-xs px-2.5 h-6 rounded-full font-medium bg-green-100 text-green-950">
                          {userData.subscription?.cancel_at_period_end
                            ? "Canceling"
                            : "Active"}
                        </div>
                      </div>
                    )}

                    {/* Max Apps */}
                    <div className="flex gap-4 px-6 py-4 items-center justify-between">
                      <span className="font-medium text-sm text-gray-700">
                        Max Apps
                      </span>
                      <div
                        className={`inline-flex items-center text-xs px-2.5 h-6 rounded-full font-medium ${
                          appQuota
                            ? appQuota.can_create
                              ? "bg-green-100 text-green-950"
                              : "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {appQuota
                          ? appQuota.limit >= 9999
                            ? `${appQuota.used} / Unlimited`
                            : `${appQuota.used} / ${appQuota.limit}`
                          : "-"}
                      </div>
                    </div>

                    {/* Billing Period Section */}
                    <div className="flex gap-4 px-6 py-4 items-center justify-between">
                      <span className="font-medium text-sm text-gray-700">
                        Billing Period
                      </span>
                      <span className="text-sm">
                        {new Date(
                          billingDetails.start_date,
                        ).toLocaleDateString()}{" "}
                        -{" "}
                        {new Date(billingDetails.end_date).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Credits Usage Section */}
                    <div className="gap-4 px-6 py-4 items-center block">
                      <span className="font-medium text-sm text-gray-700">
                        Credit Usage
                      </span>
                      <span className="font-medium text-right block text-xs text-gray-500 mb-3 max-sm:hidden">
                        {billingDetails.credits_used.toLocaleString()} /{" "}
                        {billingDetails.credits_allocated.toLocaleString()} used
                        (Resets on{" "}
                        {new Date(billingDetails.end_date).toLocaleDateString()}
                        )
                      </span>
                      <div className="bg-gray-200 h-[6px] rounded-full max-sm:mt-3 w-full">
                        <div
                          className="bg-blue-600 h-[6px] rounded-full"
                          style={{
                            width: `${Math.min((billingDetails.credits_used / billingDetails.credits_allocated) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="px-6 py-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700">
                          Plan Credits Remaining
                        </span>
                        <span className="text-sm">
                          {billingDetails.credits_remaining.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-700">
                          Top-up Credits
                        </span>
                        <span className="text-sm">
                          {topUpCredits.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between bg-gray-50 p-2 rounded-md">
                        <span className="text-sm font-medium text-gray-900">
                          Total Credits Available
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {(
                            billingDetails.credits_remaining + topUpCredits
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Cancel Downgrade Section */}
                    {stripeEnabled &&
                      userData.subscription?.cancel_at_period_end && (
                        <div className="px-6 py-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-red-500">
                              Your plan will be downgraded on{" "}
                              {new Date(
                                billingDetails.end_date,
                              ).toLocaleDateString()}
                            </span>
                            <button
                              onClick={handleCancelDowngrade}
                              className="px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600"
                            >
                              Cancel Downgrade
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Plan selection - Stripe only */}
          {stripeEnabled && (
            <PricingCards
              showTopUp={false}
              currentPlan={selectedPlan}
              onPlanSelect={handlePlanSelection}
            />
          )}

          {/* Coupon Redemption Section */}
          <div className="mt-8">
            <div className="rounded-lg bg-background border">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  Redeem Coupon
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Have a coupon code? Enter it below to unlock additional
                  benefits.
                </p>
              </div>

              <div className="px-6 py-4">
                <div className="flex gap-3 max-sm:flex-col">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="Enter coupon code"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      disabled={couponLoading}
                    />
                  </div>
                  <button
                    onClick={handleRedeemCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {couponLoading ? "Redeeming..." : "Redeem"}
                  </button>
                </div>

                {/* Error Message */}
                {couponError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center">
                      <svg
                        className="w-5 h-5 text-red-400 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-red-700">
                        {couponError}
                      </span>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {couponSuccess && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center">
                      <svg
                        className="w-5 h-5 text-green-400 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-green-700">
                        {couponSuccess}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8"></div>
        </div>
      )}
    </>
  );
}
