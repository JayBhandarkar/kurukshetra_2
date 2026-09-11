import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabaseClient";
import { sendVerificationEmail } from "@/lib/email";
import { setStoredVerification } from "../send-verification/route";

export async function POST(request: Request) {
  try {
    const { fullName, email, password, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Check if user already exists
    try {
      const { data: existingUser } = await supabase
        .from("signups")
        .select("id, is_verified")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (existingUser && existingUser.is_verified) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please log in." },
          { status: 400 }
        );
      }
    } catch (dbErr) {
      console.warn("DB check notice:", dbErr);
    }

    // 2. Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store in-memory
    setStoredVerification(cleanEmail, { code, expiresAt, name: fullName });

    // 3. Upsert into Supabase tables
    try {
      await supabase.from("signups").upsert(
        [
          {
            email: cleanEmail,
            full_name: fullName?.trim() || "",
            password_hash: hashedPassword,
            role: role || "Policy Researcher / Legal",
            is_verified: false,
            created_at: new Date().toISOString(),
          },
        ],
        { onConflict: "email" }
      );

      await supabase.from("verification_codes").upsert(
        [
          {
            email: cleanEmail,
            code,
            expires_at: new Date(expiresAt).toISOString(),
            is_verified: false,
          },
        ],
        { onConflict: "email" }
      );
    } catch (dbErr) {
      console.warn("Database storage warning (using in-memory):", dbErr);
    }

    // 4. Send verification email via Resend
    const emailRes = await sendVerificationEmail({
      to: cleanEmail,
      name: fullName,
      code,
    });

    if (emailRes.error) {
      console.error("Resend send error:", emailRes.error);
      return NextResponse.json(
        { error: emailRes.error.message || "Failed to send verification email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    console.error("Signup error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
