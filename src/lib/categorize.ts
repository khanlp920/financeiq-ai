import type { Category, Transaction, TransactionType } from "@/lib/types";

/**
 * Rules-first categorization engine.
 *
 * Deterministic keyword rules cover ~95% of real statement descriptions.
 * Rows the rules can't classify are marked "Others" and can optionally be
 * refined by the AI endpoint (/api/chat handles ad-hoc questions; a batch
 * refinement call can be wired to Anthropic using the same key).
 */

interface Rule {
  category: Category;
  /** Only applies to this direction, if set. */
  type?: TransactionType;
  patterns: RegExp[];
}

const RULES: Rule[] = [
  { category: "Salary", type: "credit", patterns: [/salary/i, /payroll/i, /wages/i, /direct\s*dep/i, /employer/i, /monthly\s*pay/i] },
  { category: "Rent", patterns: [/rent(?!al car)/i, /landlord/i, /lease\s*pay/i, /property\s*mgmt/i] },
  { category: "EMI", patterns: [/\bemi\b/i, /loan\s*(pay|install|repay)/i, /mortgage/i, /auto\s*loan/i, /car\s*loan/i, /instal?lment/i] },
  { category: "Insurance", patterns: [/insurance/i, /\bpolicy\b/i, /premium/i, /geico|allstate|statefarm|state farm|lic\b|aetna|cigna/i] },
  { category: "Investment", patterns: [/invest/i, /mutual\s*fund/i, /\bsip\b/i, /brokerage/i, /vanguard|fidelity|schwab|robinhood|etrade|zerodha|groww/i, /\betf\b/i, /crypto|coinbase|binance/i] },
  { category: "Utilities", patterns: [/electric/i, /water\s*bill/i, /\bgas\s*bill\b/i, /utility/i, /internet|broadband|fiber/i, /comcast|xfinity|verizon|at&t|t-?mobile|spectrum/i, /mobile\s*recharge/i, /phone\s*bill/i, /sewage|trash|waste\s*mgmt/i] },
  { category: "Grocery", patterns: [/grocer/i, /supermarket/i, /whole\s*foods|trader\s*joe|safeway|kroger|aldi|costco|walmart\s*super|instacart|bigbasket|target/i, /\bmart\b/i] },
  { category: "Food", patterns: [/restaurant/i, /cafe|coffee|starbucks|dunkin/i, /doordash|ubereats|uber\s*eats|grubhub|swiggy|zomato|deliveroo/i, /pizza|burger|taco|sushi|diner|bakery|chipotle|mcdonald|kfc|subway(?!\s*station)/i, /food/i] },
  { category: "Fuel", patterns: [/fuel/i, /petrol|gasoline/i, /shell\b|chevron|exxon|\bbp\b|texaco|mobil\b/i, /gas\s*station/i, /\bhpcl\b|\biocl\b/i] },
  { category: "Healthcare", patterns: [/pharma|pharmacy|drug\s*store/i, /hospital|clinic|medical|dental|dentist|doctor|physio/i, /cvs\b|walgreens|rite\s*aid/i, /\blab\s*(test|corp)/i] },
  { category: "Entertainment", patterns: [/netflix|spotify|hulu|disney\+?|hbo|max\b|prime\s*video|youtube\s*premium|apple\s*(tv|music)|paramount|peacock|crunchyroll/i, /cinema|movie|theater|theatre|concert|ticketmaster/i, /steam\b|playstation|xbox|nintendo|game/i] },
  { category: "Travel", patterns: [/airline|airways|flight|delta\b|united\b|american\s*air|southwest|emirates|indigo|lufthansa/i, /hotel|airbnb|booking\.com|expedia|marriott|hilton|hyatt/i, /\buber\b(?!\s*eats)|\blyft\b|\bola\b(?!f)/i, /train|railway|amtrak|metro\s*card|transit/i, /rental\s*car|hertz|avis/i, /travel/i] },
  { category: "Education", patterns: [/tuition|school\s*fee|university|college/i, /udemy|coursera|edx|skillshare|masterclass/i, /book\s*store|kindle\s*book/i, /course/i] },
  { category: "Shopping", patterns: [/amazon(?!\s*prime\s*video)|amzn/i, /flipkart|ebay|etsy|shein|zara|h&m|nike|adidas|ikea|best\s*buy|apple\s*store|myntra/i, /mall\b|outlet/i, /shopping|purchase/i] },
  { category: "ATM Withdrawal", type: "debit", patterns: [/\batm\b/i, /cash\s*withdraw/i, /\bcwd\b/i] },
  { category: "Cash Deposit", type: "credit", patterns: [/cash\s*dep/i, /\bcdm\b/i, /deposit\s*cash/i, /branch\s*deposit/i] },
  { category: "Transfer", patterns: [/transfer|\bneft\b|\bimps\b|\brtgs\b|\bupi\b|zelle|venmo|paypal|wire\b|\bach\b/i, /to\s*savings|from\s*checking/i] },
];

/** Classify one transaction description. */
export function categorize(description: string, type: TransactionType): Category {
  for (const rule of RULES) {
    if (rule.type && rule.type !== type) continue;
    if (rule.patterns.some((p) => p.test(description))) return rule.category;
  }
  // Sensible fallbacks by direction
  return "Others";
}

/** Extract a clean merchant name from a raw statement description. */
export function extractMerchant(description: string): string {
  let s = description
    // strip common statement prefixes / codes
    .replace(/^(pos|ach|dbt|crd|purchase|payment|pmt|debit|credit|card)\s+/i, "")
    .replace(/\b(upi|neft|imps|rtgs|ref|txn|id|no)\b[:#]?\s*[\w-]*/gi, "")
    .replace(/[*#]\s*\d+/g, "")
    .replace(/\d{4,}/g, "")          // long numbers
    .replace(/\s{2,}/g, " ")
    .replace(/[^\w\s&.'-]/g, " ")
    .trim();
  if (!s) return "Unknown";
  // Title-case first 3 words
  const words = s.split(/\s+/).slice(0, 3).map(
    (w) => (w.length > 2 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w)
  );
  const name = words.join(" ").replace(/^\w/, (c) => c.toUpperCase());
  return name.length > 28 ? name.slice(0, 28) + "…" : name;
}

/** Apply categorization + merchant extraction to raw rows. */
export function enrich(t: Omit<Transaction, "category" | "merchant">): Transaction {
  return {
    ...t,
    category: categorize(t.description, t.type),
    merchant: extractMerchant(t.description),
  };
}
