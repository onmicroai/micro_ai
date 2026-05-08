import React, { useEffect } from 'react';

export function StripePricingTable() {
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY?.trim();
  const pricingTableId = process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID?.trim();

  useEffect(() => {
    if (!publishableKey) return;
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/pricing-table.js';
    script.async = true;
    document.body.appendChild(script);
  }, [publishableKey]);

  if (!publishableKey || !pricingTableId) return null;

  return React.createElement('stripe-pricing-table', {
    'pricing-table-id': pricingTableId,
    'publishable-key': publishableKey,
  });
}
