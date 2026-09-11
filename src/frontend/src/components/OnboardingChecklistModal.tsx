"use client";

import React, { useState } from "react";
import {
  Shield,
  Building2,
  Scale,
  Cpu,
  GraduationCap,
  Leaf,
  Landmark,
  UserCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ArrowRight,
  Layers,
} from "lucide-react";
import { PillarLogoIcon } from "./EmblemIcon";

export interface OnboardingPreferences {
  primaryDomain: string;
  role: string;
  subscribedAuthorities: string[];
}

interface OnboardingChecklistModalProps {
  userEmail: string;
  userFullName?: string;
  initialRole?: string;
  onComplete: (prefs: OnboardingPreferences) => void;
}

const DOMAIN_OPTIONS = [
  {
    id: "Banking, Finance & Tax",
    title: "Banking, Finance & Tax",
    desc: "RBI circulars, SEBI LODR/BRSR, CBDT direct tax amendments, FEMA, and customs rules.",
    icon: Building2,
    badge: "Most Popular",
    defaultAuthorities: [
      "Reserve Bank of India (RBI)",
      "Securities and Exchange Board of India (SEBI)",
      "Central Board of Direct Taxes (CBDT)",
      "Ministry of Finance",
    ],
  },
  {
    id: "Corporate Law & Insolvency",
    title: "Corporate Law & Insolvency",
    desc: "Companies Act rules, MCA e-filing notifications, IBBI insolvency regulations, and CCI mandates.",
    icon: Scale,
    badge: "High Demand",
    defaultAuthorities: [
      "Ministry of Corporate Affairs (MCA)",
      "Insolvency and Bankruptcy Board of India (IBBI)",
      "Competition Commission of India (CCI)",
    ],
  },
  {
    id: "Tech, AI & Data Protection",
    title: "Tech, AI & Data Protection",
    desc: "DPDP Act 2023 rules, CERT-In cyber incident directions, MeitY AI guidelines, and TRAI telecom orders.",
    icon: Cpu,
    badge: "New 2024",
    defaultAuthorities: [
      "Ministry of Electronics & IT (MeitY)",
      "Data Protection Board of India (DPBI)",
      "Indian Computer Emergency Response Team (CERT-In)",
      "Telecom Regulatory Authority of India (TRAI)",
    ],
  },
  {
    id: "Education & Research",
    title: "Education & Research",
    desc: "NEP 2020 framework, UGC credit transfer rules, AICTE approval handbooks, and NRF grants.",
    icon: GraduationCap,
    badge: "Academic",
    defaultAuthorities: [
      "Ministry of Education",
      "University Grants Commission (UGC)",
      "All India Council for Technical Education (AICTE)",
    ],
  },
  {
    id: "Environment, Energy & Infra",
    title: "Environment, Energy & Infra",
    desc: "MoEFCC clearances, EPR plastic/e-waste norms, CEA renewable energy targets, and NHAI gazettes.",
    icon: Leaf,
    badge: "ESG Focus",
    defaultAuthorities: [
      "Ministry of Environment, Forest & Climate Change (MoEFCC)",
      "Central Pollution Control Board (CPPCB)",
      "Ministry of Power & Renewable Energy",
    ],
  },
  {
    id: "General Sovereign Administration",
    title: "General Sovereign Administration",
    desc: "Cabinet Secretariat, DoPT service rules, Home Affairs orders, and overarching legislative gazettes.",
    icon: Landmark,
    badge: "Universal",
    defaultAuthorities: [
      "Cabinet Secretariat (CabSec)",
      "Department of Personnel and Training (DoPT)",
      "Parliament Legislative Department",
    ],
  },
];

const ROLE_OPTIONS = [
  {
    id: "Legal Counsel / Advocate",
    title: "Legal Counsel / Advocate",
    desc: "Litigation, statutory interpretation, statutory diff comparison, and case research.",
    icon: Scale,
  },
  {
    id: "Chief Compliance Officer (CCO) / Auditor",
    title: "Chief Compliance Officer (CCO) / Auditor",
    desc: "Regulatory adherence, penalty monitoring, cross-border filing, and corporate audits.",
    icon: Shield,
  },
  {
    id: "Policy Analyst / Think Tank Researcher",
    title: "Policy Analyst / Think Tank Researcher",
    desc: "Government policy evaluation, draft bill reviews, and multi-year statutory lineage.",
    icon: Layers,
  },
  {
    id: "Corporate Executive / Founder",
    title: "Corporate Executive / Founder",
    desc: "Business impact analysis, FDI compliance, tax deductions, and governance.",
    icon: UserCheck,
  },
  {
    id: "Civil Servant / Public Officer",
    title: "Civil Servant / Public Sector Officer",
    desc: "Official Gazette drafting, administrative circulars, and departmental compliance.",
    icon: Landmark,
  },
];

const ALL_AUTHORITIES = [
  "Reserve Bank of India (RBI)",
  "Securities and Exchange Board of India (SEBI)",
  "Central Board of Direct Taxes (CBDT)",
  "Ministry of Finance",
  "Ministry of Corporate Affairs (MCA)",
  "Ministry of Electronics & IT (MeitY)",
  "Data Protection Board of India (DPBI)",
  "Indian Computer Emergency Response Team (CERT-In)",
  "Ministry of Education",
  "University Grants Commission (UGC)",
  "Ministry of Environment, Forest & Climate Change (MoEFCC)",
  "Insolvency and Bankruptcy Board of India (IBBI)",
  "Cabinet Secretariat (CabSec)",
];

export function OnboardingChecklistModal({
  userEmail,
  userFullName,
  initialRole,
  onComplete,
}: OnboardingChecklistModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDomain, setSelectedDomain] = useState<string>("Banking, Finance & Tax");
  const [selectedRole, setSelectedRole] = useState<string>(initialRole || "Legal Counsel / Advocate");
  const [selectedAuthorities, setSelectedAuthorities] = useState<string[]>([
    "Reserve Bank of India (RBI)",
    "Securities and Exchange Board of India (SEBI)",
    "Central Board of Direct Taxes (CBDT)",
    "Ministry of Finance",
  ]);
  const [saving, setSaving] = useState(false);

  const handleDomainSelect = (domainId: string) => {
    setSelectedDomain(domainId);
    const domainObj = DOMAIN_OPTIONS.find((d) => d.id === domainId);
    if (domainObj) {
      setSelectedAuthorities(domainObj.defaultAuthorities);
    }
  };

  const toggleAuthority = (auth: string) => {
    setSelectedAuthorities((prev) =>
      prev.includes(auth) ? prev.filter((a) => a !== auth) : [...prev, auth]
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    const rawName = userEmail.split("@")[0].replace(/[._]/g, " ");
    const defaultName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const payload = {
      email: userEmail,
      full_name: userFullName || defaultName,
      primary_domain: selectedDomain,
      role: selectedRole,
      subscribed_authorities: selectedAuthorities,
      onboarding_completed: true,
    };

    try {
      await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn("Could not save to remote API, applying locally:", e);
    } finally {
      setSaving(false);
      onComplete({
        primaryDomain: selectedDomain,
        role: selectedRole,
        subscribedAuthorities: selectedAuthorities,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#0f172a] to-[#090d16] border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-500" />

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <PillarLogoIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                  Welcome to Pramaan
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Domain Calibration
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calibrate your primary statutory intelligence funnel in 3 quick steps.
                </p>
              </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-7 h-7 rounded-full text-xs font-semibold flex items-center justify-center transition-all ${
                    step === s
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 scale-110"
                      : step > s
                      ? "bg-emerald-900/60 text-emerald-300 border border-emerald-500/40"
                      : "bg-slate-800 text-slate-500 border border-slate-700"
                  }`}
                >
                  {step > s ? <CheckCircle2 className="w-3.5 h-3.5" /> : s}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* STEP 1: Domain Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider text-xs">
                  Step 1 of 3: Primary Sector Focus
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Pramaan will prioritize sovereign documents in this domain while keeping the full national database available for global search.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {DOMAIN_OPTIONS.map((domain) => {
                  const Icon = domain.icon;
                  const isSelected = selectedDomain === domain.id;
                  return (
                    <button
                      key={domain.id}
                      type="button"
                      onClick={() => handleDomainSelect(domain.id)}
                      className={`p-3.5 rounded-xl text-left transition-all border relative flex flex-col justify-between ${
                        isSelected
                          ? "bg-emerald-950/40 border-emerald-400 shadow-md shadow-emerald-950/50 ring-1 ring-emerald-400"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              isSelected
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              isSelected
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {domain.badge}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-white">{domain.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {domain.desc}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 mt-2.5">
                          <CheckCircle2 className="w-3 h-3" /> Selected Priority Focus
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Role Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider text-xs">
                  Step 2 of 3: Your Professional Persona
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Customizes statutory explanation depth, statutory diff level, and citation styles.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                {ROLE_OPTIONS.map((r) => {
                  const Icon = r.icon;
                  const isSelected = selectedRole === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRole(r.id)}
                      className={`w-full p-3.5 rounded-xl text-left transition-all border flex items-center justify-between ${
                        isSelected
                          ? "bg-emerald-950/40 border-emerald-400 shadow-md ring-1 ring-emerald-400"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-white">{r.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">{r.desc}</p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "border-emerald-400 bg-emerald-500 text-slate-950"
                            : "border-slate-700 bg-slate-800"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Key Authorities & Confirmation */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider text-xs">
                  Step 3 of 3: Priority Regulatory Authorities
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Select the key government portals to prioritize in your live gazette intelligence feed.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {ALL_AUTHORITIES.map((auth) => {
                  const isChecked = selectedAuthorities.includes(auth);
                  return (
                    <button
                      key={auth}
                      type="button"
                      onClick={() => toggleAuthority(auth)}
                      className={`p-3 rounded-lg text-left transition-all border flex items-center justify-between text-xs ${
                        isChecked
                          ? "bg-emerald-950/30 border-emerald-500/60 text-emerald-200"
                          : "bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <span className="font-medium pr-2 truncate">{auth}</span>
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isChecked
                            ? "bg-emerald-500 border-emerald-400 text-slate-950"
                            : "border-slate-700 bg-slate-800"
                        }`}
                      >
                        {isChecked && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3 text-xs text-slate-300 mt-4">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>Global Fallback is Always Active:</strong> If a query references laws outside your selection, Pramaan automatically searches all 24+ ministries seamlessly.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as 1 | 2)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <div className="text-xs text-slate-500">Step 1 of 3</div>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
            >
              Continue <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || selectedAuthorities.length === 0}
              onClick={handleFinish}
              className="px-6 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                "Saving Preferences..."
              ) : (
                <>
                  Enter Platform <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
