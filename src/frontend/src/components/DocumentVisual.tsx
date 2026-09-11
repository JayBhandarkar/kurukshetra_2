"use client";

import React from "react";
import { FileText, FileCode, FileCheck, FileSpreadsheet, ScrollText } from "lucide-react";

export interface DocumentCardData {
  id: string;
  type: string;
  ministry: string;
  date: string;
  badgeBg: string;
  badgeTextColor: string;
  icon: React.ReactNode;
  summary?: string;
  fullTitle?: string;
}

export const sampleDocuments: DocumentCardData[] = [
  {
    id: "notification-edu",
    type: "Notification",
    ministry: "Ministry of Education",
    date: "12 Jan 2025",
    badgeBg: "bg-[#FFF6E9]",
    badgeTextColor: "text-[#D97706]",
    icon: <ScrollText className="w-4 h-4 text-[#D97706]" />,
    fullTitle: "National Education Policy Implementation Framework 2025-26",
    summary:
      "Revised credit-framework guidelines for multidisciplinary undergraduate courses across central & state universities.",
  },
  {
    id: "circular-fin",
    type: "Circular",
    ministry: "Ministry of Finance",
    date: "3 Mar 2025",
    badgeBg: "bg-[#EBF5FF]",
    badgeTextColor: "text-[#0284C7]",
    icon: <FileText className="w-4 h-4 text-[#0284C7]" />,
    fullTitle: "Direct Tax TDS Provisions & Cross-Border Tech Remittance",
    summary:
      "Clarification regarding procedural compliances, form 15CA/CB thresholds, and fast-track processing.",
  },
  {
    id: "order-health",
    type: "Government Order",
    ministry: "Ministry of Health",
    date: "21 Feb 2025",
    badgeBg: "bg-[#FFF1E8]",
    badgeTextColor: "text-[#C2410C]",
    icon: <FileCode className="w-4 h-4 text-[#C2410C]" />,
    fullTitle: "Ayushman Digital Mission Interoperability Standards",
    summary:
      "Mandatory adherence to FHIR protocols for tier-1 and tier-2 empaneled healthcare providers.",
  },
  {
    id: "guidelines-rural",
    type: "Guidelines",
    ministry: "Ministry of Rural Development",
    date: "18 Nov 2024",
    badgeBg: "bg-[#EDFDF2]",
    badgeTextColor: "text-[#16A34A]",
    icon: <FileCheck className="w-4 h-4 text-[#16A34A]" />,
    fullTitle: "PMAY-G Phase III Allocation and Direct Benefit Transfer",
    summary:
      "Enhanced unit assistance norms and geotagged asset verification workflow.",
  },
  {
    id: "policy-niti",
    type: "Policy Document",
    ministry: "NITI Aayog",
    date: "5 Aug 2024",
    badgeBg: "bg-[#F7EEFF]",
    badgeTextColor: "text-[#9333EA]",
    icon: <FileSpreadsheet className="w-4 h-4 text-[#9333EA]" />,
    fullTitle: "National AI Governance & Sovereign Compute Framework",
    summary:
      "Strategic roadmap for public GPU clusters, open dataset repositories, and ethical AI deployment.",
  },
];

interface DocumentVisualProps {
  onSelectDocument?: (doc: DocumentCardData) => void;
}

export function DocumentVisual({ onSelectDocument }: DocumentVisualProps) {
  return (
    <div className="relative w-full h-[480px] md:h-[510px] lg:h-[530px] flex items-center justify-center select-none">
      {/* Background SVG Fluid Connecting Paths */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        viewBox="0 0 600 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft elegant curves connecting the 5 document cards in an organic web */}
        <path
          d="M 110 90 C 180 70, 220 50, 270 65 C 360 80, 420 120, 460 220 C 490 290, 430 370, 340 400 C 260 430, 180 420, 125 380 C 60 330, 40 180, 110 90"
          stroke="#E5DDD0"
          strokeWidth="1.75"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M 120 140 C 200 180, 310 160, 450 220 C 370 280, 260 320, 130 370"
          stroke="#ECE4D9"
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>

      {/* Floating Document Cards */}
      <div className="relative w-full h-full max-w-[580px]">
        {/* 1. Notification (Ministry of Education) - Top Left */}
        <div
          onClick={() => onSelectDocument?.(sampleDocuments[0])}
          className="group absolute top-[4%] left-[2%] w-[165px] sm:w-[176px] bg-white rounded-xl p-3.5 border border-[#E9E4DC] shadow-[0_4px_18px_rgba(0,0,0,0.03)] hover:shadow-xl hover:border-[#D8CFBF] hover:-translate-y-1 transition-all duration-200 cursor-pointer z-10"
        >
          <div className="flex items-start gap-2.5">
            <div className={`p-1.5 rounded-md ${sampleDocuments[0].badgeBg} flex-shrink-0 mt-0.5`}>
              {sampleDocuments[0].icon}
            </div>
            <div className="min-w-0">
              <h4 className="text-[13px] font-bold text-stone-900 leading-tight">Notification</h4>
              <p className="text-[10.5px] text-stone-500 truncate mt-0.5">Ministry of Education</p>
            </div>
          </div>
          {/* Skeleton lines */}
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-full group-hover:bg-[#DFD8CD] transition-colors" />
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-4/5" />
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-3/5" />
          </div>
          <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[9.5px] text-stone-400 font-medium">
            <span>Dated: 12 Jan 2025</span>
          </div>
        </div>

        {/* 2. Circular (Ministry of Finance) - Top Center */}
        <div
          onClick={() => onSelectDocument?.(sampleDocuments[1])}
          className="group absolute top-[0%] left-[36%] sm:left-[35%] w-[168px] sm:w-[178px] bg-white rounded-xl p-3.5 border border-[#E9E4DC] shadow-[0_4px_18px_rgba(0,0,0,0.03)] hover:shadow-xl hover:border-[#D8CFBF] hover:-translate-y-1 transition-all duration-200 cursor-pointer z-20"
        >
          <div className="flex items-start gap-2.5">
            <div className={`p-1.5 rounded-md ${sampleDocuments[1].badgeBg} flex-shrink-0 mt-0.5`}>
              {sampleDocuments[1].icon}
            </div>
            <div className="min-w-0">
              <h4 className="text-[13px] font-bold text-stone-900 leading-tight">Circular</h4>
              <p className="text-[10.5px] text-stone-500 truncate mt-0.5">Ministry of Finance</p>
            </div>
          </div>
          {/* Skeleton lines */}
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-full group-hover:bg-[#DFD8CD] transition-colors" />
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-11/12" />
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-3/4" />
          </div>
          <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[9.5px] text-stone-400 font-medium">
            <span>Dated: 3 Mar 2025</span>
          </div>
        </div>

        {/* 3. Government Order (Ministry of Health) - Moved DOWN on Right, Fully Visible */}
        <div
          onClick={() => onSelectDocument?.(sampleDocuments[2])}
          className="group absolute top-[28%] right-[2%] sm:right-[3%] w-[172px] sm:w-[184px] bg-white rounded-xl p-3.5 border border-[#E9E4DC] shadow-[0_6px_20px_rgba(0,0,0,0.04)] hover:shadow-xl hover:border-[#D8CFBF] hover:-translate-y-1 transition-all duration-200 cursor-pointer z-30"
        >
          <div className="flex items-start gap-2.5">
            <div className={`p-1.5 rounded-md ${sampleDocuments[2].badgeBg} flex-shrink-0 mt-0.5`}>
              {sampleDocuments[2].icon}
            </div>
            <div className="min-w-0">
              <h4 className="text-[13px] font-bold text-stone-900 leading-tight">Government Order</h4>
              <p className="text-[10.5px] text-stone-500 truncate mt-0.5">Ministry of Health</p>
            </div>
          </div>
          {/* Skeleton lines */}
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-full group-hover:bg-[#DFD8CD] transition-colors" />
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-4/5" />
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-3/5" />
          </div>
          <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[9.5px] text-stone-400 font-medium">
            <span>Dated: 21 Feb 2025</span>
          </div>
        </div>

        {/* 4. Guidelines (Ministry of Rural Development) - Bottom Left */}
        <div
          onClick={() => onSelectDocument?.(sampleDocuments[3])}
          className="group absolute bottom-[6%] left-[4%] sm:left-[6%] w-[176px] sm:w-[188px] bg-white rounded-xl p-3.5 border border-[#E9E4DC] shadow-[0_4px_18px_rgba(0,0,0,0.03)] hover:shadow-xl hover:border-[#D8CFBF] hover:-translate-y-1 transition-all duration-200 cursor-pointer z-20"
        >
          <div className="flex items-start gap-2.5">
            <div className={`p-1.5 rounded-md ${sampleDocuments[3].badgeBg} flex-shrink-0 mt-0.5`}>
              {sampleDocuments[3].icon}
            </div>
            <div className="min-w-0">
              <h4 className="text-[13px] font-bold text-stone-900 leading-tight">Guidelines</h4>
              <p className="text-[10.5px] text-stone-500 truncate mt-0.5">
                Ministry of Rural Development
              </p>
            </div>
          </div>
          {/* Skeleton lines */}
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-full group-hover:bg-[#DFD8CD] transition-colors" />
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-5/6" />
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-2/3" />
          </div>
          <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[9.5px] text-stone-400 font-medium">
            <span>Dated: 18 Nov 2024</span>
          </div>
        </div>

        {/* 5. Policy Document (NITI Aayog) - Bottom Center/Right */}
        <div
          onClick={() => onSelectDocument?.(sampleDocuments[4])}
          className="group absolute bottom-[8%] left-[42%] sm:left-[43%] w-[172px] sm:w-[182px] bg-white rounded-xl p-3.5 border border-[#E9E4DC] shadow-[0_4px_18px_rgba(0,0,0,0.03)] hover:shadow-xl hover:border-[#D8CFBF] hover:-translate-y-1 transition-all duration-200 cursor-pointer z-20"
        >
          <div className="flex items-start gap-2.5">
            <div className={`p-1.5 rounded-md ${sampleDocuments[4].badgeBg} flex-shrink-0 mt-0.5`}>
              {sampleDocuments[4].icon}
            </div>
            <div className="min-w-0">
              <h4 className="text-[13px] font-bold text-stone-900 leading-tight">
                Policy Document
              </h4>
              <p className="text-[10.5px] text-stone-500 truncate mt-0.5">NITI Aayog</p>
            </div>
          </div>
          {/* Skeleton lines */}
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-full group-hover:bg-[#DFD8CD] transition-colors" />
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-4/5" />
            <div className="h-1.5 bg-[#EAE6DF] rounded-full w-3/4" />
          </div>
          <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[9.5px] text-stone-400 font-medium">
            <span>Dated: 5 Aug 2024</span>
          </div>
        </div>

        {/* Handwritten Stylized Callout Note - Positioned in the bottom right corner without overlap */}
        <div className="absolute bottom-[2%] right-[1%] sm:right-[3%] rotate-[-6deg] pointer-events-none select-none z-10">
          <div className="relative">
            <p className="font-handwriting text-2xl sm:text-[28px] text-[#7A3622] font-semibold tracking-wide leading-none text-center">
              From <br />
              documents <br />
              to decisions.
            </p>
            {/* Elegant swoosh flourish curve */}
            <svg
              className="w-24 sm:w-26 h-4 text-[#8C432D] mt-1 -ml-2"
              viewBox="0 0 120 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M 5 12 C 35 18, 80 16, 115 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
