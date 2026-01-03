import { createClient } from "@supabase/supabase-js";

// These values will be filled by the dyad-add-integration command automatically
// or you can set them manually in your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder";

export const supabase = createClient(supabaseUrl, supabaseKey);