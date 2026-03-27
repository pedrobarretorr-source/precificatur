# Supabase Schema Design — PrecificaTur
**Date:** 2026-03-27
**Status:** Approved

## Overview

Multi-tenant Supabase schema for the PrecificaTur platform. Each user (person or company) gets their own isolated organization. Routes, costs, and simulations are private per organization. Supports 1 owner + up to 2 collaborators per org. Initial plan: free only. Strong RLS on all tables.

---

## Migration Preamble

The following must be the first statement in any migration file, before all function and table definitions:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

---

## Section 1: Auth & Profile

Supabase manages authentication via `auth.users`. A `profiles` table mirrors the user record and stores display data.

```sql
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

A trigger `handle_new_user()` fires `AFTER INSERT ON auth.users` and auto-provisions:
1. A `profiles` row
2. An `organizations` row (name = "Organização de {full_name}", slug auto-generated)
3. An `organization_members` row (role = `'owner'`)

The user is never left without an organization.

---

## Section 2: Multi-tenancy

```sql
CREATE TABLE public.organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL CHECK (slug <> ''),
  plan       text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('owner', 'collaborator')),
  invited_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
```

**Member limit:** A `BEFORE INSERT` trigger `check_org_member_limit()` on `organization_members` raises an exception if the existing member count is already >= 3 (i.e., the org is full), blocking any attempt to exceed 3 members total. This is enforced at the database level, not just the frontend. The `handle_new_user()` provisioning path always inserts the owner into a freshly created org (0 existing members), so it is unaffected by this limit.

**Slug generation:** `generate_org_slug(name text)` normalizes the name (lowercase, remove accents, replace spaces with `-`) and appends a numeric suffix (`-2`, `-3`…) if a collision exists.

---

## Section 3: Routes

Routes belong to an organization. Costs are stored as JSONB, mirroring the existing TypeScript types in `src/types/index.ts`.

```sql
CREATE TABLE public.routes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Basic info
  name             text NOT NULL,
  destination      text,
  route_type       text NOT NULL CHECK (route_type IN (
                     'city_tour', 'aventura', 'cultural', 'gastronomico',
                     'ecologico', 'religioso', 'historico', 'personalizado')),
  currency         text NOT NULL DEFAULT 'BRL'
                        CHECK (currency IN ('BRL', 'USD', 'EUR', 'VES')),
  exchange_rate    numeric(10,4) NOT NULL DEFAULT 1.0,
  duration_days    int NOT NULL DEFAULT 1 CHECK (duration_days >= 1),

  -- Costs (JSONB — mirrors TypeScript types)
  fixed_costs      jsonb NOT NULL DEFAULT '[]',
  variable_costs   jsonb NOT NULL DEFAULT '[]',
  days             jsonb NOT NULL DEFAULT '[]',

  -- Last simulation parameters (for UI restore)
  last_pax_min     int,
  last_pax_max     int,
  last_pax_step    int,
  last_margin      numeric(5,2),

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
```

**JSONB structures:**

```json
// fixed_costs item
{ "id": "uuid", "label": "Van/Transfer", "category": "transfer", "amount": 500, "currency": "BRL" }

// variable_costs item
// "type": "fixed" | "percentage"
//   "fixed"      → cost is a fixed amount per pax (amount field)
//   "percentage" → cost is calculated as a % of the fixed-costs total (amount field holds the %)
// "isPercentage" = (type === "percentage") — always recomputed from "type" in the frontend
//   save handler (the React component/service that calls Supabase) before writing to the DB.
//   Never store client-supplied isPercentage directly. Derivation rule applies to BOTH
//   top-level variable_costs items AND days[*].variableCosts items.
//   The pricing engine reads "isPercentage" as the runtime flag. "type" is the source of truth.
{ "id": "uuid", "label": "Refeição", "type": "fixed", "amount": 50, "isPercentage": false }

// days item (multi-day routes)
// days[*].variableCosts items follow the same schema as top-level variable_costs items above
{ "id": "uuid", "name": "Dia 1", "activities": "...", "variableCosts": [
  { "id": "uuid", "label": "Refeição", "type": "fixed", "amount": 50, "isPercentage": false }
]}
```

**Currency model:** `routes.currency` is the base currency for the route. `fixed_costs[*].currency` is metadata recording the original currency of each cost item (mirrors the frontend `CostItem` type). `routes.exchange_rate` is a single rate applied uniformly to convert all foreign-currency items to the route's base currency. Individual cost items do not carry their own rate — the pricing engine uses the one route-level rate.

**Saves overwrite — no versioning.** The `updated_at` trigger records the timestamp of the last save.

---

## Section 4: Row Level Security

All tables have RLS enabled. Users can only access data belonging to their organization.

```sql
-- profiles
-- INSERT: handle_new_user (SECURITY DEFINER) bypasses RLS entirely at signup.
-- The policy below permits a direct re-insert only if the profile row was lost
-- (e.g., partial trigger failure). It is not a normal application path.
-- Production recovery: use service_role key to repair missing profiles.
-- DELETE: no explicit policy — direct DELETE by users is blocked by RLS (intentional).
--   Profile deletion is only possible via auth.users CASCADE DELETE (admin-initiated).
--   Note: FK cascade deletes always bypass RLS in PostgreSQL — no additional policy needed.
CREATE POLICY "users_insert_own_profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- organizations
-- INSERT: blocked by RLS for all users. All org creation goes through the
--   handle_new_user SECURITY DEFINER trigger. No direct user insert path exists.
-- DELETE: blocked by RLS for all users (intentional security decision).
--   Org deletion requires the service_role key and is an admin-only operation.
CREATE POLICY "members_read_org" ON public.organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organizations.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "owner_update_org" ON public.organizations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organizations.id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- organization_members
-- The owner_insert_member policy is bypassed for the handle_new_user trigger
-- because it runs as SECURITY DEFINER (no auth.uid() context during signup bootstrap).
-- In the INSERT WITH CHECK below, `organization_members.organization_id` refers to the
-- incoming row's column (PostgreSQL resolves this correctly in WITH CHECK context —
-- the subquery scans existing rows, not the new row).
CREATE POLICY "members_read_same_org" ON public.organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "owner_insert_member" ON public.organization_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organization_members.organization_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- UPDATE: only the org owner can change a member's role (e.g., promote collaborator to owner).
-- Role changes are permitted; updated_at is not tracked (see Out of Scope).
CREATE POLICY "owner_update_member_role" ON public.organization_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = auth.uid()
        AND om2.role = 'owner'
    )
  );

-- Owner self-delete is blocked by the prevent_ownerless_org trigger (Section 5).
CREATE POLICY "member_leave_or_owner_remove" ON public.organization_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organization_members.organization_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- routes (full isolation per org)
CREATE POLICY "org_routes_select" ON public.routes
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_routes_insert" ON public.routes
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_routes_update" ON public.routes
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_routes_delete" ON public.routes
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
```

**Security notes:**
- `service_role` key bypasses RLS — never expose it in the frontend
- Frontend uses `anon key` — always filtered by RLS
- SSL is enabled by default in Supabase (non-configurable)
- No table has public access without authentication

---

## Section 5: Triggers & Functions

All functions use `SECURITY DEFINER` so they can write to tables during user bootstrap without RLS interference.

**Required migration execution order:**

> **Important:** Run the entire migration as a single SQL transaction (`BEGIN; ... COMMIT;`). Tables have `ENABLE ROW LEVEL SECURITY` applied immediately at creation time (in Section 2/3 DDL). If policies are not yet created, all user access is denied. Running in a single transaction ensures no intermediate state is observable.

1. `CREATE EXTENSION IF NOT EXISTS unaccent` (Migration Preamble)
2. All `CREATE TABLE` + `ENABLE ROW LEVEL SECURITY` statements
3. `generate_org_slug` function (must exist before `handle_new_user` references it)
4. `handle_new_user` + all other functions
5. All triggers
6. All RLS policies
7. All indexes

```sql
-- Function A: Slug generation helper (MUST be defined before handle_new_user)
-- NOTE: Requires the unaccent extension — see migration preamble.
CREATE OR REPLACE FUNCTION public.generate_org_slug(name text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 2;
BEGIN
  -- lower() must be applied before regexp_replace so uppercase letters are
  -- lowercased before the [^a-z0-9]+ pattern runs (otherwise they become '-')
  base_slug := regexp_replace(lower(unaccent(name)), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  -- Fallback: if name is entirely non-alphanumeric (e.g. "---"), use 'org' as base
  IF base_slug = '' THEN
    base_slug := 'org';
  END IF;
  final_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;

  RETURN final_slug;
END;
$$;

-- Function B: Auto-provisioning on signup
-- All three inserts run atomically within the same transaction as auth.users INSERT.
-- If the trigger raises an exception, the entire transaction is rolled back — including
-- the auth.users row. The signup attempt fails cleanly; the user can retry.
-- The EXCEPTION block logs errors from within handle_new_user's body. Errors thrown
-- by called functions (e.g., generate_org_slug) before reaching this body propagate
-- as undecorated errors — visible in Supabase dashboard logs under "postgres" level.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  org_id uuid;
  user_name text;
  org_slug text;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  org_slug  := public.generate_org_slug('Organização de ' || user_name);

  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, user_name);

  INSERT INTO public.organizations (name, slug)
  VALUES ('Organização de ' || user_name, org_slug)
  RETURNING id INTO org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (org_id, NEW.id, 'owner');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error (visible in Supabase dashboard logs) and re-raise
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RAISE;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function C: Member limit enforcement (SECURITY DEFINER ensures full count regardless of caller's RLS context)
CREATE OR REPLACE FUNCTION public.check_org_member_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.organization_members
    WHERE organization_id = NEW.organization_id
  ) >= 3 THEN
    RAISE EXCEPTION 'Organization member limit reached (max 3)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_org_member_limit
  BEFORE INSERT ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.check_org_member_limit();

-- Function D: Prevent removing the last owner (no ownerless orgs)
CREATE OR REPLACE FUNCTION public.prevent_ownerless_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = OLD.organization_id
        AND role = 'owner'
        AND id != OLD.id
    ) THEN
      RAISE EXCEPTION 'Cannot remove the last owner of an organization';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

-- Fires on DELETE (member removed) and on UPDATE (role changed, e.g., owner → collaborator)
CREATE TRIGGER enforce_org_has_owner
  BEFORE DELETE OR UPDATE OF role ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ownerless_org();

-- Function E: updated_at auto-update
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_routes_updated_at
  BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

```

---

## Section 6: Indexes

```sql
-- Critical: used in every RLS policy check
CREATE INDEX idx_org_members_user_id
  ON public.organization_members (user_id);

CREATE INDEX idx_org_members_org_id
  ON public.organization_members (organization_id);

-- Routes listing
CREATE INDEX idx_routes_org_id
  ON public.routes (organization_id);

CREATE INDEX idx_routes_created_by
  ON public.routes (created_by);

-- GIN for future JSONB searches within costs
CREATE INDEX idx_routes_fixed_costs_gin
  ON public.routes USING GIN (fixed_costs);
```

`idx_org_members_user_id` is the most critical — without it, every RLS check performs a sequential scan on the members table.

**Note on implicit indexes:** The `UNIQUE (organization_id, user_id)` constraint on `organization_members` automatically creates a composite B-tree index on `(organization_id, user_id)`. The planner will use this implicit index for queries filtering by both columns (e.g., the `members_read_org` policy subquery). The explicit `idx_org_members_user_id` covers single-column `user_id` lookups (e.g., the `members_read_same_org` policy). Both indexes serve different query shapes and are needed.

The `UNIQUE NOT NULL` constraint on `organizations.slug` also creates an implicit B-tree index, which is used by the `generate_org_slug` collision-check loop. No explicit index on `slug` is needed.

---

## Files Changed

| File | Change |
|------|--------|
| (new migration file) | Full schema SQL — to be applied via Supabase SQL editor or migration tool |

No application code changes in this spec. Supabase integration (auth calls, route persistence) is a separate implementation step.

---

## Out of Scope

- Exchange rate history table
- Paid plans / billing
- Route versioning / audit log
- Email invitation flow (structure exists via `invited_by`, UI not built)
- Supabase Storage (avatars)
- Real-time subscriptions
- `organization_members` mutation audit (`updated_at` not tracked — role changes have no timestamp)
- Automated remediation for partial `handle_new_user()` trigger failures (requires manual `service_role` fix)
- Maximum slug length enforcement (slugs are unbounded `text`; application should truncate long names before passing to `generate_org_slug` if URL length is a concern)
- Simulation parameter consistency constraints (`last_pax_min/max/step/margin` are individually nullable; partial state is accepted; the UI restore layer must handle null checks)
