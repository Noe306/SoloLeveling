// ============================================================================
// Edge Function: login-with-username
//
// Supabase logs in with EMAIL + password. Players log in with USERNAME +
// password, so this small server function:
//   1. finds the account for the username (server side only),
//   2. reads that account's email privately,
//   3. signs in with email + password,
//   4. returns the session tokens to the app.
// The email never leaves the server, so nobody can learn another player's email.
//
// Deploy in the dashboard: Edge Functions -> Deploy a new function -> Via Editor,
// name it "login-with-username", paste this file, Deploy.
// NOTE: the dashboard may give it a different ADDRESS (slug). The live one is
// "super-handler"; the app reads it from LOGIN_FUNCTION_SLUG in js/supabase-config.js.
// Then in the function's settings turn OFF "Verify JWT" (players are not logged
// in yet when they call it).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by
// Supabase inside Edge Functions: no key is written in this file.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
// Same message for "no such username" and "wrong password", on purpose.
const BAD_LOGIN = () => reply({ error: "Wrong username or password." }, 401);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);

  let username = "", password = "";
  try {
    const body = await req.json();
    username = typeof body.username === "string" ? body.username.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  if (!USERNAME_RE.test(username) || password.length < 1 || password.length > 200) return BAD_LOGIN();

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. username -> account id
  const { data: userId, error: idError } = await admin.rpc("user_id_for_username", { name: username });
  if (idError) return reply({ error: "Login service error." }, 500);
  if (!userId) return BAD_LOGIN();

  // 2. account id -> email (stays on the server)
  const { data: found, error: userError } = await admin.auth.admin.getUserById(userId as string);
  if (userError || !found?.user?.email) return BAD_LOGIN();

  // 3. email + password -> session (a separate client so nothing is shared)
  const signer = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signed, error: signError } = await signer.auth.signInWithPassword({ email: found.user.email, password });
  if (signError || !signed.session) return BAD_LOGIN();

  // 4. only the tokens go back to the app
  return reply({ access_token: signed.session.access_token, refresh_token: signed.session.refresh_token });
});
