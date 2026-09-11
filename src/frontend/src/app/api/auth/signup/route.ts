import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabaseClient";
import { sendVerificationEmail } from "@/lib/email";
import { setStoredVerification } from "../send-verification/route";

export async function POST(request: Request) {
  try {
    const { fullName, email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Check if verified user already exists
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

    // 2. Generate 6-digit OTP and cryptographic hash
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity
    const isoExpiry = new Date(expiresAt).toISOString();
    const nowIso = new Date().toISOString();

    // Store in-memory fallback
    setStoredVerification(cleanEmail, { codeHash, expiresAt, name: fullName });

    // 3. Upsert into unified 'signups' table (No roles, single table)
    try {
      await supabase.from("signups").upsert(
        [
          {
            email: cleanEmail,
            full_name: fullName?.trim() || "",
            password_hash: hashedPassword,
            verification_code_hash: codeHash,
            code_expires_at: isoExpiry,
            is_verified: false,
            created_at: nowIso,
            updated_at: nowIso,
          },
        ],
        { onConflict: "email" }
      );
    } catch (dbErr) {
      console.warn("Database storage warning (using in-memory):", dbErr);
    }

    // 4. Send verification email
    const emailRes = await sendVerificationEmail({
      to: cleanEmail,
      name: fullName,
      code,
    });

    if (emailRes.error) {
      console.warn("Email dispatch notice:", emailRes.error.message);
      console.log(`\n======================================================`);
      console.log(`🔑 [PRAMAAN VERIFICATION OTP] for ${cleanEmail}: ${code}`);
      console.log(`======================================================\n`);

      if (process.env.NODE_ENV === "development") {
        return NextResponse.json({
          success: true,
          message: "Verification code sent (check terminal console in test mode)",
          devCode: code,
        });
      }

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
