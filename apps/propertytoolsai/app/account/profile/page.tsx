import Link from "next/link";
import ProfileSettingsForm from "@/components/account/ProfileSettingsForm";

export const metadata = {
  title: "My profile | PropertyTools AI",
  description: "View your account type, name, phone, and profile photo.",
};

export default function AccountProfilePage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm font-medium text-[#0066b3] hover:underline">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">My profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your role comes from <span className="font-medium">user_profiles</span> (same database as LeadSmart AI).
          Contact support to change professional access levels.
        </p>
      </div>
      <ProfileSettingsForm />
    </div>
  );
}
