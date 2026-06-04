# Stripe local development

## Webhooks

From repo root (`micro_ai/`):

```bash
stripe listen --forward-to http://127.0.0.1:8000/stripe/webhook/
```

Copy the CLI `whsec_...` into `.env` as `STRIPE_WEBHOOK_SECRET_KEY`, then restart the `web` container.

## Customer Portal (Pro / Enterprise plan changes)

Plan upgrades use Stripe’s **subscription_update_confirm** deep link. That only works if the portal configuration allows subscription updates.

1. Open [Stripe Dashboard → Customer portal](https://dashboard.stripe.com/test/settings/billing/portal) (**Test mode** on).
2. Open the configuration whose ID is in `.env` as `DEFAULT_PORTAL_CONFIGURATION_ID` (`bpc_...`), or edit the **default** configuration if that env var is empty.
3. Under **Subscriptions**, enable **Customers can switch plans** (API: `features.subscription_update.enabled = true`).
4. Add the products/prices customers may switch between — at minimum your **Pro** and **Enterprise** recurring prices (same `price_...` IDs as `PRO_PLAN_PRICE_ID` and `ENTERPRISE_PLAN_PRICE_ID` in `.env`).
5. Save. Retry **Enterprise** on `/settings/subscription`.

If you see `subscription update feature in the portal configuration is disabled`, that configuration still has updates turned off or the target price is not in the allowed product list.

**Top-up credits** use **Checkout** (`checkout-session`), not the portal — no portal change needed for Test 6.
