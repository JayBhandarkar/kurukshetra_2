import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getStoredVerification, clearStoredVerification } from "../send-verification/route";
import { supabase } from "@/lib/supabaseClient";

// In-memory verified accounts cache
const verifiedEmails = new Set<string>();

export function isEmailVerified(email: string): boolean {
  return verifiedEmails.has(email.toLowerCase().trim());
}

export function markEmailVerified(email: string) {
  verifiedEmails.add(email.toLowerCase().trim());
}

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    let isValid = false;

    // 1. Check in-memory fallback store
    const stored = getStoredVerification(cleanEmail);
    if (stored) {
      if (Date.now() > stored.expiresAt) {
        return NextResponse.json(
          { error: "Verification code has expired. Please request a new code." },
          { status: 400 }
        );
      }
      const match = await bcrypt.compare(cleanCode, stored.codeHash);
      if (match) {
        isValid = true;
        clearStoredVerification(cleanEmail);
      }
    }

    // 2. Check Supabase 'signups' table with hashed code comparison
    if (!isValid) {
      try {
        const { data: userRecord } = await supabase
          .from("signups")
          .select("id, email, full_name, verification_code_hash, code_expires_at")
          .eq("email", cleanEmail)
          .maybeSingle();

        if (userRecord && userRecord.verification_code_hash) {
          const isExpired = userRecord.code_expires_at
            ? new Date(userRecord.code_expires_at).getTime() < Date.now()
            : false;

          if (isExpired) {
            return NextResponse.json(
              { error: "Verification code has expired. Please request a new code." },
              { status: 400 }
            );
          }

          const match = await bcrypt.compare(
            cleanCode,
            userRecord.verification_code_hash
          );

          if (match) {
            isValid = true;
          }
        }
      } catch (dbErr) {
        console.warn("DB verify fallback warning:", dbErr);
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code. Please check your email and try again." },
        { status: 400 }
      );
    }

    // Mark email as verified in memory cache
    markEmailVerified(cleanEmail);

    // 3. Update Supabase 'signups' table (Mark verified, clear active OTP hash)
    let userFullName = cleanEmail.split("@")[0];
    try {
      const { data: updated } = await supabase
        .from("signups")
        .update({
          is_verified: true,
          verification_code_hash: null,
          updated_at: new Date().toISOString(),
        })
        .eq("email", cleanEmail)
        .select("email, full_name")
        .maybeSingle();

      if (updated?.full_name) {
        userFullName = updated.full_name;
      }
    } catch (e) {
      console.warn("DB update notice:", e);
    }

    // 4. Fetch user profile data if available
    let profileData = null;
    try {
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();
      profileData = prof;
    } catch (profErr) {
      console.warn("user_profiles lookup notice:", profErr);
    }

    return NextResponse.json({
      success: true,
      message: "Email successfully verified! Entering workspace...",
      user: {
        email: cleanEmail,
        fullName: profileData?.full_name || userFullName,
        role: profileData?.role || "Policy Researcher / Legal",
        primaryDomain: profileData?.primary_domain || "Banking, Finance & Tax",
        subscribedAuthorities: profileData?.subscribed_authorities || [
          "Reserve Bank of India (RBI)",
          "Central Board of Direct Taxes (CBDT)",
          "Ministry of Finance",
        ],
        onboardingCompleted: profileData ? Boolean(profileData.onboarding_completed) : false,
        isVerified: true,
      },
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    console.error("Verification code error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
