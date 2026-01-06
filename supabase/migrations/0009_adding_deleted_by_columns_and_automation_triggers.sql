-- 1. Add deleted_by column to relevant tables
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.sets ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.set_songs ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.gig_sessions ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- 2. Create trigger function to handle deleted_by logic
CREATE OR REPLACE FUNCTION public.handle_soft_delete_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Case: Soft Delete (Active -> Deleted)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        -- Only set if not already set manually
        IF NEW.deleted_by IS NULL THEN
            NEW.deleted_by := auth.uid();
        END IF;
    
    -- Case: Undelete (Deleted -> Active)
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        NEW.deleted_by := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Apply triggers to tables (Drop first to avoid errors if re-running)
DROP TRIGGER IF EXISTS tr_songs_soft_delete_meta ON public.songs;
CREATE TRIGGER tr_songs_soft_delete_meta BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete_metadata();

DROP TRIGGER IF EXISTS tr_setlists_soft_delete_meta ON public.setlists;
CREATE TRIGGER tr_setlists_soft_delete_meta BEFORE UPDATE ON public.setlists FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete_metadata();

DROP TRIGGER IF EXISTS tr_sets_soft_delete_meta ON public.sets;
CREATE TRIGGER tr_sets_soft_delete_meta BEFORE UPDATE ON public.sets FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete_metadata();

DROP TRIGGER IF EXISTS tr_set_songs_soft_delete_meta ON public.set_songs;
CREATE TRIGGER tr_set_songs_soft_delete_meta BEFORE UPDATE ON public.set_songs FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete_metadata();

DROP TRIGGER IF EXISTS tr_gigs_soft_delete_meta ON public.gigs;
CREATE TRIGGER tr_gigs_soft_delete_meta BEFORE UPDATE ON public.gigs FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete_metadata();

DROP TRIGGER IF EXISTS tr_gig_sessions_soft_delete_meta ON public.gig_sessions;
CREATE TRIGGER tr_gig_sessions_soft_delete_meta BEFORE UPDATE ON public.gig_sessions FOR EACH ROW EXECUTE FUNCTION public.handle_soft_delete_metadata();