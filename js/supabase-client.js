/**
 * Vertex Metals Ltd — Supabase Client
 *
 * Initialises the shared Supabase client used by all pages.
 * Replace the placeholder values below with your project credentials.
 * Find these in: Supabase Dashboard → Project Settings → API
 *
 * IMPORTANT: These are client-side values (anon key only).
 * The anon key is safe to expose — it has no privileges beyond
 * what RLS policies explicitly permit.
 * Never put the service_role key in any client-side file.
 */

const SUPABASE_URL  = 'https://rzgbhicxjazekwkmmxds.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Z2JoaWN4amF6ZWt3a21teGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDc2OTcsImV4cCI6MjA5MTY4MzY5N30.hnQBmmzKRWNqzsW2VVuW3BAWyII_hTgo2UpuFY0IOGg';

// Initialise — window.supabase is provided by the CDN script loaded before this file
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
