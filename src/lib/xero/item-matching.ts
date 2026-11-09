import type { TruckClass } from "@/lib/customer-invoices/types";
import { normaliseRegistration } from "@/lib/tolls/toll-matching";

/**
 * Item code prefixes for each truck class, checked in order: PMCRA (semi
 * crane) before PRIME (semi), as in the Xero item list, e.g. `12TC - 02`,
 * `14TT - 01SUB`, `PRIME MOVER - 02`, `PRIMEMOVER - 03`, `PMCRA - 02SUB`.
 */
const CLASS_PREFIXES: Array<{ prefix: string; truckClass: TruckClass }> = [
  { prefix: "PMCRA", truckClass: "semiCrane" },
  { prefix: "PRIME", truckClass: "semi" },
  { prefix: "12TC", truckClass: "crane" },
  { prefix: "14TT", truckClass: "tray" },
];

function compactCode({ code }: { code: string }): string {
  return code.toUpperCase().replace(/\s+/g, "");
}

/** The truck class an item is for, from its code prefix; null for other items */
export function getItemTruckClass({ code }: { code: string }): TruckClass | null {
  const compact = compactCode({ code });
  if (compact === "TRAY") return "tray";
  return CLASS_PREFIXES.find(({ prefix }) => compact.startsWith(prefix))?.truckClass ?? null;
}

/** Subcontractor items have codes ending in SUB, e.g. `14TT - 01SUB` */
export function isSubcontractorItem({ code }: { code: string }): boolean {
  return compactCode({ code }).endsWith("SUB");
}

/**
 * Registration-like words in an item's code or name: 5 to 7 characters
 * mixing letters and digits, e.g. BNT040 in "BNT040 - DAF CRANE".
 */
export function getRegistrationTokens({ text }: { text: string }): string[] {
  return text
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((token) => token.length >= 5 && token.length <= 7)
    .filter((token) => /[A-Z]/.test(token) && /\d/.test(token));
}

export interface MatchableItem {
  code: string;
  name: string;
}

function byCode(a: MatchableItem, b: MatchableItem): number {
  return a.code.localeCompare(b.code, undefined, { numeric: true });
}

/** The company-truck item whose code or name contains the registration */
export function suggestVehicleItemCode({
  registration,
  items,
}: {
  registration: string;
  items: MatchableItem[];
}): string | null {
  const key = normaliseRegistration({ registration });
  if (!key) return null;
  const match = items
    .filter((item) => !isSubcontractorItem({ code: item.code }))
    .filter((item) =>
      getRegistrationTokens({ text: `${item.code} ${item.name}` }).includes(key),
    )
    .sort(byCode)[0];
  return match?.code ?? null;
}

/** Words that say nothing about which company a name is */
const COMPANY_STOP_WORDS = new Set([
  "pty",
  "ltd",
  "limited",
  "the",
  "and",
  "co",
  "inc",
  "trust",
  "trading",
  "transport",
  "transports",
  "tpt",
  "trans",
  "logistics",
  "haulage",
  "services",
  "group",
  "sub",
  "subbie",
  "subcontractor",
  "subcontractors",
  "contractor",
  "semi",
  "crane",
  "tray",
  "truck",
  "trucks",
  "prime",
  "mover",
]);

const CONTACT_STOP_WORDS = new Set([
  "pty",
  "ltd",
  "limited",
  "the",
  "and",
  "co",
  "inc",
  "trust",
  "trading",
]);

function significantWords({
  value,
  stopWords,
}: {
  value: string;
  stopWords: Set<string>;
}): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0 && !stopWords.has(word));
}

/**
 * How alike two names are, from 0 to 1: the share of significant words they
 * have in common, or 1 when the words run together are the same (BLUEHAWK
 * and Blue Hawk).
 */
export function scoreNameMatch({
  a,
  b,
  stopWords = COMPANY_STOP_WORDS,
}: {
  a: string;
  b: string;
  stopWords?: Set<string>;
}): number {
  const wordsA = significantWords({ value: a, stopWords });
  const wordsB = significantWords({ value: b, stopWords });
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  if (wordsA.join("") === wordsB.join("")) return 1;

  const setB = new Set(wordsB);
  const shared = new Set(wordsA.filter((word) => setB.has(word))).size;
  return shared / Math.max(new Set(wordsA).size, setB.size);
}

/** Names scoring below this are not suggested; an admin confirms every match */
export const NAME_MATCH_THRESHOLD = 0.6;

function bestMatch<T>({
  name,
  candidates,
  nameOf,
  stopWords,
}: {
  name: string;
  candidates: T[];
  nameOf: (candidate: T) => string;
  stopWords?: Set<string>;
}): T | null {
  let best: { candidate: T; score: number } | null = null;
  for (const candidate of candidates) {
    const score = scoreNameMatch({ a: name, b: nameOf(candidate), stopWords });
    if (score >= NAME_MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { candidate, score };
    }
  }
  return best?.candidate ?? null;
}

/**
 * The item of the given class whose name best matches a contractor or
 * subcontractor company, trying subcontractor (SUB) items first.
 */
export function suggestCompanyItemCode({
  companyName,
  truckClass,
  items,
}: {
  companyName: string;
  truckClass: TruckClass;
  items: MatchableItem[];
}): string | null {
  const ofClass = items
    .filter((item) => getItemTruckClass({ code: item.code }) === truckClass)
    .sort(byCode);
  const subItems = ofClass.filter((item) => isSubcontractorItem({ code: item.code }));
  const otherItems = ofClass.filter((item) => !isSubcontractorItem({ code: item.code }));

  const match =
    bestMatch({ name: companyName, candidates: subItems, nameOf: (item) => item.name }) ??
    bestMatch({ name: companyName, candidates: otherItems, nameOf: (item) => item.name });
  return match?.code ?? null;
}

/** The Xero contact whose name best matches a bill to name */
export function suggestContactId({
  billTo,
  contacts,
}: {
  billTo: string;
  contacts: Array<{ contactId: string; name: string }>;
}): string | null {
  const key = billTo.trim().toLowerCase();
  const exact = contacts.find((contact) => contact.name.trim().toLowerCase() === key);
  if (exact) return exact.contactId;
  return (
    bestMatch({
      name: billTo,
      candidates: contacts,
      nameOf: (contact) => contact.name,
      stopWords: CONTACT_STOP_WORDS,
    })?.contactId ?? null
  );
}

/**
 * The `Fuel Levy N%` item for a percentage when Xero has one, otherwise the
 * fallback fuel levy item.
 */
export function getFuelLevyItemCode({
  percent,
  itemCodes,
  fallbackItemCode,
}: {
  percent: number;
  itemCodes: Iterable<string>;
  fallbackItemCode: string | null;
}): string | null {
  for (const code of itemCodes) {
    const match = /^fuel\s*levy\s*(\d+(?:\.\d+)?)\s*%$/i.exec(code.trim());
    if (match && Number(match[1]) === percent) return code;
  }
  return fallbackItemCode;
}
