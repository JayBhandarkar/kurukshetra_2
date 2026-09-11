import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// In-memory fallback cache to ensure zero breakage if database table is initializing
const profileMemoryCache: Record<string, any> = {};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // 1. Try fetching from Supabase signups table (single source of truth)
    try {
      const { data: signupUser, error: signupErr } = await supabase
        .from("signups")
        .select("email, full_name, primary_domain, role, subscribed_authorities, onboarding_completed")
        .eq("email", email)
        .maybeSingle();

      if (!signupErr && signupUser) {
        return NextResponse.json({
          success: true,
          profile: {
            email: signupUser.email,
            full_name: signupUser.full_name,
            primary_domain: signupUser.primary_domain || "Banking, Finance & Tax",
            role: signupUser.role || "Legal Counsel / Advocate",
            subscribed_authorities: signupUser.subscribed_authorities || [
              "Reserve Bank of India (RBI)",
              "Securities and Exchange Board of India (SEBI)",
              "Central Board of Direct Taxes (CBDT)",
              "Ministry of Finance",
            ],
            onboarding_completed: Boolean(signupUser.onboarding_completed),
          },
        });
      }
    } catch (dbErr) {
      console.warn("Supabase signups fetch notice:", dbErr);
    }

    // 2. Try fetching from Supabase user_profiles table (secondary)
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (!error && data) {
        return NextResponse.json({ success: true, profile: data });
      }
    } catch (dbErr) {
      console.warn("Supabase user_profiles fetch notice:", dbErr);
    }

    // 3. Check memory cache or return sensible default
    const cached = profileMemoryCache[email];
    if (cached) {
      return NextResponse.json({ success: true, profile: cached });
    }

    // Default profile for new / uncalibrated user
    const rawName = email.split("@")[0].replace(/[._]/g, " ");
    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const defaultProfile = {
      email,
      full_name: formattedName || "Policy Officer",
      role: "Legal Counsel / Advocate",
      primary_domain: "Banking, Finance & Tax",
      subscribed_authorities: [
        "Reserve Bank of India (RBI)",
        "Securities and Exchange Board of India (SEBI)",
        "Central Board of Direct Taxes (CBDT)",
        "Ministry of Finance",
      ],
      onboarding_completed: false,
    };

    return NextResponse.json({ success: true, profile: defaultProfile });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, primary_domain, role, subscribed_authorities, full_name, onboarding_completed } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const rawName = cleanEmail.split("@")[0].replace(/[._]/g, " ");
    const defaultName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    const updatedProfile = {
      email: cleanEmail,
      full_name: full_name || defaultName,
      role: role || "Legal Counsel / Advocate",
      primary_domain: primary_domain || "Banking, Finance & Tax",
      subscribed_authorities: Array.isArray(subscribed_authorities)
        ? subscribed_authorities
        : [
            "Reserve Bank of India (RBI)",
            "Securities and Exchange Board of India (SEBI)",
            "Central Board of Direct Taxes (CBDT)",
            "Ministry of Finance",
          ],
      onboarding_completed: onboarding_completed !== undefined ? Boolean(onboarding_completed) : true,
      updated_at: new Date().toISOString(),
    };

    // Store in memory cache
    profileMemoryCache[cleanEmail] = updatedProfile;

    // 1. Try mutating in public.signups table
    try {
      const { data: signupData, error: signupErr } = await supabase
        .from("signups")
        .update({
          primary_domain: updatedProfile.primary_domain,
          role: updatedProfile.role,
          subscribed_authorities: updatedProfile.subscribed_authorities,
          onboarding_completed: updatedProfile.onboarding_completed,
          updated_at: updatedProfile.updated_at,
        })
        .eq("email", cleanEmail)
        .select();

      if (!signupErr && signupData && signupData.length > 0) {
        return NextResponse.json({
          success: true,
          profile: {
            ...updatedProfile,
            full_name: signupData[0].full_name || updatedProfile.full_name,
          },
        });
      }
    } catch (e) {
      console.warn("Supabase signups mutation notice:", e);
    }

    // 2. Try mutating in user_profiles table (fallback/complement)
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .upsert(
          [
            {
              user_id: cleanEmail,
              ...updatedProfile,
            },
          ],
          { onConflict: "email" }
        )
        .select();

      if (!error && data && data.length > 0) {
        return NextResponse.json({ success: true, profile: data[0] });
      }
    } catch (dbErr) {
      console.warn("Supabase user_profiles upsert notice:", dbErr);
    }

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
