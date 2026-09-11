"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PillarLogoIcon } from "@/components/EmblemIcon";
import { getClientSession, setClientSession } from "@/lib/authSession";
import { Eye, EyeOff, ArrowRight, Loader2, AlertCircle, CheckCircle2, Mail } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justVerified = searchParams.get("verified") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Auto-redirect if already logged in -> redirect inside to /app
  useEffect(() => {
    const session = getClientSession();
    if (session?.email) {
      router.replace("/app");
    } else {
      setCheckingAuth(false);
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail(null);
    setLoading(true);

    const cleanEmail = email.trim();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.unverified) {
          setUnverifiedEmail(cleanEmail);
        }
        throw new Error(data.error || "Failed to log in");
      }

      // Store persistent session
      if (data.user) {
        setClientSession(data.user);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/app");
      }, 500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Invalid email or password. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email above to receive a reset link.");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error("Could not send code");
      setForgotSent(true);
    } catch {
      setError("Failed to send reset link. Please check your email.");
    }
  };

  if (checkingAuth) {
    return (
      <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-12 my-auto flex flex-col items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#5D2A18]" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-8 my-auto">
      {success ? (
        <div className="text-center py-6 space-y-3">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-stone-900">Signed in successfully</h2>
          <p className="text-xs text-stone-500">Redirecting to your Pramaan workspace...</p>
          <div className="pt-2 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#5D2A18]" />
          </div>
        </div>
      ) : (
        <div>
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
              Welcome back
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Enter your credentials to access your workspace
            </p>
          </div>

          {justVerified && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
              <span>Email verified successfully! You can now log in below.</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                <span>{error}</span>
              </div>
              {unverifiedEmail && (
                <div className="pt-1">
                  <Link
                    href={`/verify?email=${encodeURIComponent(unverifiedEmail)}`}
                    className="inline-flex items-center gap-1 font-bold text-[#5D2A18] hover:underline"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Click here to enter verification code</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {forgotSent && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
              <span>Verification code sent to your email.</span>
            </div>
          )}

          <form onSubmit={handleLogin} autoComplete="off" className="space-y-4">
            <input
              type="text"
              name="fake_user"
              tabIndex={-1}
              aria-hidden="true"
              className="hidden"
            />
            <input
              type="password"
              name="fake_pass"
              tabIndex={-1}
              aria-hidden="true"
              className="hidden"
            />

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="pramaan_login_email"
                required
                autoComplete="new-password"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=""
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5D2A18]/20 focus:border-[#5D2A18] transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-stone-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-semibold text-[#5D2A18] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="pramaan_login_secret"
                  required
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

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-[#5D2A18] focus:ring-[#5D2A18] border-stone-300"
                />
                <span>Keep me signed in</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-[#5D2A18] hover:bg-[#431D10] text-white rounded-lg font-semibold text-sm transition-all duration-150 shadow-sm disabled:opacity-70 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Enter Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center mt-6 pt-4 border-t border-stone-100 text-xs text-stone-500">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-[#5D2A18] hover:underline">
              Sign up free
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
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
        <LoginContent />
      </Suspense>

      {/* Minimal Footer */}
      <footer className="my-auto text-center text-xs text-stone-400">
        © Pramaan. Built for a more informed India.
      </footer>
    </div>
  );
}
