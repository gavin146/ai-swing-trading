import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { persistAlertOpen } from "@/lib/persistence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const transparentGif = Uint8Array.from([
  71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255, 33, 249, 4, 1, 0, 0,
  0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1, 0, 59,
]);

type OpenTrackingRouteProps = {
  params: Promise<{
    trackingId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: OpenTrackingRouteProps) {
  const { trackingId } = await params;
  const requestHeaders = await headers();
  const searchParams = request.nextUrl.searchParams;

  await persistAlertOpen({
    trackingId,
    customerId: searchParams.get("customerId"),
    source: searchParams.get("source"),
    userAgent: requestHeaders.get("user-agent"),
  });

  return new NextResponse(transparentGif, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Content-Type": "image/gif",
    },
  });
}
