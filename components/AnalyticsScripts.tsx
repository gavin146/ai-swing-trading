"use client";

import Script from "next/script";
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
const crossDomainLinks = ["getswingfi.com", "www.getswingfi.com", "swingfi.trade", "www.swingfi.trade"];

function AnalyticsPageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!gaMeasurementId || !window.gtag) return;

    const query = searchParams.toString();
    window.gtag("event", "page_view", {
      page_location: `${window.location.origin}${pathname}${query ? `?${query}` : ""}`,
      page_path: `${pathname}${query ? `?${query}` : ""}`,
      page_title: document.title,
      send_to: gaMeasurementId,
    });
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsScripts() {
  if (!gaMeasurementId && !gtmId) return null;

  return (
    <>
      {gtmId ? (
        <>
          <Script id="swingfi-gtm" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');
            `}
          </Script>
          <noscript>
            <iframe
              height="0"
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
              width="0"
            />
          </noscript>
        </>
      ) : null}

      {gaMeasurementId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="swingfi-ga4" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('set', 'linker', { domains: ${JSON.stringify(crossDomainLinks)} });
              gtag('js', new Date());
              gtag('config', '${gaMeasurementId}', { send_page_view: false });
            `}
          </Script>
          <Suspense fallback={null}>
            <AnalyticsPageViews />
          </Suspense>
        </>
      ) : null}
    </>
  );
}
