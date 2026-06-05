"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

type Status = "idle" | "connecting" | "connected" | "error";

export function GoogleBusinessConnect() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  // Check for success/error from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("gmb")) {
      setStatus("connected");
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.has("gmb_error")) {
      setError(params.get("gmb_error") || "Connection failed");
      setStatus("error");
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleConnect = () => {
    setStatus("connecting");
    window.location.href = "/api/auth/google-business";
  };

  if (status === "connected") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-emerald-900">Connected!</p>
            <p className="text-sm text-emerald-700 mt-1">
              Your Google Business Profile is now connected. Reviews will sync automatically every 15 minutes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Connect Google Business Profile</h2>
        <p className="text-sm text-slate-600">
          Link your Google Business Profile to sync reviews, track ratings, and respond to customers directly from HelmSmart.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-blue-900 mb-2">What you'll get:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✓ Auto-sync reviews and ratings</li>
          <li>✓ Respond to reviews directly</li>
          <li>✓ Track customer sentiment</li>
          <li>✓ Get notified of new reviews</li>
        </ul>
      </div>

      {status === "error" && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-rose-900">Connection failed</p>
            <p className="text-sm text-rose-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={status === "connecting"}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors"
      >
        {status === "connecting" && <Loader2 className="w-4 h-4 animate-spin" />}
        {status === "connecting" ? "Connecting..." : "Connect with Google"}
      </button>

      <p className="text-xs text-slate-500 mt-4 text-center">
        You'll be redirected to Google to authorize access to your business profile.
        <br />
        We only access your reviews and won't post without your permission.
      </p>
    </div>
  );
}
