import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are valid
export const isMockMode =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.trim() === "" ||
  supabaseAnonKey.trim() === "" ||
  !supabaseUrl.startsWith("http");

if (isMockMode) {
  console.warn(
    "⚠️ Kotha Barta: Running in MOCK MODE using LocalStorage. Database changes will persist in this browser. To connect a live database, configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file."
  );
}

export const supabase = isMockMode
  ? (null as any) // Supabase calls will be intercepted by service layer
  : createClient(supabaseUrl, supabaseAnonKey);
