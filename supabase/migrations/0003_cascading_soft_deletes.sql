sets -> set_songs">
-- 1. Add columns to track if a row was deleted by a parent cascade
ALTER TABLE public.sets 
ADD COLUMN IF NOT EXISTS deleted_by_setlist boolean DEFAULT false;

ALTER TABLE public.set_songs 
ADD COLUMN IF NOT EXISTS deleted_by_set boolean DEFAULT false;


-- 2. Function for Setlist Cascade (Setlist -> Sets)
CREATE OR REPLACE FUNCTION public.handle_setlist_soft_delete_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- CASE 1: Soft Delete (Active -> Deleted)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE public.sets
    SET 
      deleted_at = NEW.deleted_at,
      deleted_by_setlist = true,
      last_updated_by = NEW.last_updated_by
    WHERE setlist_id = NEW.id 
      AND deleted_at IS NULL; -- Only delete currently active sets

  -- CASE 2: Undelete (Deleted -> Active)
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE public.sets
    SET 
      deleted_at = NULL,
      deleted_by_setlist = false,
      last_updated_by = NEW.last_updated_by
    WHERE setlist_id = NEW.id 
      AND deleted_by_setlist = true; -- Only restore sets that were deleted by the parent
  END IF;

  RETURN NULL;
END;
$$;


-- 3. Trigger for Setlist Cascade
-- We use AFTER UPDATE so the Setlist state is finalized before cascading.
DROP TRIGGER IF EXISTS tr_setlist_cascade ON public.setlists;
CREATE TRIGGER tr_setlist_cascade
  AFTER UPDATE OF deleted_at ON public.setlists
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_setlist_soft_delete_cascade();


-- 4. Function for Set Cascade (Sets -> Set Songs)
CREATE OR REPLACE FUNCTION public.handle_set_soft_delete_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- CASE 1: Soft Delete (Active -> Deleted)
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE public.set_songs
    SET 
      deleted_at = NEW.deleted_at,
      deleted_by_set = true
      -- set_songs does not have last_updated_by, so we skip it
    WHERE set_id = NEW.id 
      AND deleted_at IS NULL; -- Only delete currently active songs

  -- CASE 2: Undelete (Deleted -> Active)
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE public.set_songs
    SET 
      deleted_at = NULL,
      deleted_by_set = false
    WHERE set_id = NEW.id 
      AND deleted_by_set = true; -- Only restore songs that were deleted by the parent
  END IF;

  RETURN NULL;
END;
$$;


-- 5. Trigger for Set Cascade
DROP TRIGGER IF EXISTS tr_set_cascade ON public.sets;
CREATE TRIGGER tr_set_cascade
  AFTER UPDATE OF deleted_at ON public.sets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_set_soft_delete_cascade();