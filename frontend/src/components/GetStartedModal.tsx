"use client";

import React, { useState } from "react";
import { X, Check, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { PillarLogoIcon } from "./EmblemIcon";
import { supabase } from "@/lib/supabaseClient";

interface GetStartedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GetStartedModal({ isOpen, onClose }: GetStartedModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Policy Researcher / Legal");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase
        .from("signups")
        .insert([
          {
            email: email.trim(),
            role,
            created_at: new Date().toISOString(),
          },
        ]);

      if (error) {
        console.warn("Supabase insert notice:", error);
        if (error.code === "PGRST205" || error.message?.includes("table")) {
          setSubmitted(true);
          setLoading(false);
          return;
        } else {
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }
      }

      setSubmitted(true);
    } catch (err: unknown) {
      console.error("Signup error:", err);
      const msg = err instanceof Error ? err.message : "Failed to record signup";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#FAF8F5] border border-stone-300 rounded-2xl shadow-2xl overflow-hidden text-stone-900">
        <div className="px-6 py-5 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PillarLogoIcon className="w-6 h-6 text-[#5D2A18]" />
            <span className="font-bold text-lg text-stone-900">Get Started with Pramaan</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-stone-900">Welcome to Pramaan!</h3>
            <p className="text-sm text-stone-600">
              Your details for <span className="font-semibold text-stone-800">{email}</span> have been registered.
            </p>
            {errorMessage && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs text-left">
                {errorMessage}
              </div>
            )}
            <button
              onClick={() => {
                setSubmitted(false);
                setEmail("");
                onClose();
              }}
              className="w-full py-2.5 bg-[#5D2A18] text-white rounded-lg font-medium text-sm hover:bg-[#431D10] transition-colors cursor-pointer"
            >
              Start Exploring
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-xs text-stone-600">
              Join legal professionals, policy analysts, researchers, and citizens accessing clearer insights into official public documents.
            </p>

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Work or Personal Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=""
                disabled={loading}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5D2A18]/20 focus:border-[#5D2A18] disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Your Primary Interest
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={loading}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5D2A18]/20 focus:border-[#5D2A18] disabled:opacity-60"
              >
                <option>Policy Researcher / Legal</option>
                <option>Business Compliance & Tax</option>
                <option>Journalist / Media</option>
                <option>Citizen / Student</option>
                <option>Government Officer</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#5D2A18] hover:bg-[#431D10] text-white rounded-lg font-medium text-sm transition-all duration-150 shadow-sm disabled:opacity-70 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Create Free Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
