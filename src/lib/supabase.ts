import { createClient } from "@supabase/supabase-js";

// Production Supabase credentials for Kotha Barta
const DEFAULT_SUPABASE_URL = "https://ngtyysbsfvowtbrqamti.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndHl5c2JzZnZvd3RicnFhbXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4ODAxMTEsImV4cCI6MjA5NTQ1NjExMX0.NNRgmbOH0YdzemvnfaLV14duA05pqaAu99Wz1JMVFdM";

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseUrl =
  envUrl && envUrl.trim() !== "" && envUrl.startsWith("http")
    ? envUrl.trim()
    : DEFAULT_SUPABASE_URL;

export const supabaseAnonKey =
  envKey && envKey.trim() !== "" && envKey.length > 20
    ? envKey.trim()
    : DEFAULT_SUPABASE_ANON_KEY;

// Check if credentials are valid (guaranteed to be false in production)
export const isMockMode =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.trim() === "" ||
  supabaseAnonKey.trim() === "" ||
  !supabaseUrl.startsWith("http");

if (isMockMode) {
  console.warn(
    "⚠️ Kotha Barta: Running in MOCK MODE using LocalStorage. Database changes will persist in this browser."
  );
} else {
  console.log("✅ Kotha Barta: Connected to live Supabase backend at", supabaseUrl);
}

export const supabase = isMockMode
  ? (null as any) // Supabase calls will be intercepted by service layer
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
