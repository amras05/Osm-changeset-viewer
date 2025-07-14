import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nxsyxmhqbdyoffxqulyt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54c3l4bWhxYmR5b2ZmeHF1bHl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0OTU1MTAsImV4cCI6MjA2ODA3MTUxMH0.5gwGYXAsIDWeStNotyuTLNwbhnXU2pMKJkfRtF8vak0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
