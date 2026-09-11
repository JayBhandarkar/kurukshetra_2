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

    // 1. Fetch user record from database
    let userRecord = null;
    try {
      const { data } = await supabase
        .from("signups")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      userRecord = data;
    } catch (dbErr) {
      console.warn("DB fetch notice:", dbErr);
    }

    // 2. Check if user is verified
    const isVerified =
      userRecord?.is_verified === true || isEmailVerified(cleanEmail);

    if (!isVerified) {
      return NextResponse.json(
        {
          error:
            "Your email has not been verified yet. Please verify with the 6-digit code sent via Resend.",
          unverified: true,
          email: cleanEmail,
        },
        { status: 403 }
      );
    }

    // 3. Verify password if password hash is stored
    if (userRecord?.password_hash) {
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

    // 4. Fetch user profile preferences if available
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
      user: {
        email: cleanEmail,
        fullName: profileData?.full_name || userRecord?.full_name || cleanEmail.split("@")[0].title,
        role: profileData?.role || userRecord?.role || "Policy Researcher / Legal",
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
    console.error("Login error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
