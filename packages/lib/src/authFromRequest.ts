import { supabaseServerClient } from "./supabaseServerClient";

export async function getUserFromRequest(req: Request) {
  const supabase = supabaseServerClient();

  // Try cookie-based session first
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (!userErr && userData?.user) return userData.user;

  // Fallback: accept explicit bearer token
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data: tokenUserData, error: tokenUserErr } =
    await supabase.auth.getUser(token);
  if (tokenUserErr) return null;
  return tokenUserData?.user ?? null;
}

