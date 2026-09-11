"use client";

import React from "react";
import { X, CheckCircle2, BookOpen, ExternalLink, Sparkles } from "lucide-react";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
}

export function SearchModal({ isOpen, onClose, query }: SearchModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#FCFAF7] border border-stone-300/80 rounded-2xl shadow-2xl overflow-hidden text-stone-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F7EFE8] flex items-center justify-center text-[#5D2A18]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs uppercase font-bold text-stone-400 tracking-wider">
                Pramaan AI Answer & Verified Citations
              </span>
              <h3 className="text-base font-bold text-stone-900 line-clamp-1">
                {query || "Direct Query Analysis"}
              </h3>
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
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* Executive Summary */}
          <div className="bg-white rounded-xl p-5 border border-stone-200/90 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Direct Answer
              </span>
            </div>
            <p className="text-stone-800 text-sm md:text-[15px] leading-relaxed">
              Based on the latest gazette notification and guidelines issued by the respective Ministry:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-stone-700 list-disc list-inside">
              <li>
                <strong>Eligibility Threshold:</strong> Citizens and registered entities with valid Aadhaar/GSTIN, meeting annual turnover limits under Section 4(b).
              </li>
              <li>
                <strong>Key Exclusions:</strong> Prior defaults in related central assistance schemes within the past 2 financial years disqualify direct DBT disbursement.
              </li>
              <li>
                <strong>Timeline:</strong> Processing turnaround mandated within 15 working days through automated PFMS integration.
              </li>
            </ul>
          </div>

          {/* Exact Citations */}
          <div>
            <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Exact Sources & Section References
            </h4>
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-xl border border-stone-200 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 rounded">
                      Clause 6.2(a)
                    </span>
                    <span className="text-xs font-semibold text-stone-800">
                      Gazette Notification No. 142/2025
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 mt-1 italic font-serif bg-stone-50 p-2 rounded border border-stone-100">
                    &quot;The competent authority shall verify eligible beneficiary credentials via standard API Gateway before sanction order release.&quot;
                  </p>
                  <span className="text-[11px] text-stone-400 mt-1.5 block">
                    Source: Ministry of Rural Development • Page 4, Paragraph 3
                  </span>
                </div>
                <a
                  href="https://egazette.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#5D2A18] hover:text-[#431D10] text-xs font-semibold flex items-center gap-1 flex-shrink-0"
                >
                  <span>Verify</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-100/70 border-t border-stone-200 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            Official government documents are scanned and indexed daily.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#5D2A18] hover:bg-[#431D10] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
