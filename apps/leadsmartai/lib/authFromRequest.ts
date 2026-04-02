import { supabaseServerClient } from "@/lib/supabaseServerClient";

export async function getUserFromRequest(req: Request) {
  const supabase = supabaseServerClient();

  // Prefer Bearer when present (multipart / mobile clients can pair it reliably with FormData).
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    const { data: tokenUserData, error: tokenUserErr } = await supabase.auth.getUser(token);
    if (!tokenUserErr && tokenUserData?.user) return tokenUserData.user;
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (!userErr && userData?.user) return userData.user;

  return null;
}

