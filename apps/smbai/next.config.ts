import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {},
  // Guarantee these public values are embedded at build time regardless of
  // how the monorepo build pipeline (Turbo) handles env var forwarding.
  // The Supabase anon key is intentionally public — it's safe to commit.
  env: {
    NEXT_PUBLIC_SMBAI_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SMBAI_SUPABASE_URL ??
      "https://vpmwsnoosuiknyzdxgtk.supabase.co",
    NEXT_PUBLIC_SMBAI_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SMBAI_SUPABASE_ANON_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwbXdzbm9vc3Vpa255emR4Z3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDU5MTgsImV4cCI6MjA5NTQyMTkxOH0.eAn1vPTAHXj_4OMd9T50LcazrxnvMxkcfFs-de98SNg",
  },
};

export default config;
