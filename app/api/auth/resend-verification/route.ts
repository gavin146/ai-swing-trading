import { NextRequest, NextResponse } from "next/server";
import {
  normalizeAuthEmail,
  sendNewVerificationEmail,
} from "@/lib/auth/email-verification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = normalizeAuthEmail(body.email);

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  try {
    const result = await sendNewVerificationEmail({ appUrl, email });

    if (result.status === "unconfigured") {
      return NextResponse.json(
        { error: "Email verification is not configured yet." },
        { status: 503 },
      );
    }

    return NextResponse.json({
      alreadyVerified: result.status === "already_verified",
      sent: result.status === "sent",
    });
  } catch (caught) {
    return NextResponse.json(
      {
        error:
          caught instanceof Error
            ? caught.message
            : "Verification email could not be sent.",
      },
      { status: 503 },
    );
  }
}
