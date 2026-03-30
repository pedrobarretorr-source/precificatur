-- 1. Add is_admin column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. Create access_codes table
CREATE TABLE IF NOT EXISTS access_codes (
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

-- 3. Enable RLS
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

-- 4. Admin-only direct access (read + write)
CREATE POLICY "admin_access_codes" ON public.access_codes
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 5. validate_access_code: callable by anon, returns minimal data
CREATE OR REPLACE FUNCTION public.validate_access_code(p_code text)
RETURNS TABLE(valid bool, status text, email text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row access_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM access_codes WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- Auto-expire if past expiry date and still active
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() AND v_row.status = 'active' THEN
    UPDATE access_codes SET status = 'expired' WHERE id = v_row.id;
    v_row.status := 'expired';
  END IF;

  RETURN QUERY SELECT true, v_row.status, v_row.email, v_row.name;
END;
$$;

-- 6. use_access_code: links code to newly registered user
CREATE OR REPLACE FUNCTION public.use_access_code(
  p_code    text,
  p_name    text,
  p_email   text,
  p_user_id uuid
)
RETURNS bool
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row access_codes%ROWTYPE;
BEGIN
  -- Guard: caller must be the user being linked
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row FROM access_codes WHERE code = p_code;

  -- Guard: code must be active
  IF NOT FOUND OR v_row.status <> 'active' THEN
    RETURN false;
  END IF;

  UPDATE access_codes
  SET user_id = p_user_id,
      name    = p_name,
      email   = p_email,
      status  = 'used'
  WHERE id = v_row.id;

  RETURN true;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.validate_access_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.use_access_code(text, text, text, uuid) TO authenticated;
