import nodemailer from "nodemailer";
import { Resend } from "resend";

const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER || "";
const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD || "";
const resendApiKey = process.env.RESEND_API_KEY || "";

// Configure Gmail SMTP Transporter
const transporter = gmailUser && gmailPass
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    })
  : null;

// Fallback Resend Client
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendVerificationEmail({
  to,
  name,
  code,
}: {
  to: string;
  name?: string;
  code: string;
}): Promise<{ success: boolean; error?: { message: string } }> {
  const greeting = name ? `Hello ${name},` : "Hello,";

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your Pramaan Account</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF8F5; margin: 0; padding: 40px 20px; color: #1E1A17;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #E8E2D8; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #F2ECE4; background-color: #FAF8F5;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #1E1A17; letter-spacing: -0.5px;">Pramaan</h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #7A3622; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Government Documents. Clearer Insights.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="font-size: 15px; color: #333333; margin: 0 0 16px 0;">${greeting}</p>
              <p style="font-size: 14px; color: #555555; line-height: 1.6; margin: 0 0 24px 0;">
                Thank you for signing up for Pramaan. Please use the 6-digit verification code below to confirm your email and activate your account.
              </p>
              <div style="background-color: #FAF6F0; border: 1px solid #E8DDD0; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #5D2A18;">${code}</span>
              </div>
              <p style="font-size: 12px; color: #888888; text-align: center; margin: 0 0 24px 0;">
                This verification code will expire in 15 minutes.
              </p>
              <p style="font-size: 13px; color: #666666; line-height: 1.5; margin: 0;">
                If you did not request this verification, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #FAF8F5; border-top: 1px solid #F2ECE4; text-align: center; font-size: 11px; color: #999999;">
              © Pramaan • Built for a more informed India
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  // 1. Send via Gmail SMTP if configured
  if (transporter && gmailUser) {
    try {
      await transporter.sendMail({
        from: `"Pramaan" <${gmailUser}>`,
        to,
        subject: "Verify your email for Pramaan",
        html: emailHtml,
      });
      console.log(`✉️ Email successfully delivered via Gmail SMTP to: ${to}`);
      return { success: true };
    } catch (smtpErr: any) {
      console.error("Gmail SMTP delivery error:", smtpErr);
      return { success: false, error: { message: smtpErr.message || "Failed to send email via Gmail SMTP" } };
    }
  }

  // 2. Fallback to Resend
  if (resend) {
    try {
      const fromAddress = process.env.RESEND_FROM_EMAIL || "Pramaan <onboarding@resend.dev>";
      const res = await resend.emails.send({
        from: fromAddress,
        to: [to],
        subject: "Verify your email for Pramaan",
        html: emailHtml,
      });

      if (res.error) {
        return { success: false, error: { message: res.error.message } };
      }
      return { success: true };
    } catch (resendErr: any) {
      return { success: false, error: { message: resendErr.message } };
    }
  }

  // 3. Fallback for Local Dev
  console.log(`🔑 [DEV MODE OTP] Verification code for ${to}: ${code}`);
  return { success: true };
}
