"use client";

import React, { useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import { DocumentVisual, DocumentCardData } from "./DocumentVisual";

interface HeroProps {
  onSearchSubmit: (query: string) => void;
  onSelectDocument: (doc: DocumentCardData) => void;
  onCompareTrigger: () => void;
}

export function Hero({
  onSearchSubmit,
  onSelectDocument,
  onCompareTrigger,
}: HeroProps) {
  const [query, setQuery] = useState("");

  const suggestedQueries = [
    { text: "What is the eligibility for this scheme?", type: "search" },
    { text: "Summarize this notification", type: "search" },
    { text: "What changed between these documents?", type: "compare" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearchSubmit(query.trim());
    }
  };

  const handleSuggestionClick = (item: { text: string; type: string }) => {
    setQuery(item.text);
    if (item.type === "compare") {
      onCompareTrigger();
    } else {
      onSearchSubmit(item.text);
    }
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4 lg:pt-12 lg:pb-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center">
        {/* Left Column (Content & Search) */}
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

          {/* Search Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="relative flex items-center w-full max-w-[540px] bg-white rounded-full border border-[#E3DDD4] shadow-[0_4px_24px_rgba(0,0,0,0.04)] pl-5 pr-2 py-2 mt-7 transition-all duration-200 focus-within:border-[#5D2A18] focus-within:ring-2 focus-within:ring-[#5D2A18]/20 focus-within:shadow-md"
          >
            <Search className="w-5 h-5 text-[#8F887D] mr-3 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about any government document..."
              className="w-full bg-transparent text-sm sm:text-[15px] text-[#1E1A17] placeholder-[#8F887D] focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Search documents"
              className="w-10 h-10 rounded-full bg-[#5D2A18] hover:bg-[#431D10] text-white flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 flex-shrink-0 ml-2 shadow-sm cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Try Asking Suggested Pills */}
          <div className="flex flex-wrap items-center gap-2 mt-5 text-xs">
            <span className="font-semibold text-[#302B25] mr-1">Try asking:</span>
            {suggestedQueries.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSuggestionClick(item)}
                className="bg-[#EAE4DC]/80 hover:bg-[#DFD8CE] text-[#38322C] font-medium px-3.5 py-1.5 rounded-full transition-all duration-150 text-[11.5px] sm:text-xs cursor-pointer border border-[#DFD8CE]/70"
              >
                {item.text}
              </button>
            ))}
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
