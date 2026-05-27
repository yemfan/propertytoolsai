"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

interface Props {
  portalToken: string;
}

export function PortalLinkButton({ portalToken }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/portal/${portalToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
      title="Copy client portal link"
    >
      {copied ? (
        <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied!</>
      ) : (
        <><Link2 className="w-3.5 h-3.5" /> Portal link</>
      )}
    </button>
  );
}
