import type { UserRole } from "./roles";

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};
