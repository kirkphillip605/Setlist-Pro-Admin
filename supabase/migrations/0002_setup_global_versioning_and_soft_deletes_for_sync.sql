-- 1. Create Global Sequence
CREATE SEQUENCE IF NOT EXISTS public.global_version_seq;

-- 2. Create Trigger Function to assign versions
CREATE OR REPLACE FUNCTION public.handle_row_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.version := nextval('public.global_version_seq');
  RETURN NEW;
END;
$$;

-- 3. Update Tables
-- Helper macro for repetitive operations isn't supported here, so we do it explicitly for each table.

-- Songs
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS version BIGINT;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DROP TRIGGER IF EXISTS tr_songs_version ON public.songs;
CREATE TRIGGER tr_songs_version BEFORE INSERT OR UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.handle_row_version();

-- Gigs
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS version BIGINT;
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DROP TRIGGER IF EXISTS tr_gigs_version ON public.gigs;
CREATE TRIGGER tr_gigs_version BEFORE INSERT OR UPDATE ON public.gigs FOR EACH ROW EXECUTE FUNCTION public.handle_row_version();

-- Setlists
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS version BIGINT;
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DROP TRIGGER IF EXISTS tr_setlists_version ON public.setlists;
CREATE TRIGGER tr_setlists_version BEFORE INSERT OR UPDATE ON public.setlists FOR EACH ROW EXECUTE FUNCTION public.handle_row_version();

-- Sets
ALTER TABLE public.sets ADD COLUMN IF NOT EXISTS version BIGINT;
ALTER TABLE public.sets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DROP TRIGGER IF EXISTS tr_sets_version ON public.sets;
CREATE TRIGGER tr_sets_version BEFORE INSERT OR UPDATE ON public.sets FOR EACH ROW EXECUTE FUNCTION public.handle_row_version();

-- Set Songs
ALTER TABLE public.set_songs ADD COLUMN IF NOT EXISTS version BIGINT;
ALTER TABLE public.set_songs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DROP TRIGGER IF EXISTS tr_set_songs_version ON public.set_songs;
CREATE TRIGGER tr_set_songs_version BEFORE INSERT OR UPDATE ON public.set_songs FOR EACH ROW EXECUTE FUNCTION public.handle_row_version();

-- Gig Sessions
ALTER TABLE public.gig_sessions ADD COLUMN IF NOT EXISTS version BIGINT;
ALTER TABLE public.gig_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DROP TRIGGER IF EXISTS tr_gig_sessions_version ON public.gig_sessions;
CREATE TRIGGER tr_gig_sessions_version BEFORE INSERT OR UPDATE ON public.gig_sessions FOR EACH ROW EXECUTE FUNCTION public.handle_row_version();

-- Participants
ALTER TABLE public.gig_session_participants ADD COLUMN IF NOT EXISTS version BIGINT;
ALTER TABLE public.gig_session_participants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DROP TRIGGER IF EXISTS tr_gig_participants_version ON public.gig_session_participants;
CREATE TRIGGER tr_gig_participants_version BEFORE INSERT OR UPDATE ON public.gig_session_participants FOR EACH ROW EXECUTE FUNCTION public.handle_row_version();

-- Profiles (already has deleted_at)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS version BIGINT;
DROP TRIGGER IF EXISTS tr_profiles_version ON public.profiles;
CREATE TRIGGER tr_profiles_version BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_row_version();

-- Initialize versions for existing data if null
UPDATE public.songs SET version = nextval('public.global_version_seq') WHERE version IS NULL;
UPDATE public.gigs SET version = nextval('public.global_version_seq') WHERE version IS NULL;
UPDATE public.setlists SET version = nextval('public.global_version_seq') WHERE version IS NULL;
UPDATE public.sets SET version = nextval('public.global_version_seq') WHERE version IS NULL;
UPDATE public.set_songs SET version = nextval('public.global_version_seq') WHERE version IS NULL;
UPDATE public.profiles SET version = nextval('public.global_version_seq') WHERE version IS NULL;
UPDATE public.gig_sessions SET version = nextval('public.global_version_seq') WHERE version IS NULL;
UPDATE public.gig_session_participants SET version = nextval('public.global_version_seq') WHERE version IS NULL;