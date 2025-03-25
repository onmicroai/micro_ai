import React, { useEffect } from 'react';

export function StripePricingTable() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/pricing-table.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return React.createElement('stripe-pricing-table', {
    'pricing-table-id': 'prctbl_1QzdPLRtFHpgtOZ3gWAzbs39',
    'publishable-key': 'pk_test_51QFIuHRtFHpgtOZ38SIDYrdbV7C25s9rzfd81cucxl8JAxhRrjB1KIGqDxLX1KssyCEl2wPdP1TaHAlZFGnJHLge00W3BY6ZjH',
  });
}
