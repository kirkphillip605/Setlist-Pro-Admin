-- 1. DECOUPLE PROFILES FROM AUTH DELETION
-- We need to drop the existing FK that cascades delete, so the profile survives.
-- We try to guess the constraint name or drop based on definition.
DO $$ 
BEGIN
  -- Drop the constraint if it exists (standard naming)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
      ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;
END $$;

-- Re-add FK without CASCADE DELETE (allows profile to exist as orphan/soft-deleted)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) 
ON DELETE NO ACTION; -- We will handle cleanup via trigger


-- 2. ENABLE 'ON UPDATE CASCADE' FOR CHILD TABLES
-- This allows us to change a profile's ID (to match a new Auth ID) and have all their data follow them.

-- Helper macro-like block for updating constraints
DO $$
DECLARE
  t text;
  c text;
BEGIN
  -- List of tables and their FK columns pointing to profiles(id)
  -- format: table_name:column_name
  FOREACH t IN ARRAY ARRAY[
    'songs:created_by', 
    'setlists:created_by', 
    'sets:created_by', 
    'set_songs:created_by', 
    'gigs:created_by',
    'audit_logs:changed_by',
    'banned_users:user_id'
  ] LOOP
    DECLARE
      tbl text := split_part(t, ':', 1);
      col text := split_part(t, ':', 2);
      cnst text;
    BEGIN
      -- Find existing constraint name
      SELECT conname INTO cnst
      FROM pg_constraint 
      JOIN pg_attribute ON pg_attribute.attnum = ANY(pg_constraint.conkey)
      WHERE pg_constraint.conrelid = (tbl)::regclass
      AND pg_attribute.attname = col
      AND pg_constraint.confrelid = 'public.profiles'::regclass;

      IF cnst IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, cnst);
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON UPDATE CASCADE', tbl, cnst, col);
      END IF;
    END;
  END LOOP;
END $$;


-- 3. TRIGGER: HANDLE AUTH USER DELETION (Soft Delete Profile)
CREATE OR REPLACE FUNCTION public.on_auth_user_deleted()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    deleted_at = now(),
    is_active = false
  WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_on_auth_user_deleted ON auth.users;
CREATE TRIGGER trigger_on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.on_auth_user_deleted();


-- 4. TRIGGER: HANDLE NEW USER (Restore/Link Profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  existing_profile_id uuid;
  is_banned boolean;
BEGIN
  -- Check for ban
  SELECT exists(select 1 from public.banned_users where email = new.email and unbanned_at is null) 
  into is_banned;

  IF is_banned THEN
    RAISE EXCEPTION 'This email address is banned.';
  END IF;

  -- Check for existing profile by email (Soft Deleted or Orphaned)
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = new.email
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    -- RESTORE: Update the old profile's ID to the new Auth ID
    -- Because we set ON UPDATE CASCADE, this moves all their data (songs, gigs, etc) to the new ID.
    UPDATE public.profiles
    SET 
      id = new.id, -- MIGRATE ID
      deleted_at = NULL,
      is_active = true,
      updated_at = now(),
      first_name = COALESCE(new.raw_user_meta_data ->> 'first_name', first_name),
      last_name = COALESCE(new.raw_user_meta_data ->> 'last_name', last_name)
    WHERE id = existing_profile_id;
  ELSE
    -- CREATE NEW
    INSERT INTO public.profiles (
      id,
      email,
      first_name,
      last_name,
      role,
      has_password,
      is_approved,
      is_active
    )
    VALUES (
      new.id,
      new.email,
      new.raw_user_meta_data ->> 'first_name',
      new.raw_user_meta_data ->> 'last_name',
      COALESCE(NULLIF(new.raw_user_meta_data ->> 'role', '')::public.user_role, 'standard'::public.user_role),
      CASE WHEN new.raw_app_meta_data ->> 'provider' = 'google' THEN false ELSE true END,
      false,
      true
    );
  END IF;

  RETURN new;
END;
$$;