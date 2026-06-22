import { EmailLinkTracker } from "@/components/EmailLinkTracker";

type EmailTrackingPageProps = {
  params: Promise<{
    trackingId: string;
  }>;
};

export default async function EmailTrackingPage({ params }: EmailTrackingPageProps) {
  const { trackingId } = await params;

  return <EmailLinkTracker trackingId={trackingId} />;
}
