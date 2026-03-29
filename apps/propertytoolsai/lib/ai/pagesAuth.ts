import type { NextApiRequest } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Pages Router: resolve Supabase user from Bearer token.
 * (App Router routes use cookie session via getUserFromRequest.)
 */
export async function getUserIdFromPagesRequest(req: NextApiRequest): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const jwt = auth.slice(7).trim();
  if (!jwt) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}
