"use client";

import React, { useState } from "react";
import { X, Search, Filter, Calendar, Building2, FileText, ExternalLink, Download, Sparkles } from "lucide-react";
import { DocumentCardData, sampleDocuments } from "./DocumentVisual";

interface DocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDoc: (doc: DocumentCardData) => void;
}

const allGovernmentDocuments: (DocumentCardData & { gazetteNumber: string; pages: number })[] = [
  {
    id: "circular-fin",
    type: "Circular",
    ministry: "Ministry of Finance",
    date: "03 Mar 2025",
    badgeBg: "bg-[#EBF5FF]",
    badgeTextColor: "text-[#0284C7]",
    icon: <FileText className="w-4 h-4 text-[#0284C7]" />,
    fullTitle: "Direct Tax TDS Provisions & Cross-Border Tech Remittance",
    summary:
      "Clarification regarding procedural compliances, form 15CA/CB thresholds, and fast-track processing for software & IT services.",
    gazetteNumber: "CBDT/2025/CIR-04",
    pages: 6,
  },
  {
    id: "order-health",
    type: "Government Order",
    ministry: "Ministry of Health & Family Welfare",
    date: "21 Feb 2025",
    badgeBg: "bg-[#FFF1E8]",
    badgeTextColor: "text-[#C2410C]",
    icon: <FileText className="w-4 h-4 text-[#C2410C]" />,
    fullTitle: "Ayushman Bharat Digital Mission Interoperability Standards",
    summary:
      "Mandatory adherence to FHIR protocols for tier-1 and tier-2 empaneled healthcare network providers.",
    gazetteNumber: "ABDM/GO-88/2025",
    pages: 12,
  },
  {
    id: "notification-edu",
    type: "Notification",
    ministry: "Ministry of Education",
    date: "12 Jan 2025",
    badgeBg: "bg-[#FFF6E9]",
    badgeTextColor: "text-[#D97706]",
    icon: <FileText className="w-4 h-4 text-[#D97706]" />,
    fullTitle: "National Education Policy Credit Framework Guidelines",
    summary:
      "Revised credit accumulation and multi-entry/multi-exit norms for undergraduate courses across Central & State Universities.",
    gazetteNumber: "UGC/NEP-CF/2025-01",
    pages: 18,
  },
  {
    id: "guidelines-rural",
    type: "Guidelines",
    ministry: "Ministry of Rural Development",
    date: "18 Nov 2024",
    badgeBg: "bg-[#EDFDF2]",
    badgeTextColor: "text-[#16A34A]",
    icon: <FileText className="w-4 h-4 text-[#16A34A]" />,
    fullTitle: "PMAY-G Phase III Allocation and Direct Benefit Transfer Norms",
    summary:
      "Enhanced unit financial assistance and mandatory geotagged asset verification workflow before fund disbursement.",
    gazetteNumber: "MORD/PMAYG/III/2024",
    pages: 8,
  },
  {
    id: "policy-niti",
    type: "Policy Document",
    ministry: "NITI Aayog",
    date: "05 Aug 2024",
    badgeBg: "bg-[#F7EEFF]",
    badgeTextColor: "text-[#9333EA]",
    icon: <FileText className="w-4 h-4 text-[#9333EA]" />,
    fullTitle: "National AI Governance & Sovereign Compute Infrastructure Framework",
    summary:
      "Strategic roadmap for 10,000+ GPU national compute clusters, open public datasets, and responsible AI guardrails.",
    gazetteNumber: "NITI/AI-FR/2024/08",
    pages: 44,
  },
  {
    id: "circular-rbi",
    type: "Circular",
    ministry: "Reserve Bank of India",
    date: "14 Jul 2024",
    badgeBg: "bg-[#EBF5FF]",
    badgeTextColor: "text-[#0284C7]",
    icon: <FileText className="w-4 h-4 text-[#0284C7]" />,
    fullTitle: "Master Direction – Cyber Resilience & Digital Payment Security",
    summary:
      "Stipulations on tokenization, multi-factor authentication for cross-border transactions, and root-level security audits.",
    gazetteNumber: "RBI/2024-25/112",
    pages: 24,
  },
];

export function DocumentsModal({ isOpen, onClose, onSelectDoc }: DocumentsModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  if (!isOpen) return null;

  const categories = ["All", "Circular", "Notification", "Government Order", "Guidelines", "Policy Document"];

  const filteredDocs = allGovernmentDocuments.filter((doc) => {
    const matchesCategory = selectedCategory === "All" || doc.type === selectedCategory;
    const matchesSearch =
      doc.fullTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.ministry.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.gazetteNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#FAF8F5] border border-stone-300 rounded-2xl shadow-2xl overflow-hidden text-stone-900 flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5EFE6] flex items-center justify-center text-[#5D2A18]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold tracking-[0.2em] text-[#7A3622] uppercase">
                Official Document Index
              </span>
              <h2 className="text-xl font-bold text-stone-900 leading-tight">
                Government Circulars & Gazettes
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

        {/* Search & Filter Bar */}
        <div className="p-6 bg-white border-b border-stone-200 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, ministry, circular number, or keyword..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 bg-[#FAF8F5]/60 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5D2A18]/20 focus:border-[#5D2A18] transition-all"
            />
          </div>

          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-stone-500 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#5D2A18] text-white"
                    : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#FAF8F5]">
          {filteredDocs.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-sm">
              No government documents found matching your filter.
            </div>
          ) : (
            filteredDocs.map((doc, docIdx) => (
              <div
                key={`modal-doc-${doc.id || docIdx}-${docIdx}`}
                onClick={() => {
                  onSelectDoc(doc);
                  onClose();
                }}
                className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200 hover:border-[#5D2A18]/40 hover:shadow-md transition-all duration-150 cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${doc.badgeBg} ${doc.badgeTextColor}`}>
                      {doc.type}
                    </span>
                    <span className="text-xs text-stone-400 font-mono">
                      {doc.gazetteNumber}
                    </span>
                  </div>

                  <h3 className="font-bold text-stone-900 text-sm sm:text-base leading-snug group-hover:text-[#5D2A18] transition-colors">
                    {doc.fullTitle}
                  </h3>

                  <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                    {doc.summary}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-stone-400 pt-1">
                    <span className="flex items-center gap-1 text-stone-700 font-medium">
                      <Building2 className="w-3 h-3 text-stone-400" />
                      {doc.ministry}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      {doc.date}
                    </span>
                    <span>{doc.pages} Pages</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDoc(doc);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 bg-[#FAF6F0] hover:bg-[#5D2A18] text-[#5D2A18] hover:text-white rounded-lg text-xs font-semibold border border-[#5D2A18]/30 hover:border-[#5D2A18] transition-all flex items-center gap-1.5"
                  >
                    <span>View Clauses</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-stone-100 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <span>Showing {filteredDocs.length} indexed gazette notifications</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
