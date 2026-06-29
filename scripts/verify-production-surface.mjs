#!/usr/bin/env node

const baseUrl = (process.env.VERIFY_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.swingfi.trade").replace(/\/$/, "");

const checks = [
  {
    label: "homepage loads",
    path: "/",
    expectStatus: 200,
    expectText: "AI-ranked swing trade research",
    allowRedirect: false,
  },
  {
    label: "pricing loads",
    path: "/pricing",
    expectStatus: 200,
    expectText: "30-day free trial",
    allowRedirect: false,
  },
  {
    label: "legal disclaimer loads",
    path: "/legal/disclaimer",
    expectStatus: 200,
    expectText: "Not Financial Advice",
    allowRedirect: false,
  },
  {
    label: "dashboard is noindexed",
    path: "/dashboard",
    expectStatus: 200,
    expectHeader: ["x-robots-tag", "noindex"],
    allowRedirect: false,
  },
  {
    label: "opportunity detail is noindexed",
    path: "/opportunities/SPY",
    expectStatus: 200,
    expectHeader: ["x-robots-tag", "noindex"],
    allowRedirect: false,
  },
  {
    label: "agent redirects away",
    path: "/agent",
    expectStatus: [307, 308],
    expectHeader: ["location", "/admin"],
    allowRedirect: false,
  },
  {
    label: "public opportunities API is gated",
    path: "/api/opportunities",
    expectStatus: [401, 402, 403],
    expectHeader: ["x-robots-tag", "noindex"],
    allowRedirect: false,
  },
  {
    label: "public admin API is gated",
    path: "/api/admin/status",
    expectStatus: 403,
    expectHeader: ["x-robots-tag", "noindex"],
    allowRedirect: false,
  },
  {
    label: "public agent API is gated",
    path: "/api/agent/daily-rankings",
    method: "POST",
    expectStatus: 403,
    expectHeader: ["x-robots-tag", "noindex"],
    allowRedirect: false,
  },
  {
    label: "sitemap excludes private surfaces",
    path: "/sitemap.xml",
    expectStatus: 200,
    forbidText: [
      "/admin",
      "/api/",
      "/dashboard",
      "/opportunities",
      "/portfolio",
      "/settings",
    ],
    allowRedirect: false,
  },
  {
    label: "robots blocks private surfaces",
    path: "/robots.txt",
    expectStatus: 200,
    expectText: "Disallow: /dashboard",
    allowRedirect: false,
  },
];

function statusMatches(actual, expected) {
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

async function runCheck(check) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    method: check.method || "GET",
    redirect: check.allowRedirect ? "follow" : "manual",
  });
  const body = await response.text();

  if (!statusMatches(response.status, check.expectStatus)) {
    throw new Error(`expected status ${JSON.stringify(check.expectStatus)}, got ${response.status}`);
  }

  if (check.expectHeader) {
    const [name, expectedValue] = check.expectHeader;
    const actual = response.headers.get(name) || "";
    if (!actual.toLowerCase().includes(expectedValue.toLowerCase())) {
      throw new Error(`expected ${name} to include ${expectedValue}, got ${actual || "(empty)"}`);
    }
  }

  if (check.expectText && !body.includes(check.expectText)) {
    throw new Error(`expected body to include ${JSON.stringify(check.expectText)}`);
  }

  if (check.forbidText) {
    const found = check.forbidText.find((text) => body.includes(text));
    if (found) {
      throw new Error(`body unexpectedly included ${JSON.stringify(found)}`);
    }
  }
}

console.log(`Verifying SwingFi production surface at ${baseUrl}`);

let failed = false;
for (const check of checks) {
  try {
    await runCheck(check);
    console.log(`✓ ${check.label}`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${check.label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("Production surface checks passed.");
}
