"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PillarLogoIcon } from "@/components/EmblemIcon";
import { setClientSession } from "@/lib/authSession";
import { ArrowRight, Loader2, AlertCircle, CheckCircle2, Mail, RefreshCw } from "lucide-react";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      // Save user session and redirect inside
      if (data.user) {
        setClientSession(data.user);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/app");
      }, 700);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Invalid code. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Please enter your email address to resend code.");
      return;
    }
    setError(null);
    setResending(true);
    setResendSuccess(false);

    try {
      const res = await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend email");
      }

      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to resend verification email.";
      setError(msg);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8 my-auto">
      {success ? (
        <div className="text-center py-6 space-y-3">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-stone-900">Email Verified!</h2>
          <p className="text-xs text-stone-500">Your account is activated. Redirecting to login...</p>
          <div className="pt-2 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#5D2A18]" />
          </div>
        </div>
      ) : (
        <div>
          <div className="text-center mb-6">
            <div className="w-10 h-10 bg-[#FAF6F0] text-[#5D2A18] rounded-xl flex items-center justify-center mx-auto mb-3">
              <Mail className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
              Verify your email
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Enter the 6-digit code sent to your inbox via Resend
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resendSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
              <span>A new verification code was sent to your email.</span>
            </div>
          )}

          <form onSubmit={handleVerify} autoComplete="off" className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=""
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5D2A18]/20 focus:border-[#5D2A18] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full px-3.5 py-3 rounded-lg border border-stone-300 bg-white text-center font-mono text-xl tracking-[0.4em] font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5D2A18]/20 focus:border-[#5D2A18] transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-[#5D2A18] hover:bg-[#431D10] text-white rounded-lg font-semibold text-sm transition-all duration-150 shadow-sm disabled:opacity-70 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Verify Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="flex items-center justify-between text-xs text-stone-500 mt-6 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-semibold text-[#5D2A18] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${resending ? "animate-spin" : ""}`} />
              <span>Resend code</span>
            </button>

            <Link href="/login" className="font-semibold text-stone-600 hover:text-stone-900">
              Back to Login
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-between items-center px-4 py-8 text-[#1E1A17] selection:bg-[#5D2A18] selection:text-white">
      {/* Brand Header */}
      <Link href="/" className="flex items-center gap-2.5 group my-auto">
        <PillarLogoIcon className="w-8 h-8 text-[#1E1A17] transition-transform group-hover:scale-105" />
        <span className="font-extrabold text-2xl tracking-tight text-[#1E1A17]">
          Pramaan
        </span>
      </Link>

      <Suspense fallback={<div className="p-8 text-center text-sm text-stone-500">Loading...</div>}>
        <VerifyContent />
      </Suspense>

      {/* Minimal Footer */}
      <footer className="my-auto text-center text-xs text-stone-400">
        © Pramaan. Built for a more informed India.
      </footer>
    </div>
  );
}
