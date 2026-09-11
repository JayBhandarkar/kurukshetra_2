"use client";

import React from "react";
import { X, ShieldCheck, Search, BookOpen, ExternalLink, Cpu } from "lucide-react";
import { AshokaEmblemIcon, PillarLogoIcon } from "./EmblemIcon";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGetStarted?: () => void;
}

export function AboutModal({ isOpen, onClose, onOpenGetStarted }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#FAF8F5] border border-stone-300 rounded-2xl shadow-2xl overflow-hidden text-stone-900 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5EFE6] flex items-center justify-center text-[#5D2A18]">
              <PillarLogoIcon className="w-6 h-6 text-[#5D2A18]" />
            </div>
            <div>
              <span className="text-[11px] font-bold tracking-[0.2em] text-[#7A3622] uppercase">
                About Pramaan
              </span>
              <h2 className="text-xl font-bold text-stone-900 leading-tight">
                Government Documents. Clearer Insights.
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-stone-700">
          {/* Mission */}
          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-2">
            <h3 className="font-bold text-base text-stone-900">What is Pramaan?</h3>
            <p className="leading-relaxed text-stone-600">
              Pramaan (प्रमाण — meaning authentic evidence & proof) is a sovereign public intelligence platform designed to bridge the gap between complex official Indian gazettes and actionable decision-making. We ingest, index, and structure thousands of circulars, notifications, guidelines, and policy frameworks released daily across central ministries and state departments.
            </p>
          </div>

          {/* Key Capabilities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-xs sm:text-sm">
                <Search className="w-4 h-4 text-[#7A3622]" />
                <span>Instant Clause Search</span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                Query thousands of gazette pages in natural language and get precise clause-level answers.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-xs sm:text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Direct Source Verification</span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                Every AI summary links directly to the original PDF page and section in official repositories.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-xs sm:text-sm">
                <BookOpen className="w-4 h-4 text-blue-700" />
                <span>Multi-Version Diffing</span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                Compare past and present circular revisions to instantly spot what was added, modified, or removed.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-stone-900 text-xs sm:text-sm">
                <Cpu className="w-4 h-4 text-purple-700" />
                <span>Private & Sovereignty First</span>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed">
                Built strictly with open data standards and respect for public document integrity.
              </p>
            </div>
          </div>

          {/* Trust note */}
          <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E8DDD0] flex items-center gap-4">
            <AshokaEmblemIcon className="w-8 h-10 text-stone-600 flex-shrink-0" />
            <div className="text-xs text-stone-600 leading-relaxed">
              <strong className="text-stone-900 block mb-0.5">Connected to Public Repositories</strong>
              Indexes notifications from egazette.gov.in, data.gov.in, and official ministry portals.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
          <span className="text-xs text-stone-500">Pramaan v1.0 • Informed India</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenGetStarted?.();
              }}
              className="px-4 py-1.5 bg-[#5D2A18] hover:bg-[#431D10] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
