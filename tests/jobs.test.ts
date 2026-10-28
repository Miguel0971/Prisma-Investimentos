import { it, expect } from "vitest";
import {
  cronAuthorized,
  retryDelay,
  scheduleKey,
  jobPayload,
} from "../src/services/jobs";
it("cron nega segredo ausente, curto e divergente", () => {
  expect(cronAuthorized(null, undefined)).toBe(false);
  expect(cronAuthorized("Bearer x", "x")).toBe(false);
  expect(cronAuthorized("Bearer " + "x".repeat(32), "x".repeat(32))).toBe(true);
  expect(cronAuthorized("Bearer " + "y".repeat(32), "x".repeat(32))).toBe(
    false,
  );
});
it("chave idempotente e backoff limitado", () => {
  const payload = jobPayload.parse({ kind: "quote", ticker: "petr4" });
  expect(scheduleKey("u", payload, "2026-10-28")).toBe(
    scheduleKey("u", payload, "2026-10-28"),
  );
  expect(retryDelay(1)).toBe(60000);
  expect(retryDelay(3)).toBe(240000);
  expect(retryDelay(10)).toBe(3600000);
});
