/**
 * NON-BLOCKING live accuracy smoke test for the emotion classifier (#211 AC3/AC4).
 *
 * ── Why it can't run in the default gate ──────────────────────────────────────
 * This file ends in `.smoke.ts` — NOT `.test.ts` — so it is NOT matched by the default
 * Vitest `include` glob (the `*.test.ts` pattern in `vitest.config.ts`), and `pnpm test`
 * / CI never pick it up. It is a manual/preview eval, because scoring real accuracy needs
 * the REAL Workers-AI model — there is no `env.AI` binding in a plain-node Vitest run.
 *
 * ── How to run it ─────────────────────────────────────────────────────────────
 * It calls the Workers-AI REST endpoint (`POST .../ai/run/{model}`), so any node context
 * with account creds can run it — no deploy needed. `RUN_MOOD_SMOKE=1` flips
 * `vitest.config.ts` to add the `*.smoke.ts` glob to `include` (Vitest 4 dropped the
 * `--include` CLI flag), so the same flag both collects the file AND un-skips it:
 *
 *   export CLOUDFLARE_ACCOUNT_ID=$(wrangler whoami | ...)   # your account id
 *   export CLOUDFLARE_API_TOKEN=$(wrangler auth token)      # a Workers-AI-scoped token
 *   RUN_MOOD_SMOKE=1 pnpm test src/lib/galaxy/mood-detect.smoke.ts
 *
 * Without `RUN_MOOD_SMOKE=1` the file is not even collected; with the flag but missing
 * creds the suite SKIPS itself — double safety, so it can never fail the default gate.
 *
 * It scores all 54 fixtures (`MOOD_FIXTURES`) and asserts a SOFT accuracy floor so a
 * prompt/model regression is caught — but only when explicitly run. Tune the floors as
 * the prompt evolves; record the run on the story issue (#211) per the traceability rule.
 */

import { describe, expect, it } from "vitest";
import {
  buildMoodMessages,
  MOOD_JSON_SCHEMA,
  MOOD_MODEL,
  parseMoodResponse,
} from "#/lib/galaxy/mood-detect";
import {
  type AccuracyReport,
  MOOD_FIXTURES,
  scoreClassifications,
} from "#/lib/galaxy/mood-fixtures";
import type { Emotion } from "#/lib/galaxy/types";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const ENABLED =
  process.env.RUN_MOOD_SMOKE === "1" && Boolean(accountId) && Boolean(apiToken);

/** Soft floors — a regression guard, not a perfection gate. Tune per model/prompt. */
const OVERALL_FLOOR = 0.7;
const ADVERSARIAL_FLOOR = 0.4;

/** Classify one memory through the live Workers-AI REST endpoint, reusing the prompt. */
const classifyLive = async (text: string): Promise<Emotion | null> => {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MOOD_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: buildMoodMessages(text),
        response_format: MOOD_JSON_SCHEMA,
      }),
    },
  );
  if (!res.ok) return null;
  // REST wraps the model output in `{ result: { response } }`; the parser expects `{ response }`.
  const json = (await res.json()) as { result?: unknown };
  return parseMoodResponse(json.result);
};

const runEval = async (): Promise<AccuracyReport> => {
  const predictions: (Emotion | null)[] = [];
  for (const fixture of MOOD_FIXTURES) {
    predictions.push(await classifyLive(fixture.text));
  }
  return scoreClassifications(MOOD_FIXTURES, predictions);
};

// `describe.skipIf` keeps the suite present (discoverable) but inert unless ENABLED.
describe.skipIf(!ENABLED)(
  "mood-detect live accuracy smoke (non-blocking)",
  () => {
    it("classifies the 54-fixture set above the accuracy floors", async () => {
      const report = await runEval();
      // Surface the breakdown for the manual eval log (this is an eval harness, not app
      // code; `noConsole` is not enabled in this repo's Biome config).
      console.log(
        `mood smoke: overall ${(report.accuracy * 100).toFixed(1)}% ` +
          `(base ${(report.baseAccuracy * 100).toFixed(1)}%, ` +
          `adversarial ${(report.adversarialAccuracy * 100).toFixed(1)}%); ` +
          `${report.misses.length} misses`,
      );
      for (const miss of report.misses) {
        console.log(
          `  MISS [${miss.fixture.expected}] got ${miss.predicted}: ${miss.fixture.text}`,
        );
      }
      expect(report.accuracy).toBeGreaterThanOrEqual(OVERALL_FLOOR);
      expect(report.adversarialAccuracy).toBeGreaterThanOrEqual(
        ADVERSARIAL_FLOOR,
      );
    }, 120_000);
  },
);
