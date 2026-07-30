import { enrich } from "@/lib/categorize";
import type { Transaction } from "@/lib/types";

/**
 * Deterministic demo dataset: ~15 months of realistic banking activity.
 * Seeded PRNG so every visitor sees identical numbers (stable screenshots,
 * stable tests). Used when Supabase is not configured or account is empty.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260718);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

const ACCOUNT = "XXXX-4821";
const BANK = "First Meridian Bank";

interface Tpl { desc: string; lo: number; hi: number; credit?: boolean }

const RESTAURANTS: Tpl[] = [
  { desc: "STARBUCKS COFFEE #2214", lo: 6, hi: 14 },
  { desc: "CHIPOTLE MEXICAN GRILL", lo: 12, hi: 24 },
  { desc: "DOORDASH*THAI ORCHID", lo: 22, hi: 48 },
  { desc: "UBER EATS PENDING", lo: 18, hi: 42 },
  { desc: "BLUE FIN SUSHI BAR", lo: 40, hi: 95 },
  { desc: "MCDONALD'S F3410", lo: 8, hi: 16 },
];
const GROCERY: Tpl[] = [
  { desc: "WHOLE FOODS MKT #104", lo: 55, hi: 160 },
  { desc: "TRADER JOE'S #552", lo: 35, hi: 110 },
  { desc: "COSTCO WHSE #0441", lo: 90, hi: 260 },
];
const SHOPPING: Tpl[] = [
  { desc: "AMAZON MKTPL*RT4Y82", lo: 15, hi: 180 },
  { desc: "TARGET T-1044", lo: 25, hi: 140 },
  { desc: "NIKE.COM ORDER", lo: 60, hi: 190 },
  { desc: "IKEA HOME SHOPPING", lo: 45, hi: 320 },
];
const FUEL: Tpl[] = [
  { desc: "SHELL OIL 5744221", lo: 38, hi: 72 },
  { desc: "CHEVRON 0093221", lo: 40, hi: 75 },
];
const ENTERTAINMENT_ONE_OFF: Tpl[] = [
  { desc: "AMC THEATRES #440", lo: 24, hi: 58 },
  { desc: "TICKETMASTER EVENT", lo: 65, hi: 240 },
  { desc: "STEAM GAMES 425-95", lo: 10, hi: 60 },
];
const TRAVEL: Tpl[] = [
  { desc: "UBER TRIP HELP.UBER.COM", lo: 11, hi: 38 },
  { desc: "LYFT *RIDE THU", lo: 10, hi: 34 },
  { desc: "DELTA AIR 0062341998821", lo: 220, hi: 540 },
  { desc: "AIRBNB HMQ84K", lo: 180, hi: 620 },
];
const HEALTH: Tpl[] = [
  { desc: "CVS/PHARMACY #8842", lo: 12, hi: 65 },
  { desc: "CITY DENTAL CLINIC", lo: 80, hi: 340 },
];
const EDUCATION: Tpl[] = [
  { desc: "UDEMY ONLINE COURSE", lo: 12, hi: 20 },
  { desc: "COURSERA SUBSCRIPTION", lo: 49, hi: 49 },
];

/** Fixed monthly obligations (day, template). */
const MONTHLY: { day: number; desc: string; amount: number; credit?: boolean }[] = [
  { day: 1,  desc: "ACH SALARY NORTHWIND SOFTWARE PAYROLL", amount: 7400, credit: true },
  { day: 2,  desc: "RENT PAYMENT GREENLEAF PROPERTY MGMT", amount: 2100 },
  { day: 3,  desc: "AUTO LOAN EMI CAPITAL FINANCE", amount: 415 },
  { day: 5,  desc: "STATE FARM INSURANCE PREMIUM", amount: 168 },
  { day: 5,  desc: "NETFLIX.COM SUBSCRIPTION", amount: 15.49 },
  { day: 7,  desc: "SPOTIFY USA SUBSCRIPTION", amount: 11.99 },
  { day: 9,  desc: "COMCAST XFINITY INTERNET", amount: 79.99 },
  { day: 11, desc: "VERIZON WIRELESS PHONE BILL", amount: 92.4 },
  { day: 14, desc: "CITY ELECTRIC UTILITY BILL", amount: 0 },      // varies, filled below
  { day: 15, desc: "VANGUARD INVEST SIP TRANSFER", amount: 800 },
  { day: 18, desc: "PLANET FITNESS MEMBERSHIP", amount: 24.99 },
  { day: 21, desc: "APPLE.COM/BILL ICLOUD", amount: 9.99 },
  { day: 26, desc: "ZELLE TRANSFER TO SAVINGS 8814", amount: 500 },
];

export function generateDemoTransactions(): Transaction[] {
  const rows: Omit<Transaction, "category" | "merchant">[] = [];
  let id = 0;
  const start = new Date(2025, 3, 1);        // Apr 2025
  const end = new Date(2026, 6, 15);         // Jul 15 2026
  let balance = 12400;

  const add = (date: Date, desc: string, amount: number, credit: boolean) => {
    const debit = credit ? 0 : amount;
    const creditAmt = credit ? amount : 0;
    balance += creditAmt - debit;
    rows.push({
      id: `demo-${id++}`,
      date: date.toISOString().slice(0, 10),
      description: desc,
      amount: creditAmt - debit,
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(creditAmt * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      accountNumber: ACCOUNT,
      bankName: BANK,
      type: credit ? "credit" : "debit",
      statementId: "demo",
    });
  };

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDate();
    const dow = d.getDay();
    const month = d.getMonth();

    // Fixed obligations
    for (const m of MONTHLY) {
      if (m.day !== day) continue;
      let amt = m.amount;
      if (m.desc.startsWith("CITY ELECTRIC")) amt = between(70, 190) + (month >= 5 && month <= 8 ? 60 : 0);
      // Salary raise in Jan 2026
      if (m.credit && d >= new Date(2026, 0, 1)) amt = 8100;
      add(new Date(d), m.desc, amt, !!m.credit);
    }

    // Variable daily activity — weekends busier
    const activity = (dow === 0 || dow === 6 ? 0.85 : 0.55) * (month === 11 ? 1.35 : 1);
    if (rand() < activity) add(new Date(d), pick(RESTAURANTS).desc, between(6, 60), false);
    if (rand() < 0.28) { const t = pick(GROCERY); add(new Date(d), t.desc, between(t.lo, t.hi), false); }
    if (rand() < 0.18) { const t = pick(SHOPPING); add(new Date(d), t.desc, between(t.lo, t.hi), false); }
    if (rand() < 0.16) { const t = pick(FUEL); add(new Date(d), t.desc, between(t.lo, t.hi), false); }
    if (rand() < 0.07) { const t = pick(ENTERTAINMENT_ONE_OFF); add(new Date(d), t.desc, between(t.lo, t.hi), false); }
    if (rand() < 0.09) { const t = pick(TRAVEL.slice(0, 2)); add(new Date(d), t.desc, between(t.lo, t.hi), false); }
    if (rand() < 0.035) { const t = pick(HEALTH); add(new Date(d), t.desc, between(t.lo, t.hi), false); }
    if (rand() < 0.03) { const t = pick(EDUCATION); add(new Date(d), t.desc, between(t.lo, t.hi), false); }
    if (rand() < 0.045) add(new Date(d), "ATM CASH WITHDRAWAL BR#2210", pick([40, 60, 80, 100, 200]), false);
    if (rand() < 0.02) add(new Date(d), "MOBILE CHECK DEPOSIT", between(50, 400), true);
    if (rand() < 0.015) add(new Date(d), "VENMO PAYMENT RECEIVED", between(20, 180), true);

    // Occasional big trips (summer + December)
    if ((month === 5 || month === 11) && day === 12) {
      add(new Date(d), "DELTA AIR 0062341998821", between(260, 520), false);
      add(new Date(d), "AIRBNB HMQ84K", between(300, 640), false);
    }
    // Anomaly seeds: one-off spikes the anomaly detector should flag
    if (d.getFullYear() === 2026 && month === 2 && day === 19) add(new Date(d), "CITY DENTAL CLINIC ROOT CANAL", 1240, false);
    if (d.getFullYear() === 2025 && month === 9 && day === 8) add(new Date(d), "IKEA HOME SHOPPING", 1130, false);
    // Duplicate seed
    if (d.getFullYear() === 2026 && month === 4 && day === 6) {
      add(new Date(d), "NIKE.COM ORDER", 129.99, false);
      add(new Date(d), "NIKE.COM ORDER", 129.99, false);
    }
  }

  return rows.map(enrich);
}
