import { en, type MessageKey } from "./en";
import { sk } from "./sk";

export type Lang = "en" | "sk";
export type { MessageKey };

export const LANGS: { id: Lang; native: string; english: string }[] = [
  { id: "en", native: "English", english: "English" },
  { id: "sk", native: "Slovenčina", english: "Slovak" },
];

const catalogs: Record<Lang, Record<string, string>> = { en, sk };

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "sk";
}

/** Pick the best supported language from the browser's preference list. */
export function detectLang(prefs: readonly string[] | undefined): Lang {
  for (const p of prefs ?? []) {
    const base = p.toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

function fill(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) =>
    k in params ? String(params[k]) : m,
  );
}

/** Translate a key. Falls back to English, then to the key itself. */
export function translate(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>,
): string {
  const text = catalogs[lang][key] ?? catalogs.en[key] ?? key;
  return fill(text, params);
}

/**
 * Translate a plural key. Looks up `key.one`, `key.few`, `key.many`, `key.other`
 * according to the language's plural rules, falling back to `key.other`.
 */
export function translatePlural(
  lang: Lang,
  key: string,
  count: number,
  params?: Record<string, string | number>,
): string {
  const cat = new Intl.PluralRules(lang).select(count);
  const cat2 =
    catalogs[lang][`${key}.${cat}`] !== undefined ||
    catalogs.en[`${key}.${cat}`] !== undefined
      ? cat
      : "other";
  return translate(lang, `${key}.${cat2}`, { n: count, ...params });
}

export type TFn = (
  key: MessageKey | (string & {}),
  params?: Record<string, string | number>,
) => string;
export type TPluralFn = (
  key: string,
  count: number,
  params?: Record<string, string | number>,
) => string;

export function makeT(lang: Lang): { t: TFn; tp: TPluralFn } {
  return {
    t: (key, params) => translate(lang, key, params),
    tp: (key, count, params) => translatePlural(lang, key, count, params),
  };
}

export function catalog(lang: Lang): Record<string, string> {
  return catalogs[lang];
}
