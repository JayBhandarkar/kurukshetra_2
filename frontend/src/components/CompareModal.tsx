"use client";

import React from "react";
import { X, ArrowLeftRight, Check, Minus, Plus } from "lucide-react";

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompareModal({ isOpen, onClose }: CompareModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#FCFAF7] border border-stone-300 rounded-2xl shadow-2xl overflow-hidden text-stone-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F7EFE8] flex items-center justify-center text-[#5D2A18]">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs uppercase font-bold text-stone-400 tracking-wider">
                Document Version Diff
              </span>
              <h3 className="text-base font-bold text-stone-900">
                Circular Comparison: 2024 vs 2025 Revisions
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diff Columns */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Previous Version */}
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
                <span className="text-xs font-bold text-stone-600">Old: Circular No. 12/2024</span>
                <span className="text-[10px] text-stone-400">Dated: 15 Mar 2024</span>
              </div>
              <div className="space-y-2 text-xs text-stone-600">
                <p className="line-through text-red-700/80 bg-red-50 p-2 rounded flex items-start gap-1.5">
                  <Minus className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Physical submission of certified copies required within 30 days of filing.</span>
                </p>
                <p className="line-through text-red-700/80 bg-red-50 p-2 rounded flex items-start gap-1.5">
                  <Minus className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Maximum exemption limit capped at ₹2.5 Lakhs per financial year.</span>
                </p>
              </div>
            </div>

            {/* Current Version */}
            <div className="bg-white p-4 rounded-xl border border-[#5D2A18]/30 shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
                <span className="text-xs font-bold text-[#5D2A18]">New: Circular No. 04/2025</span>
                <span className="text-[10px] text-stone-400">Dated: 03 Mar 2025</span>
              </div>
              <div className="space-y-2 text-xs text-stone-700">
                <p className="text-emerald-800 bg-emerald-50 p-2 rounded flex items-start gap-1.5 font-medium">
                  <Plus className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                  <span>100% paperless e-verification via DigiLocker and API integration.</span>
                </p>
                <p className="text-emerald-800 bg-emerald-50 p-2 rounded flex items-start gap-1.5 font-medium">
                  <Plus className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-600" />
                  <span>Exemption limit revised upwards to ₹5.0 Lakhs per financial year.</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs text-stone-600">
            <h5 className="font-bold text-stone-800 mb-1">Key Impact Summary:</h5>
            <p>
              Reduces administrative compliance burden for small businesses by eliminating physical document submission and doubling eligible threshold limits.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-100/70 border-t border-stone-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#5D2A18] hover:bg-[#431D10] text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Close Diff
          </button>
        </div>
      </div>
    </div>
  );
}
