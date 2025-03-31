"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
}

const Checkout = () => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch available subscription plans
        const fetchPlans = async () => {
            try {
                const response = await axiosInstance().get('/subscriptions/products/');
                setPlans(response.data);
            } catch (error) {
                console.error('Error fetching plans:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPlans();
    }, []);

    const handlePayment = async (priceId: string) => {
        try {
            const response = await axiosInstance().post('/subscriptions/create-checkout-session/', {
                priceId
            });
            
            if (response.data?.url) {
                window.location.href = response.data.url;
            } else {
                throw new Error('No checkout URL received');
            }
        } catch (error) {
            console.error('Error creating checkout session:', error);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>;
    }

    return (
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center">
                <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                    Choose your plan
                </h2>
                <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
                    Select the plan that best fits your needs
                </p>
            </div>

            <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:grid-cols-3">
                {plans.map((plan) => (
                    <div key={plan.id} 
                         className={`rounded-lg shadow-lg divide-y divide-gray-200`}>
                        <div className="p-6">
                            <h3 className="text-2xl font-semibold text-gray-900">{plan.name}</h3>
                            <p className="mt-4 text-gray-500">{plan.description}</p>
                            <p className="mt-8">
                                <span className="text-4xl font-extrabold text-gray-900">
                                    {new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: plan.currency,
                                    }).format(plan.price / 100)}
                                </span>
                                <span className="text-base font-medium text-gray-500">
                                    /{plan.interval}
                                </span>
                            </p>
                            <ul className="mt-6 space-y-4">
                                {plan.features.map((feature, index) => (
                                    <li key={index} className="flex">
                                        <svg className="flex-shrink-0 h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="ml-3 text-gray-500">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={() => handlePayment(plan.id)}
                                className="mt-8 block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-md text-center"
                            >
                                Subscribe Now
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Checkout;