"use client";

import React from "react";
import { X, Calendar, Building2, ExternalLink, BookmarkCheck } from "lucide-react";
import { DocumentCardData } from "./DocumentVisual";

interface DocumentDetailModalProps {
  doc: DocumentCardData | null;
  onClose: () => void;
}

export function DocumentDetailModal({ doc, onClose }: DocumentDetailModalProps) {
  if (!doc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#FCFAF7] border border-stone-300 rounded-2xl shadow-2xl overflow-hidden text-stone-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${doc.badgeBg}`}>
              {doc.icon}
            </div>
            <div>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${doc.badgeTextColor}`}>
                {doc.type}
              </span>
              <h3 className="text-base font-bold text-stone-900 leading-tight">
                {doc.fullTitle || doc.type}
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

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-4 text-xs text-stone-600 bg-white p-3.5 rounded-xl border border-stone-200">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-stone-400" />
              <span className="font-semibold">{doc.ministry}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              <span>Dated: {doc.date}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700 ml-auto">
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span className="font-medium">Indexed & Verified</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200 space-y-3">
            <h4 className="text-xs font-bold uppercase text-stone-400 tracking-wider">
              Executive AI Summary
            </h4>
            <p className="text-stone-700 text-sm leading-relaxed">
              {doc.summary}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-100/70 border-t border-stone-200 flex items-center justify-between">
          <a
            href="https://egazette.gov.in"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-[#5D2A18] hover:underline flex items-center gap-1"
          >
            <span>View original gazette entry</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#5D2A18] hover:bg-[#431D10] text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
