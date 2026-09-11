import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";
import { supabase } from "@/lib/supabaseClient";

// In-memory fallback verification store
const inMemoryCodes = new Map<
  string,
  { codeHash: string; expiresAt: number; name?: string }
>();

// Export helpers for route sharing
export function getStoredVerification(email: string) {
  return inMemoryCodes.get(email.toLowerCase());
}

export function setStoredVerification(
  email: string,
  data: { codeHash: string; expiresAt: number; name?: string }
) {
  inMemoryCodes.set(email.toLowerCase(), data);
}

export function clearStoredVerification(email: string) {
  inMemoryCodes.delete(email.toLowerCase());
}

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Generate 6-digit numeric OTP code and cryptographic hash
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity
    const isoExpiry = new Date(expiresAt).toISOString();

    // Store hashed code in-memory fallback
    setStoredVerification(cleanEmail, { codeHash, expiresAt, name });

    // 2. Update hashed verification code in single unified 'signups' table
    try {
      await supabase
        .from("signups")
        .update({
          verification_code_hash: codeHash,
          code_expires_at: isoExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq("email", cleanEmail);
    } catch (dbErr) {
      console.warn("Database storage warning (using in-memory fallback):", dbErr);
    }

    // 3. Send plaintext OTP code to user's email
    const result = await sendVerificationEmail({
      to: cleanEmail,
      name,
      code,
    });

    if (result.error) {
      console.warn("Email service warning:", result.error.message);
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
        { error: result.error.message || "Failed to send email" },
        { status: 500 }
      );
    }

    console.log(`\n✉️ Verification email delivered to ${cleanEmail}\n`);

    return NextResponse.json({
      success: true,
      message: "Verification code sent successfully",
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    console.error("Error sending verification code:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
