-- Function to safely append a song to the end of a set
CREATE OR REPLACE FUNCTION public.append_song_to_set(
  p_set_id UUID,
  p_song_id UUID,
  p_created_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_pos INTEGER;
BEGIN
  -- Get the next available position (max + 1, or 0 if empty)
  SELECT COALESCE(MAX(position), -1) + 1 INTO v_next_pos
  FROM public.set_songs
  WHERE set_id = p_set_id;

  INSERT INTO public.set_songs (set_id, song_id, position, created_by)
  VALUES (p_set_id, p_song_id, v_next_pos, p_created_by);
END;
$$;

-- Function to safely reorder songs within a set
-- Uses a negative temporary index strategy to avoid unique constraint violations during updates
CREATE OR REPLACE FUNCTION public.reorder_set_songs(
  p_set_id UUID,
  p_song_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_song_id UUID;
  v_i INTEGER;
BEGIN
  -- 1. Temporarily move to negative positions
  FOR v_i IN 1..array_length(p_song_ids, 1) LOOP
    v_song_id := p_song_ids[v_i];
    UPDATE public.set_songs
    SET position = -v_i
    WHERE id = v_song_id AND set_id = p_set_id;
  END LOOP;

  -- 2. Move to correct positive positions (0-based index)
  FOR v_i IN 1..array_length(p_song_ids, 1) LOOP
    v_song_id := p_song_ids[v_i];
    UPDATE public.set_songs
    SET position = v_i - 1
    WHERE id = v_song_id AND set_id = p_set_id;
  END LOOP;
END;
$$;

-- Function to safely reorder sets within a setlist
CREATE OR REPLACE FUNCTION public.reorder_sets(
  p_setlist_id UUID,
  p_set_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_set_id UUID;
  v_i INTEGER;
BEGIN
  -- 1. Temporarily move to negative positions
  FOR v_i IN 1..array_length(p_set_ids, 1) LOOP
    v_set_id := p_set_ids[v_i];
    UPDATE public.sets
    SET position = -v_i
    WHERE id = v_set_id AND setlist_id = p_setlist_id;
  END LOOP;

  -- 2. Move to correct positive positions
  FOR v_i IN 1..array_length(p_set_ids, 1) LOOP
    v_set_id := p_set_ids[v_i];
    UPDATE public.sets
    SET position = v_i - 1
    WHERE id = v_set_id AND setlist_id = p_setlist_id;
  END LOOP;
END;
$$;