import { createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_* variables must be read literally (process.env.NEXT_PUBLIC_X):
// that is what lets Next.js inline them into the code sent to the browser.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY variables (see .env.local).",
  );
}

// supabase-js expects the project root (https://<project>.supabase.co) and appends /rest/v1 itself.
// If the URL copied from the dashboard already contains that path, requests fail (PGRST125):
// so only the origin is kept.
export const supabase = createClient(new URL(supabaseUrl).origin, supabaseAnonKey);
