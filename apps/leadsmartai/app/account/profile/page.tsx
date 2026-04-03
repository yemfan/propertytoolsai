import Link from "next/link";
import ProfileSettingsForm from "@/components/account/ProfileSettingsForm";

export const metadata = {
  title: "My profile | LeadSmart AI",
  description: "Update your name, phone, and profile photo.",
};

export default function AccountProfilePage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm font-medium text-blue-700 hover:underline">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">My profile</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage how you appear across LeadSmart AI and update your contact details.
        </p>
      </div>
      <ProfileSettingsForm />
    </div>
  );
}
