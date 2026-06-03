import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {},
  // HelmSmart Core packages are TS source — Next must transpile them.
  transpilePackages: [
    "@helm/data",
    "@helm/ai-workforce",
    "@helm/dna-finance",
    "@helm/dna-communication",
    "@helm/dna-operations",
    "@helm/dna-revenue",
    "@helm/dna-intelligence",
    "@helm/dna-people",
    "@helm/dna-marketing",
    "@helm/dna-service",
    "@helm/dna-knowledge",
    "@helm/ui",
  ],
  // Hardcode public Supabase values so they are always embedded at build time.
  // The anon key is intentionally public (protected by RLS, safe to commit).
  env: {
    NEXT_PUBLIC_HELM_SUPABASE_URL: "https://vpmwsnoosuiknyzdxgtk.supabase.co",
    NEXT_PUBLIC_HELM_SUPABASE_ANON_KEY:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbXdzbm9vc3Vpa255emR4Z3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDU5MTgsImV4cCI6MjA5NTQyMTkxOH0.eAn1vPTAHXj_4OMd9T50LcazrxnvMxkcfFs-de98SNg",
    // Legacy aliases — kept so anything still keyed NEXT_PUBLIC_SMBAI_* keeps resolving during the rename.
    NEXT_PUBLIC_SMBAI_SUPABASE_URL: "https://vpmwsnoosuiknyzdxgtk.supabase.co",
    NEXT_PUBLIC_SMBAI_SUPABASE_ANON_KEY:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbXdzbm9vc3Vpa255emR4Z3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDU5MTgsImV4cCI6MjA5NTQyMTkxOH0.eAn1vPTAHXj_4OMd9T50LcazrxnvMxkcfFs-de98SNg",
  },
};

export default config;
