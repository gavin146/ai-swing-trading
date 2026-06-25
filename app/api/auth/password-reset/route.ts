import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { brandedButton, buildBrandedEmail, escapeHtml } from "@/lib/email-branding";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = cleanEmail(body.email);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Password reset is not configured because Supabase admin access is missing." },
      { status: 503 },
    );
  }

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 503 });
  }

  if (!userRow) {
    return NextResponse.json(
      { error: "No SwingFi account was found for that email. Check the spelling or create an account." },
      { status: 404 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${appUrl}/login?reset=1`,
    },
  });

  if (error || !data.properties?.action_link) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create a password reset link." },
      { status: 400 },
    );
  }

  const resetUrl = data.properties.action_link;
  const safeResetUrl = escapeHtml(resetUrl);
  const html = buildBrandedEmail({
    eyebrow: "SwingFi security",
    preheader: "Use this secure SwingFi link to reset your password.",
    title: "Reset your password",
    bodyHtml: `
      <p style="margin:0;color:#52615b;">Open this secure link to choose a new SwingFi password. If you did not request this, you can ignore the email.</p>
      ${brandedButton("Reset password", resetUrl)}
      <p style="margin:18px 0 0;color:#697770;font-size:12px;line-height:1.6;">If the button does not work, copy and paste this link into your browser:<br /><a href="${safeResetUrl}" style="color:#0b3d3f;text-decoration:underline;word-break:break-all;">${safeResetUrl}</a></p>`,
    footerNote:
      "For your security, never share your SwingFi password or reset link. SwingFi will never ask you to send your password by email.",
  });
  const delivery = await sendEmail({
    to: email,
    subject: "Reset your SwingFi password",
    text: [
      "Reset your SwingFi password.",
      "",
      "Open the secure link below to choose a new password. If you did not request this, you can ignore this email.",
      "",
      resetUrl,
    ].join("\n"),
    html,
  });

  if (delivery.status === "failed") {
    return NextResponse.json(
      { error: delivery.error ?? "Password reset email could not be sent." },
      { status: 503 },
    );
  }

  return NextResponse.json({ sent: true });
}
