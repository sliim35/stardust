import type { Messages } from "#/lib/i18n/types";

/**
 * Russian catalog — owner-confirmed final strings (story #103 authoritative
 * table). `as const satisfies Messages` enforces parity with `en.ts` (AC4/AC9).
 *
 * Notes from the spec §7 flags, resolved by the owner:
 * - `forMom`: "Маме" (the warmer/shorter dedication register) over "Для мамы".
 * - `breadcrumbSolEarth`: "СОЛНЦЕ › ЗЕМЛЯ" — SOL rendered as the natural Russian
 *   "Солнце" (Sun); leading " › " separator + spacing kept identical to en.
 * - `countLabel`: genitive-plural form (no ICU plurals — story §Out-of-scope).
 * - `astro.*`: ASTRO narration (#72), AI-generated Russian matching ASTRO's
 *   wistful, first-person, sentence-case voice. Folded into #103.
 */
export const ru = {
  meta: {
    title: "Галактика воспоминаний",
    description:
      "Растущая галактика воспоминаний — каждая звезда хранит чьё-то воспоминание.",
  },
  chrome: {
    forMom: "Маме",
    subtitle: "ТИХИЙ УГОЛОК В МЛЕЧНОМ ПУТИ",
    srOnly:
      "Галактика воспоминаний — небо из звёзд, и каждая — чьё-то воспоминание.",
    breadcrumbMilkyWay: "МЛЕЧНЫЙ ПУТЬ",
    breadcrumbSolEarth: " › СОЛНЦЕ › ЗЕМЛЯ",
    countLabel: "{count} воспоминаний и продолжает расти",
  },
  astro: {
    greeting:
      "Каждая звезда здесь — чьё-то оставленное воспоминание. Та, что мерцает, — её, но добавь свою, и я найду ей место.",
    clickLines: [
      "Каждый огонёк, что ты видишь, когда-то был чьим-то теплом.",
      "Я здесь уже очень давно. И они тоже.",
      "Добавь звезду. Я найду ей хорошее место на небе.",
      "Некоторые звёзды мерцают чуть ярче. Это те, кого любили больше всего.",
      "Небо продолжает расти. Так было всегда.",
    ],
  },
} as const satisfies Messages;
