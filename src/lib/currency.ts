/**
 * App-wide currency setting. Detected from uploaded statements, overridable in
 * Settings, persisted to localStorage. Formatters in utils.ts read the current
 * value so every number in the app follows the statement's real currency.
 */
export const CURRENCIES = {
  USD: { symbol: "$", name: "US Dollar" },
  BDT: { symbol: "৳", name: "Bangladeshi Taka" },
  EUR: { symbol: "€", name: "Euro" },
  GBP: { symbol: "£", name: "British Pound" },
  INR: { symbol: "₹", name: "Indian Rupee" },
  PKR: { symbol: "₨", name: "Pakistani Rupee" },
  JPY: { symbol: "¥", name: "Japanese Yen" },
  AED: { symbol: "د.إ", name: "UAE Dirham" },
  SAR: { symbol: "﷼", name: "Saudi Riyal" },
  MYR: { symbol: "RM", name: "Malaysian Ringgit" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

const LS_KEY = "fiq.currency.v1";
let current: CurrencyCode = "USD";

// Hydrate synchronously on the client so first paint uses the right symbol.
if (typeof window !== "undefined") {
  const saved = window.localStorage.getItem(LS_KEY);
  if (saved && saved in CURRENCIES) current = saved as CurrencyCode;
}

export function getCurrency(): CurrencyCode {
  return current;
}

export function currencySymbol(): string {
  return CURRENCIES[current].symbol;
}

export function setCurrency(code: CurrencyCode): void {
  current = code;
  if (typeof window !== "undefined") window.localStorage.setItem(LS_KEY, code);
}

/** Detect an ISO currency code from raw statement text, if present. */
export function detectCurrencyFromText(text: string): CurrencyCode | null {
  const m = text.match(/curr(?:ency)?\s*:?\s*(USD|BDT|EUR|GBP|INR|PKR|JPY|AED|SAR|MYR)\b/i)
    ?? text.match(/\b(USD|BDT|EUR|GBP|INR|PKR|JPY|AED|SAR|MYR)\b/);
  if (m) return m[1].toUpperCase() as CurrencyCode;
  if (/৳|taka/i.test(text)) return "BDT";
  if (/₹|rupee/i.test(text)) return "INR";
  if (/€/.test(text)) return "EUR";
  if (/£/.test(text)) return "GBP";
  return null;
}
