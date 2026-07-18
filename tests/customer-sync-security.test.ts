import assert from "node:assert/strict";
import {
  assertCustomerSyncMatchesSession,
  buildCustomerSyncPayload,
} from "../lib/auth/customer-sync";

const identity = {
  authUserId: "auth-user-real",
  email: "real-user@example.com",
};

function testRejectsMismatchedEmail() {
  assert.throws(
    () => assertCustomerSyncMatchesSession("attacker@example.com", identity),
    /must match the active login session/,
  );
}

function testIgnoresClientSuppliedIdentityAndPrivilegeFields() {
  const payload = buildCustomerSyncPayload({
    body: {
      authUserId: "attacker-auth-id",
      createdAt: "1999-01-01T00:00:00.000Z",
      email: "real-user@example.com",
      emailVerifiedAt: "2099-01-01T00:00:00.000Z",
      role: "admin",
      riskProfile: "aggressive",
    },
    identity,
    nowIso: "2026-07-17T13:30:00.000Z",
    role: "customer",
  });

  assert.equal(payload.auth_user_id, "auth-user-real");
  assert.equal(payload.email, "real-user@example.com");
  assert.equal(payload.role, "customer");
  assert.equal("created_at" in payload, false);
  assert.equal("email_verified_at" in payload, false);
  assert.equal(payload.risk_profile, "aggressive");
  assert.equal(payload.last_login_at, "2026-07-17T13:30:00.000Z");
}

function testAllowsEmptyBodyEmailWhenSessionIsVerified() {
  const payload = buildCustomerSyncPayload({
    body: {
      fullName: "Real User",
      morningAlertsEnabled: true,
    },
    identity,
    nowIso: "2026-07-17T13:30:00.000Z",
    role: "customer",
  });

  assert.equal(payload.email, "real-user@example.com");
  assert.equal(payload.full_name, "Real User");
  assert.equal(payload.morning_alerts_enabled, true);
}

function main() {
  testRejectsMismatchedEmail();
  testIgnoresClientSuppliedIdentityAndPrivilegeFields();
  testAllowsEmptyBodyEmailWhenSessionIsVerified();
  console.log("Customer sync security tests passed.");
}

main();
