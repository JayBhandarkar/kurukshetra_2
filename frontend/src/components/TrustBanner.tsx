"use client";

import React from "react";
import { AshokaEmblemIcon } from "./EmblemIcon";
import { ExternalLink } from "lucide-react";

export function TrustBanner() {
  const sources = [
    {
      title: "Government",
      subtitle: "of India",
      href: "https://www.india.gov.in",
    },
    {
      title: "Ministries &",
      subtitle: "Departments",
      href: "https://cabsec.gov.in",
    },
    {
      title: "Public",
      subtitle: "Schemes",
      href: "https://www.myscheme.gov.in",
    },
    {
      title: "Official",
      subtitle: "Portals",
      href: "https://egazette.gov.in",
    },
  ];

  return (
    <div className="w-full border-t border-[#E8E2D7] bg-[#FAF8F5] py-9 mt-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          {/* Left Title */}
          <div className="lg:max-w-xs flex-shrink-0">
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#8C8478] uppercase block mb-1">
              Trusted Public Sources
            </span>
            <h2 className="text-xl sm:text-[22px] font-black text-[#1E1A17] tracking-tight">
              Built for a more informed India.
            </h2>
          </div>

          {/* Vertical divider on desktop */}
          <div className="hidden lg:block h-12 w-[1px] bg-[#DFD9CD] mx-2" />

          {/* Right Government Badges */}
          <div className="flex-1 flex flex-wrap items-center justify-between gap-6 sm:gap-8">
            {sources.map((item, idx) => (
              <a
                key={idx}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 group transition-transform hover:-translate-y-0.5"
              >
                <div className="opacity-80 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <AshokaEmblemIcon className="w-8 h-10 text-[#4A453E] group-hover:text-[#5D2A18] transition-colors" />
                </div>
                <div className="text-left leading-tight">
                  <div className="text-[12.5px] font-bold text-[#2E2822] group-hover:text-[#5D2A18] transition-colors">
                    {item.title}
                  </div>
                  <div className="text-[11.5px] text-[#787167] font-medium">
                    {item.subtitle}
                  </div>
                </div>
              </a>
            ))}

            {/* Open Government Data item */}
            <a
              href="https://data.gov.in"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-left group pl-2 sm:pl-0"
            >
              <div className="leading-tight">
                <div className="text-[12.5px] font-bold text-[#2E2822] group-hover:text-[#5D2A18] transition-colors flex items-center gap-1">
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-70 transition-opacity" />
                </div>
                <div className="text-[11.5px] text-[#787167] font-medium">
                  Government Data
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
