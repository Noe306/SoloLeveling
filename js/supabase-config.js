/* ==========================================================================
   supabase-config.js: connection details for the game's Supabase project.

   These two values are PUBLIC BY DESIGN (Supabase "publishable" key): they
   only let the app talk to the project; what each player may read/write is
   enforced by Row Level Security rules in the database.
   NEVER put the secret key (sb_secret_...) or service_role key here.

   Loaded by index.html; used by js/auth.js (accounts + cloud saves).
   ========================================================================== */

var SUPABASE_URL = 'https://egkfvyjqlatzpgjxwkuw.supabase.co';
var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LD2Oxo-ROpCWn0XP3K_EzQ_w44sZooL';
// Address ("slug") of the username-login Edge Function. Its display name in the
// dashboard is "login-with-username", but Supabase gave it this address.
var LOGIN_FUNCTION_SLUG = 'super-handler';
