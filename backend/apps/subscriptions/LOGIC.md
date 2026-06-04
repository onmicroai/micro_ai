# Subscriptions & Credits — Logic Overview

This document describes how subscriptions, Stripe, and the credit system work after
the wallet migration (see `docs/subscriptions-credits-migration-plan.md`).

## Core concepts

| Concern | Source of truth | Model / location |
|--------|-----------------|------------------|
| Payment & plan status | **Stripe** | mirrored into `Subscription` via webhooks |
| Entitlements (credits/app limits per tier) | **Code** | `TIERS` map in `constants.py` |
| Spendable credits | **Database wallet** | `CreditWallet` (+ `CreditTransaction` ledger) |

- `subscription_credits` reset to the tier allotment each period. **Top-ups never reset.**
- Spending draws from `subscription_credits` first, then `topup_credits`.
- Free = no active Stripe subscription → `TIERS["Free"]`.

## Entity relationships

```mermaid
erDiagram
    CustomUser ||--o| CreditWallet : has
    CustomUser ||--o{ CreditTransaction : logs
    CustomUser ||--o| StripeCustomer : "has (if paid)"
    CustomUser ||--o{ Subscription : has
    StripeCustomer ||--o{ Subscription : "mirrors"
    CreditTransaction }o--|| Run : "references (usage)"

    CreditWallet {
        int subscription_credits "reset monthly"
        int topup_credits "roll over"
        datetime reset_at
    }
    CreditTransaction {
        int amount "+grant / -spend"
        string reason "monthly_grant|usage|topup|coupon|adjustment"
    }
    Subscription {
        string subscription_id
        string price_id
        string status
    }
```

## Tier resolution

```mermaid
flowchart LR
    S[Subscription.price_id] --> T{tier_for_price}
    T -->|matches PRO_PLAN_PRICE_ID| Pro[Pro: 100k credits]
    T -->|matches ENTERPRISE_PLAN_PRICE_ID| Ent[Enterprise: 400k credits]
    T -->|None / unknown| Free[Free: 10k credits]
```

## Credit spend on an AI run

```mermaid
sequenceDiagram
    participant FE as Frontend / run
    participant RV as run_views
    participant UH as usage_helper.check_for_available_credits
    participant CR as credits.spend_credits
    participant W as CreditWallet
    participant L as CreditTransaction

    FE->>RV: start run
    RV->>UH: check_user_credits(owner)
    UH->>UH: ensure free Subscription exists
    UH->>CR: available_credits(owner)
    CR->>W: get_or_create_wallet + ensure_period_fresh
    W-->>UH: total_available
    alt no credits
        UH-->>RV: has_credits = false
        RV-->>FE: 400 error
    else has credits
        RV->>RV: execute model run
        RV->>CR: spend_credits(owner, cost, run, consumer)
        CR->>W: deduct sub_credits then topup_credits (atomic)
        CR->>L: record -amount (reason=usage)
        CR-->>RV: remaining
    end
```

## Monthly reset

```mermaid
flowchart TD
    A[Credit access or Stripe event] --> B{Paid or Free?}

    B -->|Paid| C[Stripe invoice.paid]
    C --> D{billing_reason == subscription_cycle?}
    D -->|yes| E[grant_subscription_credits: reset to tier allotment]
    D -->|no| F[skip - handled by subscription.created/updated]

    B -->|Free| G[ensure_period_fresh on access]
    G --> H{now >= reset_at?}
    H -->|yes| I[reset subscription_credits, reset_at += 30d]
    H -->|no| J[no change]

    E --> K[topup_credits untouched]
    I --> K
```

## Plan lifecycle & Stripe communication

```mermaid
flowchart TD
    subgraph User actions
      A1[Buy plan] -->|checkout-session| CS[Stripe Checkout]
      A2[Upgrade/Downgrade/Cancel] -->|update-subscription| PORTAL[Stripe Customer Portal]
      A3[Buy top-up] -->|checkout-session payment mode| CS
    end

    subgraph Stripe -> webhooks
      CS --> WH[stripe_webhook]
      PORTAL --> WH
      WH --> E1[customer.subscription.created/updated -> upsert_subscription]
      WH --> E2[customer.subscription.deleted -> revert to Free]
      WH --> E3[invoice.paid -> monthly reset]
      WH --> E4[checkout.session.completed -> grant_topup_credits]
      WH --> E5[customer.deleted -> wipe + reset wallet to Free]
    end

    E1 --> SYNC[Sync wallet tier on create / plan change]
    E2 --> SYNC
    E3 --> RESET[Reset subscription_credits to tier allotment]
    E4 --> TOP[Add topup_credits]
```

## upsert_subscription wallet-sync rule

When a `subscription.created/updated/deleted` event arrives, the wallet is re-granted
**only** when membership materially changes:

```mermaid
flowchart TD
    A[upsert_subscription] --> B[Update Subscription mirror]
    B --> C{New subscription?}
    C -->|yes| G[grant tier credits]
    C -->|no| D{price_id changed?}
    D -->|yes| G
    D -->|no| E{status canceled / incomplete_expired?}
    E -->|yes| G2[grant Free credits]
    E -->|no| F[No credit change - preserve mid-period balance]
```

Routine updates (e.g. toggling `cancel_at_period_end`) do **not** refill credits;
the monthly reset is driven only by `invoice.paid`.
