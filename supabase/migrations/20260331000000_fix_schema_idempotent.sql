-- ============================================================
-- PrecificaTur — Fix Schema COMPLETO (idempotente)
-- Cole e execute TODO o arquivo de uma vez no SQL Editor do Supabase
-- ============================================================

BEGIN;

-- ============================================================
-- EXTENSÃO
-- ============================================================
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- TABELAS (cria se não existir)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text UNIQUE NOT NULL CHECK (slug <> ''),
  plan       text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('owner', 'collaborator')),
  invited_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.routes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name             text NOT NULL,
  destination      text,
  route_type       text NOT NULL DEFAULT 'outro',
  currency         text NOT NULL DEFAULT 'BRL'
                        CHECK (currency IN ('BRL', 'USD', 'EUR', 'VES')),
  exchange_rate    numeric(10,4) NOT NULL DEFAULT 1.0,
  duration_days    int NOT NULL DEFAULT 1 CHECK (duration_days >= 1),
  fixed_costs      jsonb NOT NULL DEFAULT '[]',
  variable_costs   jsonb NOT NULL DEFAULT '[]',
  days             jsonb NOT NULL DEFAULT '[]',
  metadata         jsonb NOT NULL DEFAULT '{}',
  last_pax_min     int,
  last_pax_max     int,
  last_pax_step    int,
  last_margin      numeric(5,2),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

-- Corrige constraint route_type para valores do frontend
ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS routes_route_type_check;
ALTER TABLE public.routes
  ADD CONSTRAINT routes_route_type_check
  CHECK (route_type IN (
    'city_tour', 'trilha', 'expedicao', 'passeio_barco',
    'cultural', 'aventura', 'gastronomico', 'outro'
  ));

-- access_codes
CREATE TABLE IF NOT EXISTS public.access_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  expires_at  timestamptz,
  user_id     uuid REFERENCES auth.users(id),
  name        text,
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNÇÕES
-- ============================================================

DROP FUNCTION IF EXISTS public.generate_org_slug(text);
CREATE OR REPLACE FUNCTION public.generate_org_slug(p_name text)
RETURNS text LANGUAGE plpgsql
SET search_path = public, pg_catalog AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 2;
BEGIN
  base_slug := regexp_replace(lower(unaccent(p_name)), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'org'; END IF;
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  RETURN final_slug;
END;
$$;

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
  VALUES (NEW.id, user_name)
  ON CONFLICT (id) DO NOTHING;

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

CREATE OR REPLACE FUNCTION public.check_org_member_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.organization_members WHERE organization_id = NEW.organization_id) >= 3 THEN
    RAISE EXCEPTION 'Organization member limit reached (max 3)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_ownerless_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
BEGIN
  IF OLD.role = 'owner' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = OLD.organization_id AND role = 'owner' AND id != OLD.id
    ) THEN
      RAISE EXCEPTION 'Cannot remove the last owner of an organization';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_access_code(p_code text)
RETURNS TABLE(valid bool, status text, email text, name text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_row access_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM access_codes WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() AND v_row.status = 'active' THEN
    UPDATE access_codes SET status = 'expired' WHERE id = v_row.id;
    v_row.status := 'expired';
  END IF;
  RETURN QUERY SELECT true, v_row.status, v_row.email, v_row.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.use_access_code(
  p_code text, p_name text, p_email text, p_user_id uuid
)
RETURNS bool LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_row access_codes%ROWTYPE;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RETURN false; END IF;
  SELECT * INTO v_row FROM access_codes WHERE code = p_code;
  IF NOT FOUND OR v_row.status <> 'active' THEN RETURN false; END IF;
  UPDATE access_codes SET user_id = p_user_id, name = p_name, email = p_email, status = 'used' WHERE id = v_row.id;
  RETURN true;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS enforce_org_member_limit ON public.organization_members;
CREATE TRIGGER enforce_org_member_limit
  BEFORE INSERT ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.check_org_member_limit();

DROP TRIGGER IF EXISTS enforce_org_has_owner ON public.organization_members;
CREATE TRIGGER enforce_org_has_owner
  BEFORE DELETE OR UPDATE OF role ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ownerless_org();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_organizations_updated_at ON public.organizations;
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_routes_updated_at ON public.routes;
CREATE TRIGGER set_routes_updated_at
  BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS POLICIES — drop + recreate (evita "already exists")
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "users_read_own_profile"   ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;

CREATE POLICY "users_insert_own_profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- organizations
DROP POLICY IF EXISTS "members_read_org"  ON public.organizations;
DROP POLICY IF EXISTS "owner_update_org"  ON public.organizations;

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
      WHERE organization_id = organizations.id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- organization_members
DROP POLICY IF EXISTS "members_read_same_org"        ON public.organization_members;
DROP POLICY IF EXISTS "owner_insert_member"          ON public.organization_members;
DROP POLICY IF EXISTS "owner_update_member_role"     ON public.organization_members;
DROP POLICY IF EXISTS "member_leave_or_owner_remove" ON public.organization_members;

-- Simples e sem recursão: cada usuário vê apenas suas próprias linhas
CREATE POLICY "members_read_same_org" ON public.organization_members
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "owner_insert_member" ON public.organization_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organization_members.organization_id
        AND user_id = auth.uid() AND role = 'owner'
    )
  );
CREATE POLICY "owner_update_member_role" ON public.organization_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = auth.uid() AND om2.role = 'owner'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om2
      WHERE om2.organization_id = organization_members.organization_id
        AND om2.user_id = auth.uid() AND om2.role = 'owner'
    )
  );
CREATE POLICY "member_leave_or_owner_remove" ON public.organization_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = organization_members.organization_id
        AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- routes
DROP POLICY IF EXISTS "org_routes_select" ON public.routes;
DROP POLICY IF EXISTS "org_routes_insert" ON public.routes;
DROP POLICY IF EXISTS "org_routes_update" ON public.routes;
DROP POLICY IF EXISTS "org_routes_delete" ON public.routes;

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

-- access_codes
DROP POLICY IF EXISTS "admin_access_codes" ON public.access_codes;
CREATE POLICY "admin_access_codes" ON public.access_codes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_org_members_user_id  ON public.organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id   ON public.organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_routes_org_id        ON public.routes (organization_id);
CREATE INDEX IF NOT EXISTS idx_routes_updated_at    ON public.routes (updated_at DESC);

-- ============================================================
-- BACKFILL — cria org + membro para usuários existentes sem organização
-- (NÃO altera usuários que já têm organização)
-- ============================================================
DO $$
DECLARE
  u RECORD;
  v_org_id uuid;
  v_user_name text;
  v_org_slug  text;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_members om WHERE om.user_id = au.id
    )
  LOOP
    v_user_name := COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1));
    v_org_slug  := public.generate_org_slug('Organização de ' || v_user_name);

    INSERT INTO public.profiles (id, full_name)
    VALUES (u.id, v_user_name)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.organizations (name, slug)
    VALUES ('Organização de ' || v_user_name, v_org_slug)
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, u.id, 'owner');

    RAISE NOTICE 'Backfilled org % for user %', v_org_id, u.id;
  END LOOP;
END;
$$;

-- ============================================================
-- GRANTS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.validate_access_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.use_access_code(text, text, text, uuid) TO authenticated;

COMMIT;
