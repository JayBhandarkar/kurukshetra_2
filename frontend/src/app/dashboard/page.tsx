"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getClientSession, clearClientSession, UserSession } from "@/lib/authSession";
import { PillarLogoIcon, AshokaEmblemIcon } from "@/components/EmblemIcon";
import {
  Search,
  FileText,
  ArrowLeftRight,
  Database,
  Layers,
  Cpu,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  LogOut,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  BookOpen,
  Languages,
  Server,
  FileCode,
  HardDrive,
  Download,
  Flame,
  ArrowDown,
  Play,
  Check,
  Eye,
  Workflow,
  Network,
  Binary,
  GitBranch,
  LayoutDashboard,
  Settings,
  HelpCircle,
  Pin,
  PinOff,
  Menu,
  ChevronLeft,
  Activity,
  Boxes,
  Zap,
} from "lucide-react";

interface PipelineNode {
  id: string;
  title: string;
  subtitle: string;
  category: "ingest" | "storage" | "extract" | "ai" | "vector" | "rag";
  type?: "branch" | "single" | "target";
  details: string;
  status: "idle" | "running" | "done";
  latency: string;
}

const sovereignWorkflowNodes: PipelineNode[] = [
  { id: "1", title: "Official Government Portal", subtitle: "egazette.gov.in, pib.gov.in, data.gov.in", category: "ingest", details: "Monitored feeds & real-time webhook listeners", status: "done", latency: "12ms" },
  { id: "2", title: "Document Discovery", subtitle: "Automated Gazette & Circular Crawler", category: "ingest", details: "Discovered 28 circulars today across 14 ministries", status: "done", latency: "85ms" },
  { id: "3", title: "Document Registry (PostgreSQL)", subtitle: "Structured Ingestion DB & Version Tracking", category: "storage", details: "UUID registration, gazette numbering & metadata indexing", status: "done", latency: "18ms" },
  { id: "4", title: "Download PDF", subtitle: "Encrypted Secure Stream Fetcher", category: "storage", details: "Verified SSL endpoint & high-speed transfer", status: "done", latency: "140ms" },
  { id: "5", title: "MinIO / S3 Original PDF", subtitle: "Immutable Sovereign Object Storage", category: "storage", details: "SHA-256 integrity hash + AES-256 storage archive", status: "done", latency: "35ms" },
  { id: "6", title: "PDF Validation", subtitle: "Digital Signature & Integrity Check", category: "extract", details: "Cryptographic signature validated (CCA India)", status: "done", latency: "22ms" },
  { id: "7", title: "Text Extraction", subtitle: "Dual-Path Extraction Pipeline", category: "extract", type: "branch", details: "Text PDF (Direct PyPDF parser) & Scanned PDF (Indic OCR engine)", status: "done", latency: "420ms" },
  { id: "8", title: "Language Detection", subtitle: "Multilingual Classifier (Hindi / English / Indic)", category: "ai", details: "Detected: English (82%) + Hindi Rajbhasha (18%)", status: "done", latency: "64ms" },
  { id: "9", title: "Classification Agent", subtitle: "Statutory Order vs Notification vs Act", category: "ai", details: "Classified as: Statutory Order (Ministry of Finance)", status: "done", latency: "110ms" },
  { id: "10", title: "Metadata Extraction", subtitle: "Issuing Authority, Signer, Gazette Number, Date", category: "ai", details: "Extracted: CBDT, Circular 04/2025, Rule 37BB", status: "done", latency: "90ms" },
  { id: "11", title: "Structure Detection", subtitle: "Hierarchy: Parts, Sections, Clauses & Provisos", category: "ai", details: "Identified 18 clauses, 4 sub-clauses, 2 schedules", status: "done", latency: "95ms" },
  { id: "12", title: "Semantic Chunking", subtitle: "Context-Preserving Statutory Chunk Slicing", category: "ai", details: "Generated 48 semantically bounded statutory chunks", status: "done", latency: "45ms" },
  { id: "13", title: "Multilingual Embeddings", subtitle: "Dense 1536-dimensional Vector Encoding", category: "vector", details: "Text-embedding-3-large & Indic-Sentence-BERT", status: "done", latency: "210ms" },
  { id: "14", title: "QDRANT Vector DB", subtitle: "Vectors, Semantic Chunks & Payload Metadata", category: "vector", details: "142,800 active vectors • HNSW Cosine Indexing", status: "done", latency: "8ms" },
  { id: "15", title: "READY FOR RAG", subtitle: "Real-time Citation Grounding & LLM Synthesis", category: "rag", type: "target", details: "Sub-second hybrid search ready for user queries", status: "done", latency: "3ms" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<"rag" | "pipeline" | "registry" | "compare">("rag");

  // Sidebar hover & pin state
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Computed state for whether the sidebar is currently wide
  const isSidebarExpanded = isSidebarHovered || isSidebarPinned;

  // RAG Search State
  const [query, setQuery] = useState("");
  const [selectedMinistry, setSelectedMinistry] = useState("All Ministries");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    answer: string;
    citations: Array<{ clause: string; source: string; text: string; page: number; score: number }>;
    ministry: string;
    confidence: number;
  } | null>(null);

  // Ingestion simulation state
  const [simulating, setSimulating] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);

  // Compare State
  const [compareDocA, setCompareDocA] = useState("Circular No. 12/2024 (15 Mar 2024)");
  const [compareDocB, setCompareDocB] = useState("Circular No. 04/2025 (03 Mar 2025)");

  useEffect(() => {
    const session = getClientSession();
    if (!session?.email) {
      router.replace("/login");
    } else {
      setUser(session);
      setLoadingAuth(false);
    }
  }, [router]);

  const handleSignOut = () => {
    clearClientSession();
    router.push("/");
  };

  const runPipelineSimulation = () => {
    setActiveTab("pipeline");
    setSimulating(true);
    setActiveStepIndex(0);

    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      if (current >= sovereignWorkflowNodes.length) {
        clearInterval(interval);
        setSimulating(false);
        setActiveStepIndex(sovereignWorkflowNodes.length - 1);
      } else {
        setActiveStepIndex(current);
      }
    }, 450);
  };

  const handleRagSearch = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const q = customQuery || query;
    if (!q.trim()) return;

    setSearching(true);
    setSearchResult(null);

    setTimeout(() => {
      setSearching(false);
      setSearchResult({
        answer: `According to the latest Ministry of Finance & Central Board of Direct Taxes (CBDT) gazette notification, outward remittances under Section 195(2) and Rule 37BB have migrated to a fully digital workflow. Authorized Dealer banks verify 15CA/15CB submissions against DigiLocker authenticated credentials, reducing verification turnaround to under 24 hours with zero physical paperwork required.`,
        ministry: selectedMinistry === "All Ministries" ? "Ministry of Finance" : selectedMinistry,
        confidence: 0.98,
        citations: [
          {
            clause: "Clause 4.2(b)",
            source: "CBDT Gazette Notification No. 142/2025",
            text: "All physical documentation mandates under Form 15CA/CB are substituted with cryptographically signed digital tokens via the National Single Sign-On API Gateway.",
            page: 4,
            score: 0.98,
          },
          {
            clause: "Section 195(2) Revised Rule",
            source: "Direct Tax Revision Circular 04/2025",
            text: "The assessing officer shall process digital certificates of lower or nil tax deduction within 15 working days from the date of electronic filing.",
            page: 12,
            score: 0.95,
          },
          {
            clause: "Notification F.No. 370142/18/2025",
            source: "Ministry of Finance • Department of Revenue",
            text: "Eligible tech service exports and software licensing fees shall not attract additional withholding tax when verified with GSTIN invoice reconciliation.",
            page: 7,
            score: 0.93,
          },
        ],
      });
    }, 600);
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#5D2A18] border-t-transparent animate-spin" />
          <span className="text-xs text-stone-500 font-medium">Loading Pramaan Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1E1A17] flex flex-col md:flex-row selection:bg-[#5D2A18] selection:text-white">
      {/* MOBILE TOP BAR */}
      <div className="md:hidden w-full bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link href="/dashboard" className="flex items-center gap-2">
          <PillarLogoIcon className="w-6 h-6 text-[#1E1A17]" />
          <span className="font-extrabold text-lg tracking-tight text-[#1E1A17]">Pramaan</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-stone-600 hover:text-stone-900 rounded-lg hover:bg-stone-100"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* MOBILE DROPDOWN */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-stone-200 px-4 py-3 space-y-2 z-50 animate-in slide-in-from-top duration-200">
          <button
            onClick={() => {
              setActiveTab("rag");
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${
              activeTab === "rag" ? "bg-[#FAF8F5] text-[#5D2A18] font-bold" : "text-stone-700"
            }`}
          >
            Policy RAG Studio
          </button>
          <button
            onClick={() => {
              setActiveTab("pipeline");
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${
              activeTab === "pipeline" ? "bg-[#FAF8F5] text-[#5D2A18] font-bold" : "text-stone-700"
            }`}
          >
            Ingestion Architecture (15 Steps)
          </button>
          <button
            onClick={() => {
              setActiveTab("registry");
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${
              activeTab === "registry" ? "bg-[#FAF8F5] text-[#5D2A18] font-bold" : "text-stone-700"
            }`}
          >
            Document Registry
          </button>
          <button
            onClick={() => {
              setActiveTab("compare");
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${
              activeTab === "compare" ? "bg-[#FAF8F5] text-[#5D2A18] font-bold" : "text-stone-700"
            }`}
          >
            Diff Engine
          </button>
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
            <span className="text-xs text-stone-500 truncate">{user?.email}</span>
            <button
              onClick={handleSignOut}
              className="text-xs text-red-600 font-bold hover:underline"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP HOVER-EXPANDING SIDEBAR */}
      <aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`hidden md:flex fixed top-0 left-0 bottom-0 z-50 bg-white/95 backdrop-blur-md border-r border-stone-200/90 flex-col justify-between transition-all duration-300 ease-in-out shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${
          isSidebarExpanded ? "w-64 shadow-[8px_0_32px_rgba(0,0,0,0.08)]" : "w-[72px]"
        }`}
      >
        {/* Top Header / Brand */}
        <div className="p-4 border-b border-stone-100/90 flex items-center justify-between h-16 overflow-hidden">
          <Link href="/dashboard" className="flex items-center gap-3 group flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-[#5D2A18] flex items-center justify-center text-white shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
              <PillarLogoIcon className="w-6 h-6 text-white" />
            </div>
            <div
              className={`transition-all duration-200 flex flex-col whitespace-nowrap ${
                isSidebarExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
              }`}
            >
              <span className="font-black text-lg tracking-tight text-[#1E1A17]">Pramaan</span>
              <span className="text-[10px] font-bold text-[#8C4A32] uppercase tracking-wider">
                Sovereign Intelligence
              </span>
            </div>
          </Link>

          {/* Pin / Unpin button when hovered */}
          {isSidebarExpanded && (
            <button
              onClick={() => setIsSidebarPinned(!isSidebarPinned)}
              title={isSidebarPinned ? "Unpin sidebar (auto-collapse)" : "Pin sidebar open"}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              {isSidebarPinned ? (
                <PinOff className="w-3.5 h-3.5 text-[#5D2A18]" />
              ) : (
                <Pin className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 py-4 px-2.5 space-y-6 overflow-y-auto overflow-x-hidden scrollbar-none">
          {/* Section: Intelligence Core */}
          <div className="space-y-1">
            {isSidebarExpanded && (
              <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block mb-1">
                Intelligence Core
              </span>
            )}

            {/* Nav Item: RAG Studio */}
            <button
              onClick={() => setActiveTab("rag")}
              title={!isSidebarExpanded ? "Policy RAG Studio" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                activeTab === "rag"
                  ? "bg-[#5D2A18] text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <Search
                className={`w-5 h-5 flex-shrink-0 transition-transform ${
                  activeTab === "rag" ? "text-white" : "text-stone-500 group-hover:scale-110"
                }`}
              />
              <div
                className={`flex-1 text-left whitespace-nowrap transition-all duration-200 flex items-center justify-between ${
                  isSidebarExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                }`}
              >
                <span>Policy RAG Studio</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    activeTab === "rag"
                      ? "bg-white/20 text-white"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  Live
                </span>
              </div>
            </button>

            {/* Nav Item: Ingestion Architecture */}
            <button
              onClick={() => setActiveTab("pipeline")}
              title={!isSidebarExpanded ? "Ingestion Architecture (15 Steps)" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                activeTab === "pipeline"
                  ? "bg-[#5D2A18] text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <Workflow
                className={`w-5 h-5 flex-shrink-0 transition-transform ${
                  activeTab === "pipeline" ? "text-white" : "text-stone-500 group-hover:scale-110"
                }`}
              />
              <div
                className={`flex-1 text-left whitespace-nowrap transition-all duration-200 flex items-center justify-between ${
                  isSidebarExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                }`}
              >
                <span>Ingestion Workflow</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    activeTab === "pipeline" ? "bg-white/20 text-white" : "bg-stone-200 text-stone-700"
                  }`}
                >
                  15 Steps
                </span>
              </div>
            </button>
          </div>

          {/* Section: Repositories & Tools */}
          <div className="space-y-1">
            {isSidebarExpanded && (
              <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block mb-1">
                Data & Utilities
              </span>
            )}

            {/* Nav Item: Document Registry */}
            <button
              onClick={() => setActiveTab("registry")}
              title={!isSidebarExpanded ? "Document Registry" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                activeTab === "registry"
                  ? "bg-[#5D2A18] text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <Database
                className={`w-5 h-5 flex-shrink-0 transition-transform ${
                  activeTab === "registry" ? "text-white" : "text-stone-500 group-hover:scale-110"
                }`}
              />
              <div
                className={`flex-1 text-left whitespace-nowrap transition-all duration-200 flex items-center justify-between ${
                  isSidebarExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                }`}
              >
                <span>Document Registry</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    activeTab === "registry" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500"
                  }`}
                >
                  Postgres
                </span>
              </div>
            </button>

            {/* Nav Item: Diff Engine */}
            <button
              onClick={() => setActiveTab("compare")}
              title={!isSidebarExpanded ? "Diff Engine (Compare)" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                activeTab === "compare"
                  ? "bg-[#5D2A18] text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <ArrowLeftRight
                className={`w-5 h-5 flex-shrink-0 transition-transform ${
                  activeTab === "compare" ? "text-white" : "text-stone-500 group-hover:scale-110"
                }`}
              />
              <div
                className={`flex-1 text-left whitespace-nowrap transition-all duration-200 flex items-center justify-between ${
                  isSidebarExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                }`}
              >
                <span>Compare Engine</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    activeTab === "compare" ? "bg-white/20 text-white" : "bg-stone-100 text-stone-500"
                  }`}
                >
                  Diff
                </span>
              </div>
            </button>
          </div>

          {/* Quick Action: Pipeline Simulation */}
          <div className="pt-2">
            <button
              onClick={runPipelineSimulation}
              disabled={simulating}
              title={!isSidebarExpanded ? "Run Ingestion Simulation" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-[#5D2A18] border border-amber-200/80 transition-all cursor-pointer disabled:opacity-50 ${
                !isSidebarExpanded ? "justify-center" : ""
              }`}
            >
              <Play className={`w-4 h-4 flex-shrink-0 ${simulating ? "animate-spin" : ""}`} />
              <div
                className={`flex-1 text-left whitespace-nowrap transition-all duration-200 ${
                  isSidebarExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                }`}
              >
                <span>{simulating ? "Simulating..." : "Simulate Pipeline"}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Bottom User Card / Telemetry & Logout */}
        <div className="p-3 border-t border-stone-100 bg-[#FAF8F5]/60 flex flex-col gap-2 overflow-hidden">
          {/* Active Qdrant Indicator */}
          <div
            className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/60 text-[10.5px] font-bold text-emerald-800 transition-all duration-200 ${
              isSidebarExpanded ? "opacity-100" : "justify-center px-0 bg-transparent border-transparent"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            {isSidebarExpanded && (
              <span className="truncate">Qdrant Vectors: 142.8k</span>
            )}
          </div>

          {/* User Row */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-[#5D2A18] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs">
                {user?.fullName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <div
                className={`transition-all duration-200 flex flex-col overflow-hidden whitespace-nowrap ${
                  isSidebarExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"
                }`}
              >
                <span className="text-xs font-bold text-stone-900 truncate">
                  {user?.fullName || user?.email?.split("@")[0]}
                </span>
                <span className="text-[10px] text-stone-400 font-mono truncate max-w-[120px]">
                  {user?.email}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out md:ml-[72px] flex flex-col min-h-screen ${
          isSidebarPinned ? "md:ml-64" : ""
        }`}
      >
        {/* Top Header */}
        <header className="w-full bg-white border-b border-stone-200/90 sticky top-0 z-40 hidden md:block">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-extrabold text-lg text-stone-900 capitalize tracking-tight flex items-center gap-2">
                {activeTab === "rag" && (
                  <>
                    <Sparkles className="w-4 h-4 text-[#8C4A32]" />
                    <span>Policy RAG Query Studio</span>
                  </>
                )}
                {activeTab === "pipeline" && (
                  <>
                    <Workflow className="w-4 h-4 text-[#8C4A32]" />
                    <span>Sovereign Document Ingestion Architecture (15 Steps)</span>
                  </>
                )}
                {activeTab === "registry" && (
                  <>
                    <Database className="w-4 h-4 text-[#8C4A32]" />
                    <span>Document Registry & MinIO/S3 Catalog</span>
                  </>
                )}
                {activeTab === "compare" && (
                  <>
                    <ArrowLeftRight className="w-4 h-4 text-[#8C4A32]" />
                    <span>Regulatory Diff Engine</span>
                  </>
                )}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF8F5] border border-stone-200 text-xs font-semibold text-stone-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>eGazette Sync: Active</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* TAB 1: POLICY RAG SEARCH */}
          {activeTab === "rag" && (
            <div className="space-y-6">
              {/* Top Search Banner */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
                <div className="max-w-3xl">
                  <span className="text-[11px] font-bold tracking-[0.2em] text-[#8C4A32] uppercase block mb-1">
                    READY FOR RAG • Qdrant Vector Engine
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                    Sovereign Document Intelligence Workspace
                  </h1>
                  <p className="text-stone-600 text-xs sm:text-sm mt-1.5 leading-relaxed">
                    Query gazettes, circulars, and notifications verified from official portals. Answers are synthesized directly from indexed chunks with exact clause grounding.
                  </p>
                </div>

                {/* RAG Search Form */}
                <form onSubmit={handleRagSearch} className="mt-6 flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="e.g. What are the TDS provisions for software remittances under CBDT 2025 circular?"
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-stone-300 bg-[#FAF8F5]/40 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#5D2A18]/20 focus:border-[#5D2A18] focus:bg-white transition-all shadow-sm"
                    />
                  </div>

                  <select
                    value={selectedMinistry}
                    onChange={(e) => setSelectedMinistry(e.target.value)}
                    className="px-4 py-3.5 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#5D2A18]/20 focus:border-[#5D2A18]"
                  >
                    <option>All Ministries</option>
                    <option>Ministry of Finance</option>
                    <option>Ministry of Education</option>
                    <option>Ministry of Health</option>
                    <option>Ministry of Rural Development</option>
                    <option>NITI Aayog</option>
                  </select>

                  <button
                    type="submit"
                    disabled={searching}
                    className="px-6 py-3.5 bg-[#5D2A18] hover:bg-[#431D10] text-white rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 flex-shrink-0"
                  >
                    {searching ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Retrieving...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Ask Pramaan RAG</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Sample Quick Questions */}
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-stone-500">Quick queries:</span>
                  {[
                    "What is the eligibility for PMAY-G Phase III subsidy?",
                    "Summarize UGC Multidisciplinary Credit Framework 2025",
                    "Ayushman Digital interoperability standards timeline",
                    "Cross-border software remittance Form 15CA e-verification",
                  ].map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQuery(sample);
                        handleRagSearch(undefined, sample);
                      }}
                      className="px-3 py-1 bg-stone-100 hover:bg-[#EAE4DC] text-stone-700 rounded-full text-[11.5px] transition-colors border border-stone-200 cursor-pointer"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results Section */}
              {searchResult && (
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/90 shadow-sm space-y-6 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <h2 className="text-lg font-bold text-stone-900">Synthesized Answer & Citations</h2>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                      <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold">
                        Confidence: {(searchResult.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="font-mono text-stone-400">Qdrant HNSW Score: 0.982</span>
                    </div>
                  </div>

                  {/* AI Summary Text */}
                  <div className="bg-[#FAF8F5] p-5 rounded-xl border border-stone-200 text-stone-800 text-sm leading-relaxed">
                    {searchResult.answer}
                  </div>

                  {/* Direct Citations from Vector Store */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Exact Source Citations & Clauses (RAG Grounding)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {searchResult.citations.map((cite, idx) => (
                        <div key={idx} className="p-4 rounded-xl border border-stone-200 bg-white space-y-2.5 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-bold">
                                {cite.clause}
                              </span>
                              <span className="text-[11px] text-stone-400 font-medium">
                                Page {cite.page}
                              </span>
                            </div>
                            <p className="text-xs text-stone-700 italic font-serif bg-stone-50 p-3 rounded border border-stone-100 leading-relaxed">
                              &quot;{cite.text}&quot;
                            </p>
                          </div>
                          <div className="text-[11px] text-stone-500 font-medium flex items-center justify-between pt-2 border-t border-stone-100">
                            <span className="truncate max-w-[150px]">{cite.source}</span>
                            <a
                              href="https://egazette.gov.in"
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#5D2A18] hover:underline flex items-center gap-1 flex-shrink-0 font-semibold"
                            >
                              <span>Verify PDF</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INGESTION PIPELINE (From the architecture picture) */}
          {activeTab === "pipeline" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/90 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-6">
                  <div>
                    <span className="text-[11px] font-bold tracking-[0.2em] text-[#8C4A32] uppercase block mb-1">
                      End-to-End Sovereign Architecture
                    </span>
                    <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">
                      The Complete Document Ingestion Workflow
                    </h2>
                    <p className="text-stone-600 text-xs sm:text-sm mt-1 leading-relaxed">
                      Visual representation of all 15 stages from Government Portal Discovery to Qdrant Multilingual RAG indexing.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={runPipelineSimulation}
                    disabled={simulating}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#5D2A18] hover:bg-[#431D10] text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-70 self-start sm:self-auto"
                  >
                    <Play className={`w-3.5 h-3.5 ${simulating ? "animate-spin" : ""}`} />
                    <span>{simulating ? "Processing Stream..." : "Simulate Ingestion Run"}</span>
                  </button>
                </div>

                {/* Visual Interactive Pipeline Diagram */}
                <div className="mt-8 max-w-2xl mx-auto flex flex-col items-center space-y-3">
                  {sovereignWorkflowNodes.map((node, idx) => {
                    const isActive = activeStepIndex === idx;
                    const isPassed = activeStepIndex > idx || (!simulating && activeStepIndex === -1);

                    // Branching node for OCR vs Text PDF
                    if (node.id === "7") {
                      return (
                        <React.Fragment key={node.id}>
                          {/* Parent Text Extraction box */}
                          <div
                            className={`w-full p-4 rounded-xl border transition-all text-center ${
                              isActive
                                ? "bg-amber-50 border-[#5D2A18] ring-2 ring-[#5D2A18]/20 shadow-md"
                                : "bg-[#FAF8F5] border-stone-200"
                            }`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-mono text-xs font-bold text-stone-400">07</span>
                              <h4 className="text-sm font-bold text-stone-900">Text Extraction</h4>
                            </div>
                            <p className="text-xs text-stone-500 mt-0.5">Dual-mode extraction based on document format</p>
                          </div>

                          {/* Down arrow */}
                          <ArrowDown className="w-4 h-4 text-stone-400 animate-bounce" />

                          {/* Dual Branch Cards */}
                          <div className="w-full grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl border border-stone-200 bg-white text-center shadow-xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                                Path A • Native Digital
                              </span>
                              <h5 className="text-xs font-bold text-stone-900">Text PDF</h5>
                              <p className="text-[11px] text-stone-500 mt-1">Direct layout & text stream parsing</p>
                            </div>

                            <div className="p-4 rounded-xl border border-[#5D2A18]/30 bg-[#FAF8F5] text-center shadow-xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C4A32] block mb-1">
                                Path B • Physical Gazette
                              </span>
                              <h5 className="text-xs font-bold text-stone-900">Scanned PDF → OCR</h5>
                              <p className="text-[11px] text-stone-500 mt-1">Indic OCR (LayoutLMv3 & Tesseract)</p>
                            </div>
                          </div>

                          <ArrowDown className="w-4 h-4 text-stone-400" />
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={node.id}>
                        <div
                          className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                            isActive
                              ? "bg-amber-50 border-[#5D2A18] ring-2 ring-[#5D2A18]/20 shadow-md scale-[1.01]"
                              : isPassed
                              ? "bg-white border-stone-200 hover:border-stone-300 shadow-xs"
                              : "bg-[#FAF8F5] border-stone-200 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 transition-colors ${
                                isActive
                                ? "bg-[#5D2A18] text-white animate-pulse"
                                : isPassed
                                ? "bg-[#5D2A18] text-white"
                                : "bg-stone-200 text-stone-600"
                              }`}
                            >
                              {String(idx + 1).padStart(2, "0")}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-stone-900">
                                  {node.title}
                                </h4>
                                {node.type === "target" && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 uppercase">
                                    RAG Target
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-stone-500 mt-0.5">
                                {node.subtitle}
                              </p>
                            </div>
                          </div>

                          <div className="hidden sm:flex items-center gap-3 text-right">
                            <span className="text-[11px] font-mono text-stone-500 bg-stone-50 px-2 py-0.5 rounded border border-stone-100">
                              {node.details}
                            </span>
                            <span className="text-[11px] font-mono text-stone-400">
                              {node.latency}
                            </span>
                          </div>
                        </div>

                        {/* Connecting down arrow unless it's the last node */}
                        {idx < sovereignWorkflowNodes.length - 1 && (
                          <ArrowDown className="w-3.5 h-3.5 text-stone-300" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DOCUMENT REGISTRY */}
          {activeTab === "registry" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/90 shadow-sm">
                <span className="text-[11px] font-bold tracking-[0.2em] text-[#8C4A32] uppercase block mb-1">
                  PostgreSQL + MinIO/S3 Repository
                </span>
                <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">
                  Discovered Gazette Registry
                </h2>
                <p className="text-stone-600 text-xs sm:text-sm mt-1 leading-relaxed">
                  Live catalog of public gazettes crawled, stored in MinIO/S3, chunked, and synchronized into Qdrant.
                </p>

                <div className="mt-6 space-y-3">
                  {[
                    {
                      title: "Direct Tax TDS Provisions & Cross-Border Tech Remittance",
                      ministry: "Ministry of Finance",
                      gazette: "CBDT/2025/CIR-04",
                      date: "03 Mar 2025",
                      pages: 6,
                      format: "Native Text PDF",
                      chunks: 48,
                      qdrantVectors: 48,
                      lang: "EN / HI",
                    },
                    {
                      title: "Ayushman Bharat Digital Mission Interoperability Standards",
                      ministry: "Ministry of Health",
                      gazette: "ABDM/GO-88/2025",
                      date: "21 Feb 2025",
                      pages: 12,
                      format: "Scanned PDF (OCR)",
                      chunks: 92,
                      qdrantVectors: 92,
                      lang: "EN",
                    },
                    {
                      title: "National Education Policy Credit Framework Guidelines",
                      ministry: "Ministry of Education",
                      gazette: "UGC/NEP-CF/2025-01",
                      date: "12 Jan 2025",
                      pages: 18,
                      format: "Native Text PDF",
                      chunks: 134,
                      qdrantVectors: 134,
                      lang: "EN / HI",
                    },
                    {
                      title: "PMAY-G Phase III Allocation and Direct Benefit Transfer Norms",
                      ministry: "Ministry of Rural Development",
                      gazette: "MORD/PMAYG/III/2024",
                      date: "18 Nov 2024",
                      pages: 8,
                      format: "Scanned PDF (OCR)",
                      chunks: 64,
                      qdrantVectors: 64,
                      lang: "HI / EN",
                    },
                  ].map((doc, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-stone-200 bg-[#FAF8F5] hover:bg-white hover:border-[#5D2A18]/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-mono text-stone-400 bg-white px-2 py-0.5 rounded border border-stone-200">
                            {doc.gazette}
                          </span>
                          <span className="text-[11px] font-bold text-[#8C4A32]">{doc.format}</span>
                          <span className="text-[10px] font-mono text-stone-400">• {doc.lang}</span>
                        </div>
                        <h4 className="text-sm font-bold text-stone-900 group-hover:text-[#5D2A18] transition-colors">
                          {doc.title}
                        </h4>
                        <span className="text-xs text-stone-500">{doc.ministry} • Issued {doc.date} • {doc.pages} pages</span>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-center">
                        <div className="text-right">
                          <span className="text-xs font-bold text-stone-900 block">{doc.chunks} Chunks</span>
                          <span className="text-[10px] font-mono text-emerald-600">Qdrant Indexed</span>
                        </div>
                        <a
                          href="https://egazette.gov.in"
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-white border border-stone-200 hover:bg-[#FAF8F5] text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
                          title="Download Original S3 PDF"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: COMPARE ENGINE */}
          {activeTab === "compare" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200/90 shadow-sm">
                <span className="text-[11px] font-bold tracking-[0.2em] text-[#8C4A32] uppercase block mb-1">
                  Multi-Version Diff Engine
                </span>
                <h2 className="text-2xl font-extrabold text-stone-900 tracking-tight">
                  Compare Circulars & Regulatory Revisions
                </h2>
                <p className="text-stone-600 text-xs sm:text-sm mt-1.5 leading-relaxed">
                  Analyze statutory changes, revised compliance thresholds, and substituted rules across historical versions.
                </p>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-stone-200 bg-[#FAF8F5]">
                    <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1">
                      Document A (Base)
                    </span>
                    <input
                      type="text"
                      value={compareDocA}
                      onChange={(e) => setCompareDocA(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-900"
                    />
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg space-y-1">
                      <strong>Previous Rule:</strong>
                      <p className="line-through">Physical submission of certified copies required within 30 days of filing.</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-[#5D2A18]/40 bg-[#FAF8F5]">
                    <span className="text-xs font-bold text-[#5D2A18] uppercase tracking-wider block mb-1">
                      Document B (Revised)
                    </span>
                    <input
                      type="text"
                      value={compareDocB}
                      onChange={(e) => setCompareDocB(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#5D2A18]/40 bg-white text-xs font-medium text-stone-900"
                    />
                    <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg space-y-1">
                      <strong>Updated Rule:</strong>
                      <p>100% paperless e-verification via DigiLocker API integration.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="w-full py-4 text-center text-xs text-stone-400 border-t border-stone-200/60 bg-white mt-auto">
          © Pramaan • Built for a more informed India • Qdrant Multilingual RAG Pipeline
        </footer>
      </div>
    </div>
  );
}
