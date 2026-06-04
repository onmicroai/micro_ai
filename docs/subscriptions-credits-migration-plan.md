# Migration Plan: Simplify Subscriptions + Credits

Status: Phase 6 complete

## Goal

Replace the tangled `Subscription` + `BillingCycle` + synthetic-free-subscription +
`TopUpToSubscription` model with a simpler, best-practice shape for a tier-based
product where tiers grant monthly credits (which reset) and AI usage spends credits.

## Target architecture

- **Stripe** = source of truth for plan/payment state.
- **`TIERS` map in code** = entitlements (monthly credits, max apps) derived from `price_id`.
- **`CreditWallet`** = one row per user: `subscription_credits` (reset monthly) +
  `topup_credits` (roll over, never reset).
- **`CreditTransaction`** = append-only audit log (replaces `UsageEvent` + per-cycle rows).
- **Reset model**: subscription credits reset to the tier allotment each period via
  *lazy reset* on access plus a webhook trigger (`invoice.paid`). Top-ups never reset.
- **Plan changes** delegated to the Stripe Customer Portal (removes the
  `SubscriptionSchedule` machinery).

```
Stripe (plan status) --webhooks--> Subscription mirror
Subscription.price_id --> TIERS map --> monthly_credits --> CreditWallet
AI run --spend--> CreditWallet --> CreditTransaction (audit log)
```

## Confirmed decisions

1. **Free-tier reset = lazy reset** (no cron). On credit check/spend, if `now >= reset_at`,
   refill subscription credits and advance `reset_at`. Mirrors the current lazy
   free-subscription creation in `check_for_available_credits`.
2. **Plan changes = Stripe Customer Portal.** Removes `UpdateSubscription` schedule logic,
   `CancelDowngrade`, `cancel_active_schedule`, `is_downgrade`. Frontend plan-change UI
   collapses to a single "Manage subscription" portal redirect.
3. **`max_apps` default source moves to the `TIERS` map.** `SubscriptionConfiguration`
   and coupons stay for now; the coupon "add credits" action writes to
   `CreditWallet.topup_credits` instead of `TopUpToSubscription`.
4. **Metered Stripe usage** (`ReportUsageAPI`, `ListUsageRecordsAPI`) is unused by the
   credit system and will be removed.

## New data model

```python
class CreditWallet(models.Model):
    user = OneToOneField(AUTH_USER_MODEL, related_name="wallet")
    subscription_credits = IntegerField(default=0)   # reset each period
    topup_credits        = IntegerField(default=0)   # never reset
    reset_at             = DateTimeField()           # next subscription-credit refill
    updated_at           = DateTimeField(auto_now=True)

class CreditTransaction(models.Model):
    user       = ForeignKey(AUTH_USER_MODEL, related_name="credit_transactions")
    amount     = IntegerField()                      # + grant, - spend
    reason     = CharField(...)  # monthly_grant | usage | topup | coupon | adjustment
    run        = ForeignKey("microapps.Run", null=True)
    consumer   = ForeignKey(AUTH_USER_MODEL, null=True, related_name="consumed_credit_transactions")
    created_at = DateTimeField(auto_now_add=True)
```

Tier config lives in `apps/subscriptions/constants.py` as a `TIERS` dict keyed by plan
name, with a `tier_for_price(price_id)` helper (defaults to Free).

## Central credit service

New `apps/subscriptions/credits.py` centralizes everything that touches credits:

- `get_or_create_wallet(user)`
- `ensure_period_fresh(wallet, subscription)` — lazy reset
- `grant_subscription_credits(user, tier, period_end)` — reset to allotment
- `grant_topup_credits(user, amount, reason="topup")`
- `spend_credits(user, amount, run=None, consumer=None)` — atomic, subscription-first then top-up
- `available_credits(user)`

`spend_credits` replaces the duplicated deduction logic in
`microapps/views/mixins.py`, `subscriptions/views/api_views.py:SpendCredits`, and the
checks in `utils/usage_helper.py`.

## Phased execution

### Phase 1 — Add new models alongside old (no behavior change)
- Add `CreditWallet`, `CreditTransaction`, `TIERS`, `credits.py`.
- Additive migration only. Nothing reads/writes the new tables yet. Safe to deploy.

### Phase 2 — Data backfill migration
Per user: create `CreditWallet`;
`subscription_credits = open BillingCycle.credits_remaining` (0 if none);
`topup_credits = sum(TopUpToSubscription.remaining_credits)`;
`reset_at = open BillingCycle.end_date` else `now + 30d`.
Optionally seed `CreditTransaction` from `UsageEvent`.

### Phase 3 — Switch writes/reads to the wallet
| Current code | Change |
|---|---|
| `mixins.py update_user_credits` | call `spend_credits(...)` |
| `api_views.py SpendCredits` | call `spend_credits`; on insufficient, return checkout redirect |
| `usage_helper.py check_for_available_credits` | use `available_credits`/`ensure_period_fresh`; drop free-`BillingCycle` creation |
| `run_views.py get_user_plan` | derive tier from `subscription.price_id` via `tier_for_price` |
| `analytics_views.py BillingDetails` | build response from wallet (compat shape) |

### Phase 4 — Simplify webhooks
- Keep `customer.created`, `customer.subscription.created/updated/deleted`, `customer.deleted`.
- Add `invoice.paid` (`billing_reason == "subscription_cycle"`) -> reset subscription credits.
- `checkout.session.completed` -> top-ups via `grant_topup_credits`.
- Drop `payment_method.attached`.
- `upsert_subscription` shrinks to "update mirror + grant on new period".
- NOTE: `tests/test_webhooks.py` imports `get_price_data`/`get_subscription_id`/
  `get_cancel_at_period_end` which no longer exist — already stale; rewrite against new handlers.

### Phase 5 — Delegate plan changes to Portal + frontend update
- Replace `UpdateSubscription` schedule logic and `CancelDowngrade` with a portal redirect.
- Frontend: existing-customer plan change -> `portal-session/`; remove cancel-downgrade UI.

### Phase 6 — Delete dead code & tables
- Drop `BillingCycle`, `TopUpToSubscription`, `UsageEvent` (if history seeded),
  `SubscriptionConfiguration` (if folded in).
- Delete `create_next_cycle`, `get_or_create_active_cycle`, `cancel_active_schedule`,
  `is_downgrade`, `update_or_create_free_subscription`, `create_free_billing_cycle`,
  `get_default_credits_from_plan`.
- Delete `ReportUsageAPI`/`ListUsageRecordsAPI` + routes.
- Remove `source`/synthetic-free handling from `Subscription`. Update `admin.py`.

## API compatibility

Keep `/api/microapps/user/billing` returning the same shape derived from the wallet so
`frontend/.../subscription/page.tsx` and `hooks/useUserMenu.ts` keep working:
`billing_details[0]` with `credits_allocated/used/remaining/start_date/end_date` plus
`top_up_credits`. `/api/auth/user/` keeps returning `subscription` + `plan`.

## Testing

- Unit: `spend_credits` ordering/overflow/insufficient; `ensure_period_fresh` boundary; `grant_*`.
- Webhook: rebuild `test_webhooks.py` with `invoice.paid` + `customer.subscription.updated` fixtures.
- Backfill: assert post-migration `total_available` == pre-migration `credits_remaining + top_up_total`.
- E2E (Stripe test mode): checkout funds wallet; `stripe trigger invoice.paid` resets; top-up increments.

## Risk & rollout

- Phases 1–2 are additive and reversible.
- Optional dual-write during Phase 3 (keep writing `BillingCycle`) for one release as a safety net.
- Lazy-reset edge: a user inactive across a period refills on next access; `invoice.paid` also refills proactively.
- Biggest behavioral change: dropping in-app `SubscriptionSchedule` downgrades in favor of the portal.
