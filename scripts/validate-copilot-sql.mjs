import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const migration = readFileSync(resolve(root, "db/copilot-schema-migration.sql"), "utf8");
const rollback = readFileSync(resolve(root, "db/copilot-schema-rollback.sql"), "utf8");
const rlsVerification = readFileSync(resolve(root, "db/copilot-rls-verification.sql"), "utf8");

function normalize(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function indexOfRequired(haystack, needle) {
  const index = haystack.indexOf(needle.toLowerCase());
  assert.notEqual(index, -1, `Expected SQL to contain: ${needle}`);
  return index;
}

const normalizedMigration = normalize(migration);
const normalizedRollback = normalize(rollback);
const normalizedRls = normalize(rlsVerification);

assert.match(normalizedMigration, /^begin;/, "Copilot migration must start with begin.");
assert.match(normalizedMigration, /commit;$/, "Copilot migration must end with commit.");
assert.match(normalizedRollback, /^begin;/, "Copilot rollback must start with begin.");
assert.match(normalizedRollback, /commit;$/, "Copilot rollback must end with commit.");

const tradeHistoryUniqueIndex = indexOfRequired(
  normalizedMigration,
  "create unique index if not exists copilot_trade_history_id_user_id_uidx on trade_history(id, user_id)",
);
const tradeHistoryForeignKey = indexOfRequired(
  normalizedMigration,
  "references trade_history(id, user_id)",
);
assert.ok(
  tradeHistoryUniqueIndex < tradeHistoryForeignKey,
  "trade_history(id, user_id) unique index must exist before portfolio_positions references it.",
);

const portfolioPositionsUniqueIndex = indexOfRequired(
  normalizedMigration,
  "create unique index if not exists portfolio_positions_id_user_id_uidx on portfolio_positions(id, user_id)",
);
const portfolioPositionsForeignKey = indexOfRequired(
  normalizedMigration,
  "references portfolio_positions(id, user_id)",
);
assert.ok(
  portfolioPositionsUniqueIndex < portfolioPositionsForeignKey,
  "portfolio_positions(id, user_id) unique index must exist before copilot_findings references it.",
);

[
  "references brokerage_connections(id, user_id)",
  "references brokerage_accounts(id, user_id)",
  "references portfolio_sync_runs(id, user_id)",
  "references portfolio_snapshots(id, user_id)",
  "references trade_history(id, user_id)",
  "references portfolio_positions(id, user_id)",
].forEach((reference) => indexOfRequired(normalizedMigration, reference));

[
  "drop table if exists copilot_reports",
  "drop table if exists copilot_findings",
  "drop table if exists portfolio_positions",
  "drop table if exists portfolio_snapshots",
  "drop table if exists portfolio_sync_runs",
  "drop table if exists brokerage_accounts",
  "drop table if exists brokerage_connections",
  "drop index if exists copilot_trade_history_id_user_id_uidx",
].forEach((statement) => indexOfRequired(normalizedRollback, statement));

assert.match(
  normalizedRls,
  /where not passed/,
  "Copilot RLS verifier must inspect failed checks.",
);
assert.match(
  normalizedRls,
  /raise exception 'copilot rls verification failed:%'/,
  "Copilot RLS verifier must fail closed with an exception.",
);

[
  "user_a_reads_only_own_brokerage_connections",
  "user_b_reads_only_own_brokerage_connections",
  "user_a_cannot_read_user_b_connections",
  "anon_cannot_read_brokerage_connections",
  "customer_insert_blocked_brokerage_connections",
  "customer_update_blocked_brokerage_connections",
  "customer_delete_blocked_brokerage_connections",
  "forged_snapshot_parent_connection_rejected",
  "forged_finding_parent_position_rejected",
  "approved_admin_reads_brokerage_connections",
  "no_secret_like_columns",
].forEach((checkName) => indexOfRequired(normalizedRls, checkName));

console.log("Copilot SQL static validation passed.");
