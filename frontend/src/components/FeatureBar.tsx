"use client";

import React from "react";
import { Search, FileText, ArrowLeftRight, ShieldCheck } from "lucide-react";

interface FeatureBarProps {
  onFeatureClick?: (featureKey: string) => void;
}

export function FeatureBar({ onFeatureClick }: FeatureBarProps) {
  const features = [
    {
      key: "search",
      icon: <Search className="w-5 h-5 text-[#6E3420]" />,
      title: "Ask and find",
      description: "Get accurate answers from official government documents.",
    },
    {
      key: "summarize",
      icon: <FileText className="w-5 h-5 text-[#6E3420]" />,
      title: "Understand easily",
      description: "Summarize complex documents in simple language.",
    },
    {
      key: "compare",
      icon: <ArrowLeftRight className="w-5 h-5 text-[#6E3420]" />,
      title: "Compare documents",
      description: "Identify what's new, updated or removed across versions.",
    },
    {
      key: "verify",
      icon: <ShieldCheck className="w-5 h-5 text-[#6E3420]" />,
      title: "Trust the source",
      description: "Every answer links to the exact section and page.",
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {features.map((item) => (
          <div
            key={item.key}
            onClick={() => onFeatureClick?.(item.key)}
            className="flex items-start gap-4 p-3.5 rounded-2xl hover:bg-stone-200/40 transition-colors duration-200 cursor-pointer group"
          >
            {/* Rounded warm icon container */}
            <div className="w-12 h-12 rounded-xl bg-[#F4EDE4] flex items-center justify-center flex-shrink-0 group-hover:bg-[#EAE0D4] transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
              {item.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[#1E1A17] text-[15px] sm:text-base leading-snug group-hover:text-[#5D2A18] transition-colors">
                {item.title}
              </h3>
              <p className="text-[#6E685F] text-xs sm:text-[13px] leading-relaxed mt-1">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
