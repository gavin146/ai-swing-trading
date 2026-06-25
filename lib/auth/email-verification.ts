import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { brandedButton, buildBrandedEmail, escapeHtml } from "@/lib/email-branding";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const defaultExpirationHours = 24;

type TokenRow = {
  id: string;
  user_id: string;
  email: string;
  expires_at: string;
  consumed_at: string | null;
};

export type VerifyEmailResult =
  | { status: "verified"; email: string }
  | { status: "expired"; email: string }
  | { status: "invalid"; email?: string }
  | { status: "unconfigured" };

export function normalizeAuthEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function verificationHours() {
  const configured = Number(process.env.AUTH_EMAIL_VERIFICATION_HOURS);
  return Number.isFinite(configured) && configured > 0 ? configured : defaultExpirationHours;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createVerificationUrl(appUrl: string, token: string) {
  const url = new URL("/verify-email", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function createEmailVerificationToken(
  supabase: SupabaseClient,
  args: {
    email: string;
    userId: string;
  },
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + verificationHours() * 60 * 60 * 1000).toISOString();

  await supabase
    .from("auth_email_verification_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", args.userId)
    .is("consumed_at", null);

  const { error } = await supabase.from("auth_email_verification_tokens").insert({
    email: args.email,
    expires_at: expiresAt,
    token_hash: tokenHash(token),
    user_id: args.userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { expiresAt, token };
}

export async function sendVerificationEmail(args: {
  appUrl: string;
  email: string;
  name?: string | null;
  token: string;
}) {
  const verificationUrl = createVerificationUrl(args.appUrl, args.token);
  const firstName = args.name?.trim().split(/\s+/)[0] ?? "";
  const safeName = firstName ? `${escapeHtml(firstName)}, ` : "";
  const safeVerificationUrl = escapeHtml(verificationUrl);
  const html = buildBrandedEmail({
    eyebrow: "Account verification",
    preheader: "Confirm your email to unlock your SwingFi dashboard.",
    title: "Confirm your SwingFi account",
    bodyHtml: `
      <p style="margin:0;color:#52615b;">${safeName}confirm this email address to unlock your SwingFi dashboard, free trial access, saved preferences, and daily research links.</p>
      ${brandedButton("Confirm email", verificationUrl)}
      <p style="margin:18px 0 0;color:#697770;font-size:12px;line-height:1.6;">This link expires in ${verificationHours()} hours. If the button does not work, copy and paste this link into your browser:<br /><a href="${safeVerificationUrl}" style="color:#0b3d3f;text-decoration:underline;word-break:break-all;">${safeVerificationUrl}</a></p>`,
    footerNote:
      "This email verifies access to your SwingFi account. SwingFi is research software and does not place trades or provide personalized financial advice.",
  });

  return sendEmail({
    to: args.email,
    subject: "Confirm your SwingFi account",
    text: [
      "Confirm your SwingFi account.",
      "",
      "Open this link to verify your email and unlock your dashboard:",
      "",
      verificationUrl,
      "",
      `This link expires in ${verificationHours()} hours.`,
    ].join("\n"),
    html,
  });
}

export async function sendNewVerificationEmail(args: {
  appUrl: string;
  email: string;
}) {
  const supabase = createSupabaseAdminClient();
  const email = normalizeAuthEmail(args.email);

  if (!supabase) {
    return { status: "unconfigured" as const };
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id,email,full_name,email_verified_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    return { status: "sent" as const };
  }

  if (user.email_verified_at) {
    return { status: "already_verified" as const };
  }

  const { token } = await createEmailVerificationToken(supabase, {
    email: user.email,
    userId: user.id,
  });
  const delivery = await sendVerificationEmail({
    appUrl: args.appUrl,
    email: user.email,
    name: user.full_name,
    token,
  });

  if (delivery.status === "failed") {
    throw new Error(delivery.error ?? "Verification email could not be sent.");
  }

  return { status: "sent" as const };
}

export async function verifyEmailToken(token: string): Promise<VerifyEmailResult> {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return { status: "unconfigured" };
  }

  const hash = tokenHash(token);
  const { data, error } = await supabase
    .from("auth_email_verification_tokens")
    .select("id,user_id,email,expires_at,consumed_at")
    .eq("token_hash", hash)
    .maybeSingle<TokenRow>();

  if (error || !data || data.consumed_at) {
    return { status: "invalid" };
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return { status: "expired", email: data.email };
  }

  const verifiedAt = new Date().toISOString();
  const [{ error: userError }, { error: tokenError }] = await Promise.all([
    supabase.from("users").update({ email_verified_at: verifiedAt }).eq("id", data.user_id),
    supabase
      .from("auth_email_verification_tokens")
      .update({ consumed_at: verifiedAt })
      .eq("id", data.id),
  ]);

  if (userError || tokenError) {
    return { status: "invalid", email: data.email };
  }

  return { status: "verified", email: data.email };
}
