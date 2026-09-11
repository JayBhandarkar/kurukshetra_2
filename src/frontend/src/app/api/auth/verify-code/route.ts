import { NextResponse } from "next/server";
import { getStoredVerification, clearStoredVerification } from "../send-verification/route";
import { supabase } from "@/lib/supabaseClient";

// In-memory verified accounts set
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

    // 1. Check in-memory store
    const stored = getStoredVerification(cleanEmail);
    if (stored) {
      if (Date.now() > stored.expiresAt) {
        return NextResponse.json(
          { error: "Verification code has expired. Please request a new code." },
          { status: 400 }
        );
      }
      if (stored.code === cleanCode) {
        isValid = true;
        clearStoredVerification(cleanEmail);
      }
    }

    // 2. Check Supabase table if stored check didn't pass
    if (!isValid) {
      try {
        const { data } = await supabase
          .from("verification_codes")
          .select("*")
          .eq("email", cleanEmail)
          .eq("code", cleanCode)
          .single();

        if (data && new Date(data.expires_at).getTime() > Date.now()) {
          isValid = true;
          // Mark in database
          await supabase
            .from("verification_codes")
            .update({ is_verified: true })
            .eq("email", cleanEmail);
        }
      } catch (dbErr) {
        console.warn("DB check fallback warning:", dbErr);
      }
    }

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid verification code. Please check your email and try again." },
        { status: 400 }
      );
    }

    // Mark email as verified
    markEmailVerified(cleanEmail);

    // Fetch user details from signups table
    let userData = { email: cleanEmail, fullName: cleanEmail.split("@")[0] };
    try {
      const { data } = await supabase
        .from("signups")
        .select("email, full_name")
        .eq("email", cleanEmail)
        .single();
      if (data) {
        userData = { email: data.email, fullName: data.full_name || data.email.split("@")[0] };
      }
    } catch (e) {
      console.warn("Could not fetch user name:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Email successfully verified! Entering workspace...",
      user: userData,
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    console.error("Verification code error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
