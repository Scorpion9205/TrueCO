---
description: RBAC, Authorization, and Subscription / Feature-Flag Rules
globs: "apps/api/src/modules/rbac/**/*.ts,apps/api/src/modules/billing/**/*.ts,apps/api/src/common/middleware/**/*.ts"
always_on: true
---

# RBAC & Subscription Feature-Flag Rules

TrueCO enforces a unified authorization and billing choke point. Access control is divided into two distinct dimensions:
1. **RBAC**: Does the user have permission to perform this action?
2. **Subscription / Feature Flag**: Does this tenant's plan license this capability?

---

## 1. Role-Based Access Control (RBAC)

### 1.1 Roles
- `SUPER_ADMIN`: Platform-wide operator.
- `OWNER`: Full administrative authority within their `coachingId`.
- `TEACHER`: Scoped to assigned batches within their `coachingId`.

### 1.2 Granular Permissions
- Permissions follow `resource:action` format: e.g. `attendance:mark`, `attendance:read`, `fees:collect`, `fees:refund`, `students:create`.
- Stored relationally: `Users` -- `UserRoles` -- `Roles` -- `RolePermissions` -- `Permissions`.
- Evaluated in tenant context; cached in Redis per session.

### 1.3 Guards & Decorators
- `@RequirePermission('resource:action')`:
  - Checked on all mutating and sensitive endpoints.
- `@RequireBatchAccess()`:
  - For Teacher roles, asserts that the requested `batchId` exists in `TeacherBatches`.

---

## 2. Subscription & Feature-Flag Choke Point

### 2.1 Single Choke Point via `loadSubscriptionState`
- Middleware executes before route handlers and loads the tenant's active plan, status, and feature bundle.
- State is cached in Redis with a 60-second TTL to eliminate database overhead on hot paths.

### 2.2 Subscription Lifecycle
1. **`TRIALING`**:
   - Auto-created upon coaching registration with `trialEndsAt = now() + 60 days`.
   - **Crucial Rule**: The 60-day trial unlocks the **ENTIRE feature bundle** (core ERP + advanced reports + AI capabilities) with an initial AI trial credit wallet.
2. **`ACTIVE`**:
   - Paid subscription with features defined by the selected plan (`STARTER`, `PRO_AI`, `ENTERPRISE`) plus any `CoachingFeatureOverrides`.
3. **`PAST_DUE` / `GRACE`**:
   - Grace period (7 days) allowing read access and pending operations with reminder banners.
4. **`EXPIRED`**:
   - Write operations denied. Read access remains active so owners can export their records.

### 2.3 Feature Gate Enforcement (`@RequireFeature`)
- Routes gated by plan tier must use `@RequireFeature('feature_name')`.
- If a tenant lacks the feature or the subscription is expired, the API must return:
  ```json
  {
    "error": {
      "code": "FEATURE_LOCKED",
      "message": "This feature requires an active Pro AI or Enterprise plan.",
      "details": {
        "requiredFeature": "ai.insights",
        "currentPlan": "STARTER",
        "upgradeUrl": "https://app.trueco.in/billing/upgrade"
      }
    }
  }
  ```
- HTTP Status Code: **`402 Payment Required`**.
