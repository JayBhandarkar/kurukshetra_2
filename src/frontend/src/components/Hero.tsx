"use client";

import React from "react";
import { Radio, FileText, Scale, BookOpen, ShieldCheck } from "lucide-react";
import { DocumentVisual, DocumentCardData } from "./DocumentVisual";

interface HeroProps {
  onSearchSubmit?: (query: string) => void;
  onSelectDocument: (doc: DocumentCardData) => void;
  onCompareTrigger?: () => void;
}

export function Hero({
  onSelectDocument,
}: HeroProps) {
  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4 lg:pt-12 lg:pb-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center">
        {/* Left Column (Content & Live Feeds) */}
        <div className="lg:col-span-6 xl:col-span-6 flex flex-col justify-center">
          {/* Eyebrow */}
          <div className="mb-4">
            <span className="text-[11px] sm:text-xs font-bold tracking-[0.24em] text-[#8C4A32] uppercase">
              Public Documents. Real Answers.
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-[46px] xl:text-[50px] font-black tracking-[-0.03em] text-[#1E1A17] leading-[1.18]">
            Understand Government Documents.
            <span className="block text-[#6D301C] mt-1.5 sm:mt-2">Without the paperwork.</span>
          </h1>

          {/* Subtitle Description */}
          <p className="text-[#666057] text-[15px] sm:text-[16px] lg:text-[16.5px] leading-[1.65] mt-4 sm:mt-5 max-w-[530px] font-normal">
            Pramaan helps you search, summarize, compare and understand government circulars, notifications, orders, guidelines and policy documents — with accurate answers and trusted source references.
          </p>

          {/* Live Sovereign Feeds & Supported Portals */}
          <div className="mt-7 space-y-3.5 max-w-[530px]">
            {/* Live Feed Status Bar */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-[#FAF4EC] border border-[#EADBCC] rounded-full text-xs text-[#5D2A18]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
              </span>
              <span className="font-semibold text-[11.5px] tracking-wide">
                Live Data Feeds: <span className="font-normal text-stone-600">egazette.gov.in · pib.gov.in · Central Ministries</span>
              </span>
            </div>

            {/* Supported Document Classification Tags */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E8E2D8] rounded-xl text-xs font-medium text-stone-700 shadow-2xs">
                <FileText className="w-3.5 h-3.5 text-[#8C4A32]" />
                <span>Extraordinary Gazettes</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E8E2D8] rounded-xl text-xs font-medium text-stone-700 shadow-2xs">
                <Radio className="w-3.5 h-3.5 text-[#8C4A32]" />
                <span>Ministry Circulars</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E8E2D8] rounded-xl text-xs font-medium text-stone-700 shadow-2xs">
                <Scale className="w-3.5 h-3.5 text-[#8C4A32]" />
                <span>Statutory Orders</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E8E2D8] rounded-xl text-xs font-medium text-stone-700 shadow-2xs">
                <BookOpen className="w-3.5 h-3.5 text-[#8C4A32]" />
                <span>Policy Frameworks</span>
              </div>
            </div>

            {/* Subtle Provenance Note */}
            <div className="flex items-center gap-1.5 text-[11.5px] text-stone-500 pt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
              <span>Verifiable clause-level provenance with cryptographic source attribution</span>
            </div>
          </div>
        </div>

        {/* Right Column (Document Network Visual) */}
        <div className="lg:col-span-6 xl:col-span-6 w-full flex justify-center items-center">
          <DocumentVisual onSelectDocument={onSelectDocument} />
        </div>
      </div>
    </section>
  );
}
