"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X, User, LogOut, LayoutDashboard } from "lucide-react";
import { PillarLogoIcon } from "./EmblemIcon";
import { getClientSession, clearClientSession, UserSession } from "@/lib/authSession";
import { supabase } from "@/lib/supabaseClient";

interface NavbarProps {
  onOpenGetStarted?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function Navbar({
  onOpenGetStarted,
  activeTab = "Home",
  onTabChange,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<UserSession | null>(null);

  useEffect(() => {
    // Check custom Resend auth session
    const syncUser = () => {
      const session = getClientSession();
      if (session) {
        setUser(session);
      } else {
        supabase.auth.getUser().then(({ data }) => {
          if (data?.user?.email) {
            setUser({ email: data.user.email, isVerified: true });
          } else {
            setUser(null);
          }
        });
      }
    };

    syncUser();

    window.addEventListener("policylens_auth_change", syncUser);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUser({ email: session.user.email, isVerified: true });
      }
    });

    return () => {
      window.removeEventListener("policylens_auth_change", syncUser);
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    clearClientSession();
    await supabase.auth.signOut();
    setUser(null);
  };

  const navItems = ["Home", "Documents", "Compare", "About"];

  const handleNavClick = (tab: string) => {
    if (onTabChange) {
      onTabChange(tab);
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="w-full bg-[#FAF8F5]/90 backdrop-blur-md sticky top-0 z-40 border-b border-stone-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Left: Brand + Tagline */}
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            onClick={() => handleNavClick("Home")}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <div className="p-1 rounded-md transition-transform group-hover:scale-105">
              <PillarLogoIcon className="w-7 h-7 text-[#1E1A17]" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-[#1E1A17]">
              Pramaan
            </span>
          </Link>

          {/* Divider */}
          <div className="hidden sm:block h-5 w-[1px] bg-stone-300 mx-1" />

          {/* Subtitle */}
          <span className="hidden sm:inline-block text-xs md:text-sm text-stone-500 font-normal tracking-tight">
            Government Documents. Clearer Insights.
          </span>
        </div>

        {/* Center/Right Nav links for Desktop */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = activeTab === item;
            return (
              <button
                key={item}
                onClick={() => handleNavClick(item)}
                className={`relative py-1 transition-colors cursor-pointer ${
                  isActive
                    ? "text-[#1E1A17] font-semibold"
                    : "text-stone-600 hover:text-stone-900 font-medium"
                }`}
              >
                {item}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#5D2A18] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Auth / CTA Area */}
        <div className="hidden sm:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-[#5D2A18] hover:bg-[#461F11] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all duration-150 active:scale-95"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Open Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-2 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-stone-700 hover:text-[#5D2A18] text-sm font-semibold transition-colors px-2 py-1"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-[#5D2A18] hover:bg-[#461F11] text-white text-sm font-medium px-5 py-2.5 rounded-lg shadow-sm hover:shadow transition-all duration-150 active:scale-95 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-stone-700 hover:bg-stone-200/50"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-stone-200 bg-[#FAF8F5] px-4 pt-2 pb-6 space-y-3">
          <div className="flex flex-col space-y-2">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => handleNavClick(item)}
                className={`text-left px-3 py-2 rounded-md text-base ${
                  activeTab === item
                    ? "bg-[#5D2A18]/10 text-[#5D2A18] font-semibold"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-stone-200/80 space-y-2">
            {user ? (
              <div className="space-y-2">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 bg-[#5D2A18] text-white py-2.5 px-4 rounded-lg font-medium text-sm"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Open Workspace</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full py-2 text-xs text-red-700 font-semibold text-center"
                >
                  Sign Out ({user.email})
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center py-2.5 rounded-lg border border-stone-300 text-stone-800 font-medium text-sm"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 bg-[#5D2A18] text-white py-2.5 px-4 rounded-lg font-medium text-sm"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
