# Supabase Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the complete PrecificaTur database schema to Supabase — tables, RLS policies, triggers, functions, and indexes — in a single atomic migration.

**Architecture:** All schema objects are written into one SQL migration file and applied via the Supabase SQL editor in a single transaction. No application code changes in this plan; Supabase auth and route persistence wiring is a separate step.

**Tech Stack:** PostgreSQL 15 (Supabase), `unaccent` extension, Supabase Dashboard SQL editor

**Spec:** `docs/superpowers/specs/2026-03-27-supabase-schema.md`

---

## Files

| Action | Path |
|--------|------|
| Create dir | `supabase/migrations/` |
| Create | `supabase/migrations/20260327000000_initial_schema.sql` |

---

## Task 1: Create the migration file — Extension + Tables

**Files:**
- Create: `supabase/migrations/20260327000000_initial_schema.sql`

- [ ] **Step 1: Create the supabase/migrations directory**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Write the migration preamble and table DDL**

Create `supabase/migrations/20260327000000_initial_schema.sql` with this exact content for the first block:

```sql
-- ============================================================
-- PrecificaTur — Initial Schema Migration
-- Apply via Supabase Dashboard > SQL Editor
-- Run the ENTIRE file as a single execution (not line by line)
-- ============================================================

BEGIN;

-- Extension (must come before functions that use unaccent)
-- NOTE: Supabase may install extensions in the 'extensions' schema.
-- If the migration fails with "function unaccent does not exist",
-- change SET search_path lines from:
--   SET search_path = public, pg_catalog
-- to:
--   SET search_path = public, extensions, pg_catalog
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL CHECK (slug <> ''),
  plan       text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('owner', 'collaborator')),
  invited_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.routes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name             text NOT NULL,
  destination      text,
  route_type       text NOT NULL CHECK (route_type IN (
                     'city_tour', 'aventura', 'cultural', 'gastronomico',
                     'ecologico', 'religioso', 'historico', 'personalizado')),
  currency         text NOT NULL DEFAULT 'BRL'
                        CHECK (currency IN ('BRL', 'USD', 'EUR', 'VES')),
  exchange_rate    numeric(10,4) NOT NULL DEFAULT 1.0,
  duration_days    int NOT NULL DEFAULT 1 CHECK (duration_days >= 1),
  fixed_costs      jsonb NOT NULL DEFAULT '[]',
  variable_costs   jsonb NOT NULL DEFAULT '[]',
  days             jsonb NOT NULL DEFAULT '[]',
  last_pax_min     int,
  last_pax_max     int,
  last_pax_step    int,
  last_margin      numeric(5,2),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 3: Commit the file so far**

```bash
git add supabase/migrations/20260327000000_initial_schema.sql
git commit -m "feat: add initial schema migration — tables"
```

---

## Task 2: Add Functions to the migration file

**Files:**
- Modify: `supabase/migrations/20260327000000_initial_schema.sql`

- [ ] **Step 1: Append the functions block**

Append to the migration file (after the tables block, before `COMMIT`):

```sql
-- ============================================================
-- FUNCTIONS
-- Order matters: generate_org_slug must be defined before
-- handle_new_user which calls it.
-- ============================================================

-- Function A: Slug generation
-- Must be first — called by handle_new_user.
CREATE OR REPLACE FUNCTION public.generate_org_slug(name text)
RETURNS text LANGUAGE plpgsql
SET search_path = public, pg_catalog AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 2;
BEGIN
  base_slug := regexp_replace(lower(unaccent(name)), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
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
-- Inserts in order: profiles → organizations → organization_members
-- Do NOT reorder — check_org_member_limit counts against the org at insert time.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
DECLARE
  org_id    uuid;
  user_name text;
  org_slug  text;
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
  RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RAISE;
END;
$$;

-- Function C: Member limit enforcement (max 3 per org)
CREATE OR REPLACE FUNCTION public.check_org_member_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
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

-- Function D: Prevent ownerless organizations
-- Covers both DELETE and UPDATE OF role.
CREATE OR REPLACE FUNCTION public.prevent_ownerless_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
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
  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;

-- Function E: updated_at auto-update
-- Does NOT need SECURITY DEFINER — only modifies NEW in memory.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260327000000_initial_schema.sql
git commit -m "feat: add schema functions to migration"
```

---

## Task 3: Add Triggers to the migration file

**Files:**
- Modify: `supabase/migrations/20260327000000_initial_schema.sql`

- [ ] **Step 1: Append the triggers block**

Append to the migration file:

```sql
-- ============================================================
-- TRIGGERS
-- ============================================================

-- Signup auto-provisioning
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Member limit (BEFORE INSERT to count existing before adding new)
CREATE TRIGGER enforce_org_member_limit
  BEFORE INSERT ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.check_org_member_limit();

-- No ownerless orgs (DELETE and role UPDATE)
CREATE TRIGGER enforce_org_has_owner
  BEFORE DELETE OR UPDATE OF role ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ownerless_org();

-- updated_at maintenance
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

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260327000000_initial_schema.sql
git commit -m "feat: add triggers to schema migration"
```

---

## Task 4: Add RLS Policies to the migration file

**Files:**
- Modify: `supabase/migrations/20260327000000_initial_schema.sql`

- [ ] **Step 1: Append the RLS policies block**

Append to the migration file:

```sql
-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- profiles
CREATE POLICY "users_insert_own_profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- organizations
-- INSERT and DELETE are intentionally blocked (no policy = default deny).
-- All org creation goes through handle_new_user (SECURITY DEFINER).
-- Org deletion requires service_role key only.

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
CREATE POLICY "members_read_same_org" ON public.organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Note: handle_new_user (SECURITY DEFINER) bypasses this policy at signup.
CREATE POLICY "owner_insert_member" ON public.organization_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organization_members.organization_id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );

-- UPDATE restricted to role column only — prevents user_id reassignment.
CREATE POLICY "owner_update_member_role" ON public.organization_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = auth.uid()
        AND om2.role = 'owner'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = auth.uid()
        AND om2.role = 'owner'
    )
  );

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

-- routes (full isolation per org — collaborators and owners have equal access)
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

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260327000000_initial_schema.sql
git commit -m "feat: add RLS policies to schema migration"
```

---

## Task 5: Add Indexes and close the transaction

**Files:**
- Modify: `supabase/migrations/20260327000000_initial_schema.sql`

- [ ] **Step 1: Append the indexes block and COMMIT**

Append to the migration file:

```sql
-- ============================================================
-- INDEXES
-- ============================================================

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

-- Note: organizations.slug UNIQUE constraint creates an implicit index (no explicit needed).
-- Note: organization_members UNIQUE (organization_id, user_id) creates an implicit composite index.

COMMIT;
```

- [ ] **Step 2: Commit the final migration file**

```bash
git add supabase/migrations/20260327000000_initial_schema.sql
git commit -m "feat: add indexes and finalize schema migration"
```

---

## Task 6: Apply the migration to Supabase

**Files:** None (Supabase Dashboard operation)

- [ ] **Step 1: Open the Supabase Dashboard SQL Editor**

Go to your Supabase project → SQL Editor → New Query.

- [ ] **Step 2: Paste and run the entire migration file**

Open `supabase/migrations/20260327000000_initial_schema.sql`, copy all content, paste into the SQL Editor, and click **Run**.

Expected result: `Success. No rows returned.`

If you see: `function unaccent does not exist` — change all `SET search_path = public, pg_catalog` to `SET search_path = public, extensions, pg_catalog` in the migration file, then re-run.

- [ ] **Step 3: Verify tables were created**

Run in SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'organizations', 'organization_members', 'routes')
ORDER BY table_name;
```

Expected: 4 rows returned (`organization_members`, `organizations`, `profiles`, `routes`).

- [ ] **Step 4: Verify RLS is enabled on all tables**

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'organizations', 'organization_members', 'routes');
```

Expected: all 4 rows have `rowsecurity = true`.

- [ ] **Step 5: Verify all functions exist**

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'generate_org_slug',
    'handle_new_user',
    'check_org_member_limit',
    'prevent_ownerless_org',
    'set_updated_at'
  )
ORDER BY routine_name;
```

Expected: 5 rows returned.

- [ ] **Step 6: Verify all triggers exist**

```sql
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  OR (trigger_schema = 'pg_catalog' AND event_object_schema = 'auth')
ORDER BY trigger_name;
```

Expected: `enforce_org_has_owner`, `enforce_org_member_limit`, `on_auth_user_created`, `set_organizations_updated_at`, `set_profiles_updated_at`, `set_routes_updated_at`.

Note: `on_auth_user_created` fires on `auth.users` — it may not appear in `information_schema.triggers` depending on Supabase version. Verify it via:

```sql
SELECT tgname FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE pg_namespace.nspname = 'auth' AND pg_class.relname = 'users';
```

Expected: `on_auth_user_created` in results.

- [ ] **Step 7: Verify all RLS policies exist**

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Expected policies:
- `organization_members`: `member_leave_or_owner_remove`, `members_read_same_org`, `owner_insert_member`, `owner_update_member_role`
- `organizations`: `members_read_org`, `owner_update_org`
- `profiles`: `users_insert_own_profile`, `users_read_own_profile`, `users_update_own_profile`
- `routes`: `org_routes_delete`, `org_routes_insert`, `org_routes_select`, `org_routes_update`

---

## Task 7: Verify trigger behavior

**Files:** None (Supabase Dashboard operations)

- [ ] **Step 1: Test signup auto-provisioning**

In Supabase Dashboard → Authentication → Users, create a new user manually (or use the Auth API with a test email).

Then run:

```sql
-- Replace with the email you used
SELECT
  p.id,
  p.full_name,
  o.name AS org_name,
  o.slug AS org_slug,
  om.role
FROM public.profiles p
JOIN public.organization_members om ON om.user_id = p.id
JOIN public.organizations o ON o.id = om.organization_id
WHERE p.id = (SELECT id FROM auth.users WHERE email = 'your-test@email.com');
```

Expected: 1 row with `role = 'owner'`, `org_name` like `'Organização de ...'`, non-empty slug.

- [ ] **Step 2: Test member limit (max 3)**

Using the service_role key (Supabase Dashboard → Settings → API → `service_role`):

```sql
-- Get the org id from the test user
SELECT o.id
FROM public.organizations o
JOIN public.organization_members om ON om.organization_id = o.id
JOIN auth.users u ON u.id = om.user_id
WHERE u.email = 'your-test@email.com';

-- Try inserting 3 more fake members (should succeed for 2, fail on 3rd)
-- Replace <org_id> with the result above
INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('<org_id>', gen_random_uuid(), 'collaborator');
-- ^ Run this twice. Second run should succeed (total = 3).

INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('<org_id>', gen_random_uuid(), 'collaborator');
-- ^ Run this a third time. Should FAIL with "Organization member limit reached (max 3)".
```

- [ ] **Step 3: Test ownerless org guard**

```sql
-- Get the owner membership row id
SELECT id FROM public.organization_members
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-test@email.com')
  AND role = 'owner';

-- Try to delete the owner (should FAIL)
DELETE FROM public.organization_members WHERE id = '<membership_id>';
-- Expected: ERROR "Cannot remove the last owner of an organization"

-- Try to demote the owner via UPDATE (should FAIL)
UPDATE public.organization_members SET role = 'collaborator' WHERE id = '<membership_id>';
-- Expected: ERROR "Cannot remove the last owner of an organization"
```

- [ ] **Step 4: Verify RLS isolation**

In Supabase Dashboard → SQL Editor, run using the **anon key** (set via `SET request.jwt.claims`):

```sql
-- Simulate anon user (no auth) — should return 0 rows
SET request.jwt.claims = '{}';
SELECT * FROM public.routes;
-- Expected: 0 rows (RLS blocks unauthenticated access)
```

- [ ] **Step 5: Clean up test data**

Delete the test user from Supabase Dashboard → Authentication → Users (cascade delete removes profile, org, members automatically).

---

## Task 8: Final commit

- [ ] **Step 1: Confirm git status is clean**

```bash
git status
```

Expected: `nothing to commit, working tree clean`

- [ ] **Step 2: Tag the migration as applied**

```bash
git tag schema-v1
```
