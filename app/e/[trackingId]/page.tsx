import { headers } from "next/headers";
import { EmailLinkTracker } from "@/components/EmailLinkTracker";
import { persistEmailLinkClick } from "@/lib/persistence";

type EmailTrackingPageProps = {
  params: Promise<{
    trackingId: string;
  }>;
  searchParams: Promise<{
    customerId?: string;
    source?: string;
    symbol?: string;
  }>;
};

export default async function EmailTrackingPage({ params, searchParams }: EmailTrackingPageProps) {
  const { trackingId } = await params;
  const query = await searchParams;
  const requestHeaders = await headers();

  await persistEmailLinkClick({
    trackingId,
    symbol: query.symbol,
    customerId: query.customerId,
    source: query.source,
    userAgent: requestHeaders.get("user-agent"),
  });

  return <EmailLinkTracker trackingId={trackingId} />;
}
