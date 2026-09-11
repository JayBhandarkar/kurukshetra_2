"use client";

import React, { useState } from "react";
import { CheckCircle2, ChevronRight, ChevronLeft, ArrowRight } from "lucide-react";
import { PillarLogoIcon } from "./EmblemIcon";

export interface OnboardingPreferences {
  primaryDomain: string;
  role: string;
  subscribedAuthorities: string[];
}

interface OnboardingChecklistModalProps {
  userEmail: string;
  userFullName?: string;
  initialDomain?: string;
  initialRole?: string;
  initialAuthorities?: string[];
  onComplete: (prefs: OnboardingPreferences) => void;
  onCancel?: () => void;
}

const DOMAIN_OPTIONS = [
  {
    id: "Banking, Finance & Tax",
    title: "Banking, Finance & Tax",
    desc: "RBI circulars, SEBI, CBDT direct tax amendments, FEMA, and customs rules.",
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
    desc: "Companies Act, MCA notifications, IBBI insolvency regulations, and CCI mandates.",
    defaultAuthorities: [
      "Ministry of Corporate Affairs (MCA)",
      "Insolvency and Bankruptcy Board of India (IBBI)",
      "Competition Commission of India (CCI)",
    ],
  },
  {
    id: "Tech, AI & Data Protection",
    title: "Tech, AI & Data Protection",
    desc: "DPDP Act 2023, CERT-In directions, MeitY AI guidelines, and TRAI orders.",
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
    desc: "NEP 2020 framework, UGC credit rules, AICTE handbooks, and NRF grants.",
    defaultAuthorities: [
      "Ministry of Education",
      "University Grants Commission (UGC)",
      "All India Council for Technical Education (AICTE)",
    ],
  },
  {
    id: "Environment, Energy & Infra",
    title: "Environment, Energy & Infra",
    desc: "MoEFCC clearances, EPR norms, CEA renewable targets, and NHAI gazettes.",
    defaultAuthorities: [
      "Ministry of Environment, Forest & Climate Change (MoEFCC)",
      "Central Pollution Control Board (CPCB)",
      "Ministry of Power & Renewable Energy",
    ],
  },
  {
    id: "General Sovereign Administration",
    title: "General Administration",
    desc: "Cabinet Secretariat, DoPT service rules, Home Affairs orders, and legislative gazettes.",
    defaultAuthorities: [
      "Cabinet Secretariat (CabSec)",
      "Department of Personnel and Training (DoPT)",
      "Parliament Legislative Department",
    ],
  },
];

const ROLE_OPTIONS = [
  { id: "Legal Counsel / Advocate",               title: "Legal Counsel / Advocate",             desc: "Litigation, statutory interpretation, and case research." },
  { id: "Chief Compliance Officer (CCO) / Auditor", title: "Compliance Officer / Auditor",         desc: "Regulatory adherence, penalty monitoring, and corporate audits." },
  { id: "Policy Analyst / Think Tank Researcher", title: "Policy Analyst / Researcher",           desc: "Policy evaluation, draft bill reviews, and statutory lineage." },
  { id: "Corporate Executive / Founder",          title: "Corporate Executive / Founder",         desc: "Business impact analysis, FDI compliance, and governance." },
  { id: "Civil Servant / Public Officer",         title: "Civil Servant / Public Officer",        desc: "Official Gazette drafting and departmental compliance." },
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
  initialDomain,
  initialRole,
  initialAuthorities,
  onComplete,
  onCancel,
}: OnboardingChecklistModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [prevStep, setPrevStep] = useState<1 | 2 | 3>(1);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [selectedDomain, setSelectedDomain] = useState(initialDomain || "Banking, Finance & Tax");
  const [selectedRole, setSelectedRole] = useState(initialRole || "Legal Counsel / Advocate");
  const [selectedAuthorities, setSelectedAuthorities] = useState<string[]>(
    initialAuthorities && initialAuthorities.length > 0
      ? initialAuthorities
      : [
          "Reserve Bank of India (RBI)",
          "Securities and Exchange Board of India (SEBI)",
          "Central Board of Direct Taxes (CBDT)",
          "Ministry of Finance",
        ]
  );
  const [saving, setSaving] = useState(false);

  const goToStep = (next: 1 | 2 | 3) => {
    if (animating) return;
    setDirection(next > step ? "forward" : "back");
    setPrevStep(step);
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 260);
  };

  const handleDomainSelect = (domainId: string) => {
    setSelectedDomain(domainId);
    const domain = DOMAIN_OPTIONS.find((d) => d.id === domainId);
    if (domain) setSelectedAuthorities(domain.defaultAuthorities);
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
      console.warn("Could not save profile:", e);
    } finally {
      setSaving(false);
      onComplete({ primaryDomain: selectedDomain, role: selectedRole, subscribedAuthorities: selectedAuthorities });
    }
  };

  const stepLabels = ["Domain", "Role", "Authorities"];

  // Slide animation classes
  const slideOut = direction === "forward" ? "-translate-x-full opacity-0" : "translate-x-full opacity-0";
  const slideIn  = direction === "forward" ? "translate-x-full opacity-0" : "-translate-x-full opacity-0";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-[#FAF8F5] border border-[#E8E2D8] rounded-2xl shadow-2xl flex flex-col" style={{height: "580px"}}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#E8E2D8]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#5D2A18] flex items-center justify-center">
                <PillarLogoIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-[#1E1A17] tracking-tight">Welcome to Pramaan</h2>
                <p className="text-[11px] text-stone-400 mt-0.5">Personalise your document intelligence in 3 steps</p>
              </div>
            </div>

            {/* Step dots */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`rounded-full transition-all ${
                      step === s
                        ? "w-5 h-2 bg-[#5D2A18]"
                        : step > s
                        ? "w-2 h-2 bg-[#5D2A18]/40"
                        : "w-2 h-2 bg-[#E8E2D8]"
                    }`}
                  />
                ))}
              </div>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="ml-1 p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-[#F3EDE4] transition-colors"
                  title="Close"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Step label */}
          <p className="text-[11px] font-medium text-stone-400 mt-3 uppercase tracking-wider">
            Step {step} of 3 — {stepLabels[step - 1]}
          </p>
        </div>

        {/* Body — fixed height, overflow hidden, slide animation */}
        <div className="flex-1 overflow-hidden relative">
          <div
            key={step}
            className={`absolute inset-0 px-6 py-4 overflow-y-auto space-y-2.5 transition-all duration-[260ms] ease-in-out ${
              animating ? slideOut : "translate-x-0 opacity-100"
            }`}
            style={{ willChange: "transform, opacity" }}
          >

          {/* STEP 1: Domain */}
          {step === 1 && (
            <>
              <p className="text-[12px] text-stone-500 mb-3">Select the sector you work in most. Pramaan will prioritise relevant notifications for you.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DOMAIN_OPTIONS.map((domain) => {
                  const isSelected = selectedDomain === domain.id;
                  return (
                    <button
                      key={domain.id}
                      type="button"
                      onClick={() => handleDomainSelect(domain.id)}
                      className={`p-3.5 rounded-xl text-left transition-all border ${
                        isSelected
                          ? "bg-[#F3EDE4] border-[#5D2A18]/40 ring-1 ring-[#5D2A18]/30"
                          : "bg-white border-[#E8E2D8] hover:border-[#C8B8A2] hover:bg-[#FAF8F5]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-[12px] font-semibold leading-snug ${isSelected ? "text-[#5D2A18]" : "text-stone-700"}`}>
                          {domain.title}
                        </h4>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#5D2A18] flex-shrink-0 mt-0.5" />}
                      </div>
                      <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">{domain.desc}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 2: Role */}
          {step === 2 && (
            <>
              <p className="text-[12px] text-stone-500 mb-3">Select your professional role so Pramaan can tailor explanation depth and citation style.</p>
              <div className="space-y-2">
                {ROLE_OPTIONS.map((r) => {
                  const isSelected = selectedRole === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRole(r.id)}
                      className={`w-full p-3.5 rounded-xl text-left transition-all border flex items-center justify-between ${
                        isSelected
                          ? "bg-[#F3EDE4] border-[#5D2A18]/40 ring-1 ring-[#5D2A18]/30"
                          : "bg-white border-[#E8E2D8] hover:border-[#C8B8A2] hover:bg-[#FAF8F5]"
                      }`}
                    >
                      <div>
                        <h4 className={`text-[12px] font-semibold ${isSelected ? "text-[#5D2A18]" : "text-stone-700"}`}>{r.title}</h4>
                        <p className="text-[11px] text-stone-400 mt-0.5">{r.desc}</p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#5D2A18] flex-shrink-0 ml-3" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 3: Authorities */}
          {step === 3 && (
            <>
              <p className="text-[12px] text-stone-500 mb-3">Select the government bodies most relevant to your work. You can change this anytime.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_AUTHORITIES.map((auth) => {
                  const isChecked = selectedAuthorities.includes(auth);
                  return (
                    <button
                      key={auth}
                      type="button"
                      onClick={() => toggleAuthority(auth)}
                      className={`p-3 rounded-xl text-left transition-all border flex items-center justify-between ${
                        isChecked
                          ? "bg-[#F3EDE4] border-[#5D2A18]/40 ring-1 ring-[#5D2A18]/30"
                          : "bg-white border-[#E8E2D8] hover:border-[#C8B8A2] hover:bg-[#FAF8F5]"
                      }`}
                    >
                      <span className={`text-[11px] font-medium pr-2 truncate ${isChecked ? "text-[#5D2A18]" : "text-stone-600"}`}>
                        {auth}
                      </span>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        isChecked ? "bg-[#5D2A18] border-[#5D2A18]" : "bg-white border-[#D5CCC0]"
                      }`}>
                        {isChecked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E8E2D8] bg-white flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => goToStep((step - 1) as 1 | 2)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium text-stone-500 hover:text-stone-800 hover:bg-[#F3EDE4] transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => goToStep((step + 1) as 2 | 3)}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[12px] font-semibold bg-[#5D2A18] hover:bg-[#7A3520] text-white transition-colors"
            >
              Continue <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || selectedAuthorities.length === 0}
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[12px] font-semibold bg-[#5D2A18] hover:bg-[#7A3520] text-white transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : <> Enter Pramaan <ArrowRight className="w-3.5 h-3.5" /> </>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
