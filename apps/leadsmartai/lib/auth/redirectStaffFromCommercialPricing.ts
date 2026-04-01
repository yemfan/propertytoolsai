import { redirect } from "next/navigation";
import { getCurrentUserWithRole } from "@/lib/auth/getCurrentUser";
import { ADMIN_SUPPORT_HOME_PATH, isAdminOrSupportRole } from "@/lib/rolePortalPaths";

/**
 * Signed-in admin/support users are redirected away from customer pricing and upgrade surfaces.
 * Anonymous visitors still see marketing pricing pages.
 */
export async function redirectAdminSupportAwayFromCommercialPricing() {
  const user = await getCurrentUserWithRole();
  if (user?.role && isAdminOrSupportRole(user.role)) {
    redirect(ADMIN_SUPPORT_HOME_PATH);
  }
}
