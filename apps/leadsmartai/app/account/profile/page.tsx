import Link from "next/link";
import ProfileSettingsForm from "@/components/account/ProfileSettingsForm";
import BrandingSettingsPanel from "@/components/dashboard/BrandingSettingsPanel";

export const metadata = {
  title: "My profile | LeadSmart AI",
  description: "Update your name, phone, profile photo, and branding.",
};

export default function AccountProfilePage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm font-medium text-blue-700 hover:underline">
          &larr; Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">My profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your personal info, branding, and how you appear to clients.
        </p>
      </div>
      <ProfileSettingsForm />

      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
        <p className="text-xs text-gray-600">
          Customize your brand name, logo, and email signature for client-facing content.
        </p>
        <BrandingSettingsPanel />
      </div>
    </div>
  );
}
