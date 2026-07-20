import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  checkCopilotPreviewRateLimit,
  getCopilotPreviewAllowlist,
  isCopilotPreviewEmailAllowed,
  redactCopilotSensitiveText,
  resetCopilotPreviewRateLimitForTests,
  sanitizeCopilotError,
} from "../lib/copilot/preview-access";

const routeSource = readFileSync(resolve(process.cwd(), "app/api/copilot/report/route.ts"), "utf8");

function testDefaultOwnerOnlyAllowlist() {
  assert.deepEqual(Array.from(getCopilotPreviewAllowlist({})), ["gavin@onefear.co"]);
  assert.equal(isCopilotPreviewEmailAllowed("GAVIN@ONEFEAR.CO", {}), true);
  assert.equal(isCopilotPreviewEmailAllowed("customer@example.com", {}), false);
}

function testCommaSeparatedAllowlist() {
  const env = {
    COPILOT_PREVIEW_EMAILS: " alpha@example.com, BETA@example.com ,, ",
  };

  assert.equal(isCopilotPreviewEmailAllowed("alpha@example.com", env), true);
  assert.equal(isCopilotPreviewEmailAllowed("beta@example.com", env), true);
  assert.equal(isCopilotPreviewEmailAllowed("gavin@onefear.co", env), false);
}

function testRateLimit() {
  resetCopilotPreviewRateLimitForTests();
  assert.equal(checkCopilotPreviewRateLimit("user-1", { limit: 2, nowMs: 100, windowMs: 1_000 }).allowed, true);
  assert.equal(checkCopilotPreviewRateLimit("user-1", { limit: 2, nowMs: 200, windowMs: 1_000 }).allowed, true);
  assert.equal(checkCopilotPreviewRateLimit("user-1", { limit: 2, nowMs: 300, windowMs: 1_000 }).allowed, false);
  assert.equal(checkCopilotPreviewRateLimit("user-1", { limit: 2, nowMs: 1_200, windowMs: 1_000 }).allowed, true);
}

function testSecretRedaction() {
  const redacted = redactCopilotSensitiveText(
    "Authorization: Bearer abc.def.ghi secret=shh api_key=123 sk-test-value sk_live_123",
  );

  assert.doesNotMatch(redacted, /abc\.def\.ghi/);
  assert.doesNotMatch(redacted, /shh/);
  assert.doesNotMatch(redacted, /123/);
  assert.doesNotMatch(redacted, /sk-test-value/);
  assert.doesNotMatch(redacted, /sk_live_123/);
  assert.match(sanitizeCopilotError(new Error("token=secret")), /\[redacted\]/);
}

function testRouteUsesSessionEmailOnly() {
  assert.match(routeSource, /resolveCustomerSession\(request\)/);
  assert.match(routeSource, /isCopilotPreviewEmailAllowed\(session\.user\?\.email\)/);
  assert.doesNotMatch(routeSource, /searchParams\.get\(["']email["']\)/);
  assert.doesNotMatch(routeSource, /request\.json\(/);
  assert.doesNotMatch(routeSource, /cookies\(\)/);
}

function testRouteDoesNotUsePublicFlagForAuthorization() {
  assert.doesNotMatch(routeSource, /NEXT_PUBLIC_COPILOT_ENABLED/);
}

function testRouteBlocksBeforeLoadingPrivateData() {
  const allowlistIndex = routeSource.indexOf("isCopilotPreviewEmailAllowed(session.user?.email)");
  const providerIndex = routeSource.indexOf("new ManualPortfolioReadProvider");
  const repositoryIndex = routeSource.indexOf("new SupabaseManualPortfolioTradeRepository");
  const opportunitiesIndex = routeSource.indexOf("const opportunities = await listLatestOpportunities");

  assert.ok(allowlistIndex > -1);
  assert.ok(providerIndex > -1);
  assert.ok(repositoryIndex > -1);
  assert.ok(opportunitiesIndex > -1);
  assert.ok(allowlistIndex < providerIndex);
  assert.ok(allowlistIndex < repositoryIndex);
  assert.ok(allowlistIndex < opportunitiesIndex);
}

function testRouteUsesNoStoreAndConservativeLimits() {
  assert.match(routeSource, /Cache-Control/);
  assert.match(routeSource, /private, no-store/);
  assert.match(routeSource, /copilotPreviewTrackedPositionLimit = 50/);
  assert.match(routeSource, /copilotPreviewQuoteConcurrency = 5/);
}

function testRouteDoesNotReturnRawProviderErrors() {
  assert.doesNotMatch(routeSource, /error:\s*sync\.error\.message/);
  assert.doesNotMatch(routeSource, /error:\s*sanitizeCopilotError\(error\)/);
  assert.match(routeSource, /logCopilotServerError\("manual_portfolio_sync_failed"/);
  assert.match(routeSource, /logCopilotServerError\("copilot_report_failed"/);
}

function main() {
  testDefaultOwnerOnlyAllowlist();
  testCommaSeparatedAllowlist();
  testRateLimit();
  testSecretRedaction();
  testRouteUsesSessionEmailOnly();
  testRouteDoesNotUsePublicFlagForAuthorization();
  testRouteBlocksBeforeLoadingPrivateData();
  testRouteUsesNoStoreAndConservativeLimits();
  testRouteDoesNotReturnRawProviderErrors();
  console.log("Copilot preview access tests passed.");
}

main();
