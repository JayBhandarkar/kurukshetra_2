import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabaseClient";
import { isEmailVerified } from "../verify-code/route";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Fetch user record from unified 'signups' table
    let userRecord: {
      id: string;
      email: string;
      full_name: string;
      password_hash: string;
      is_verified: boolean;
      primary_domain?: string;
      role?: string;
      subscribed_authorities?: string[];
      onboarding_completed?: boolean;
    } | null = null;
    try {
      const { data } = await supabase
        .from("signups")
        .select("id, email, full_name, password_hash, is_verified, primary_domain, role, subscribed_authorities, onboarding_completed")
        .eq("email", cleanEmail)
        .maybeSingle();

      userRecord = data;
    } catch (dbErr) {
      console.warn("DB fetch notice:", dbErr);
    }

    if (!userRecord) {
      return NextResponse.json(
        { error: "No account found with this email. Please create an account first." },
        { status: 404 }
      );
    }

    // 2. Check if user is verified
    const isVerified =
      userRecord.is_verified === true || isEmailVerified(cleanEmail);

    if (!isVerified) {
      return NextResponse.json(
        {
          error:
            "Your email has not been verified yet. Please enter the 6-digit verification code sent to your inbox.",
          unverified: true,
          email: cleanEmail,
        },
        { status: 403 }
      );
    }

    // 3. Verify password hash
    if (userRecord.password_hash) {
      const passwordMatch = await bcrypt.compare(
        password,
        userRecord.password_hash
      );
      if (!passwordMatch) {
        return NextResponse.json(
          { error: "Incorrect password. Please check your credentials." },
          { status: 401 }
        );
      }
    }

    // 4. Fetch secondary user profile preferences if available
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

    const primaryDomain = userRecord.primary_domain || profileData?.primary_domain || "Banking, Finance & Tax";
    const role = userRecord.role || profileData?.role || "Legal Counsel / Advocate";
    const subscribedAuthorities = userRecord.subscribed_authorities || profileData?.subscribed_authorities || [
      "Reserve Bank of India (RBI)",
      "Securities and Exchange Board of India (SEBI)",
      "Central Board of Direct Taxes (CBDT)",
      "Ministry of Finance",
    ];
    const onboardingCompleted =
      userRecord.onboarding_completed !== undefined
        ? Boolean(userRecord.onboarding_completed)
        : profileData
        ? Boolean(profileData.onboarding_completed)
        : false;

    return NextResponse.json({
      success: true,
      user: {
        email: cleanEmail,
        fullName: userRecord.full_name || profileData?.full_name || cleanEmail.split("@")[0],
        role,
        primaryDomain,
        subscribedAuthorities,
        onboardingCompleted,
        isVerified: true,
      },
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    console.error("Login error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
