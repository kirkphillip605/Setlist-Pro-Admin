import { createClient } from "@supabase/supabase-js";

// Support standard Vite naming or the specific names requested (prefixed with VITE_)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || 
  "placeholder";

export const supabase = createClient(supabaseUrl, supabaseKey);