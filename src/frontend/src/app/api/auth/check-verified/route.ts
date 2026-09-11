import { NextResponse } from "next/server";
import { isEmailVerified } from "../verify-code/route";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Check in-memory store
    if (isEmailVerified(cleanEmail)) {
      return NextResponse.json({ verified: true });
    }

    // 2. Check Supabase verification_codes table
    try {
      const { data } = await supabase
        .from("verification_codes")
        .select("is_verified")
        .eq("email", cleanEmail)
        .eq("is_verified", true)
        .maybeSingle();

      if (data) {
        return NextResponse.json({ verified: true });
      }
    } catch (e) {
      console.warn("DB check warning:", e);
    }

    return NextResponse.json({
      verified: false,
      message: "Email address is not yet verified. Please verify your email first.",
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
