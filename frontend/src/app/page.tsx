"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getClientSession } from "@/lib/authSession";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { FeatureBar } from "@/components/FeatureBar";
import { TrustBanner } from "@/components/TrustBanner";
import { SearchModal } from "@/components/SearchModal";
import { CompareModal } from "@/components/CompareModal";
import { DocumentsModal } from "@/components/DocumentsModal";
import { AboutModal } from "@/components/AboutModal";
import { DocumentDetailModal } from "@/components/DocumentDetailModal";
import { GetStartedModal } from "@/components/GetStartedModal";
import { DocumentCardData } from "@/components/DocumentVisual";

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Home");
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentCardData | null>(null);
  const [getStartedOpen, setGetStartedOpen] = useState(false);

  // When user is already logged in, redirect inside to the Pramaan Workspace
  useEffect(() => {
    const session = getClientSession();
    if (session?.email) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSearchModalOpen(true);
  };

  const handleFeatureClick = (featureKey: string) => {
    if (featureKey === "compare") {
      setCompareModalOpen(true);
    } else if (featureKey === "search") {
      setDocumentsModalOpen(true);
    } else if (featureKey === "summarize") {
      handleSearch("Summarize the National Education Policy guidelines 2025");
    } else if (featureKey === "verify") {
      handleSearch("Check clause citation authenticity for PMAY-G schemes");
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "Home") {
      // scroll to top or maintain clean landing view
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (tab === "Documents") {
      setDocumentsModalOpen(true);
    } else if (tab === "Compare") {
      setCompareModalOpen(true);
    } else if (tab === "About") {
      setAboutModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1E1A17] flex flex-col justify-between selection:bg-[#5D2A18] selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenGetStarted={() => setGetStartedOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center">
        <Hero
          onSearchSubmit={handleSearch}
          onSelectDocument={(doc) => setSelectedDoc(doc)}
          onCompareTrigger={() => setCompareModalOpen(true)}
        />

        {/* 4 Value Proposition Cards */}
        <FeatureBar onFeatureClick={handleFeatureClick} />
      </main>

      {/* Bottom Trusted Sources Section */}
      <TrustBanner />

      {/* Interactive Modals */}
      <DocumentsModal
        isOpen={documentsModalOpen}
        onClose={() => {
          setDocumentsModalOpen(false);
          setActiveTab("Home");
        }}
        onSelectDoc={(doc) => setSelectedDoc(doc)}
      />

      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => {
          setAboutModalOpen(false);
          setActiveTab("Home");
        }}
        onOpenGetStarted={() => setGetStartedOpen(true)}
      />

      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        query={searchQuery}
      />

      <CompareModal
        isOpen={compareModalOpen}
        onClose={() => {
          setCompareModalOpen(false);
          setActiveTab("Home");
        }}
      />

      <DocumentDetailModal
        doc={selectedDoc}
        onClose={() => setSelectedDoc(null)}
      />

      <GetStartedModal
        isOpen={getStartedOpen}
        onClose={() => setGetStartedOpen(false)}
      />
    </div>
  );
}
