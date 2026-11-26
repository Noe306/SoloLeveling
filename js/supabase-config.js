/* ==========================================================================
   supabase-config.js: connection details for the game's Supabase project.

   These two values are PUBLIC BY DESIGN (Supabase "publishable" key): they
   only let the app talk to the project; what each player may read/write is
   enforced by Row Level Security rules in the database.
   NEVER put the secret key (sb_secret_...) or service_role key here.

   Not loaded by index.html yet: the login system is the next step (see PLAN.md).
   ========================================================================== */

var SUPABASE_URL = 'https://egkfvyjqlatzpgjxwkuw.supabase.co';
var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_LD2Oxo-ROpCWn0XP3K_EzQ_w44sZooL';
