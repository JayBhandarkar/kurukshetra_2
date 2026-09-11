"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PillarLogoIcon } from "@/components/EmblemIcon";
import { getClientSession } from "@/lib/authSession";
import { Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-redirect if already logged in -> redirect inside to /app
  useEffect(() => {
    const session = getClientSession();
    if (session?.email) {
      router.replace("/app");
    } else {
      setCheckingAuth(false);
    }
  }, [router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanEmail = email.trim();

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: cleanEmail,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      router.push(`/verify?email=${encodeURIComponent(cleanEmail)}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create account. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-center items-center px-4 py-8">
        <Loader2 className="w-6 h-6 animate-spin text-[#5D2A18]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-between items-center px-4 py-8 text-[#1E1A17] selection:bg-[#5D2A18] selection:text-white">
      {/* Brand Header */}
      <Link href="/" className="flex items-center gap-2.5 group my-auto">
        <PillarLogoIcon className="w-8 h-8 text-[#1E1A17] transition-transform group-hover:scale-105" />
        <span className="font-extrabold text-2xl tracking-tight text-[#1E1A17]">
          Pramaan
        </span>
      </Link>

      {/* Minimal Card */}
      <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8 my-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
            Create an account
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Enter your details to get started
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignup} autoComplete="off" className="space-y-4">
          <input
            type="text"
            name="fake_signup_user"
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
          />
          <input
            type="password"
            name="fake_signup_pass"
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
          />

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              name="pramaan_reg_name"
              required
              autoComplete="new-password"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder=""
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5D2A18]/20 focus:border-[#5D2A18] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="pramaan_reg_email"
              required
              autoComplete="new-password"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=""
              className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5D2A18]/20 focus:border-[#5D2A18] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="pramaan_reg_pwd"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=""
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5D2A18]/20 focus:border-[#5D2A18] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-[#5D2A18] hover:bg-[#431D10] text-white rounded-lg font-semibold text-sm transition-all duration-150 shadow-sm disabled:opacity-70 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending code via Resend...</span>
              </>
            ) : (
              <>
                <span>Sign Up & Verify</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-t border-stone-100 text-xs text-stone-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#5D2A18] hover:underline">
            Log in
          </Link>
        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="my-auto text-center text-xs text-stone-400">
        © Pramaan. Built for a more informed India.
      </footer>
    </div>
  );
}
