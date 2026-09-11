import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/email";
import { supabase } from "@/lib/supabaseClient";

// In-memory fallback verification store in case database table is pending
const inMemoryCodes = new Map<
  string,
  { code: string; expiresAt: number; name?: string }
>();

// Export helper for route sharing
export function getStoredVerification(email: string) {
  return inMemoryCodes.get(email.toLowerCase());
}

export function setStoredVerification(
  email: string,
  data: { code: string; expiresAt: number; name?: string }
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

    // Generate 6-digit numeric OTP code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    // Store in memory
    setStoredVerification(email, { code, expiresAt, name });

    // Also attempt storing in Supabase verification_codes table if exists
    try {
      await supabase.from("verification_codes").upsert(
        [
          {
            email: email.toLowerCase().trim(),
            code,
            expires_at: new Date(expiresAt).toISOString(),
            is_verified: false,
          },
        ],
        { onConflict: "email" }
      );
    } catch (dbErr) {
      console.warn("Database storage warning (using in-memory fallback):", dbErr);
    }

    // Send email via Resend
    const result = await sendVerificationEmail({
      to: email.trim(),
      name,
      code,
    });

    if (result.error) {
      console.warn("⚠️ Resend API warning (Test domain restriction):", result.error.message);
      console.log(`\n======================================================`);
      console.log(`🔑 [PRAMAAN VERIFICATION OTP] for ${email}: ${code}`);
      console.log(`======================================================\n`);

      // If in development or using resend test domain, allow verification to proceed
      if (
        result.error.message?.includes("testing emails to your own email address") ||
        process.env.NODE_ENV === "development"
      ) {
        return NextResponse.json({
          success: true,
          message: "Verification code sent (check terminal console in test mode)",
          devCode: code,
        });
      }

      return NextResponse.json(
        { error: result.error.message || "Failed to send email via Resend" },
        { status: 500 }
      );
    }

    console.log(`\n✉️ Email sent via Resend to ${email} (OTP: ${code})\n`);

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
