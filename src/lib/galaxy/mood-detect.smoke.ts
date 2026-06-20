/**
 * Non-blocking live-accuracy eval for the emotion classifier (#211 AC3/AC4): `.smoke.ts`
 * so Vitest skips it by default; opt-in `RUN_MOOD_SMOKE=1` adds the glob AND un-skips,
 * scoring the 54 `MOOD_FIXTURES` against the real Workers-AI model over its REST endpoint.
 *
 *   CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… RUN_MOOD_SMOKE=1 \
 *     pnpm test src/lib/galaxy/mood-detect.smoke.ts
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
