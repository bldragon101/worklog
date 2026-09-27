#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL =
  "https://raw.githubusercontent.com/matthewproctor/australianpostcodes/master/australian_postcodes.csv";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUBURBS_PATH = join(ROOT, "src/lib/data/vic-suburbs.json");
const OUTPUT_PATH = join(ROOT, "src/lib/data/vic-regional-suburbs.json");

const MANUAL_REGIONS = {
  "aintree|3336": "metro",
  "deanside|3336": "metro",
  "fraser rise|3336": "metro",
  "st helier|3989": "regional",
  "winter valley|3358": "regional",
};

function parseCsvLine({ line }) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function isMetroSa4({ sa4Name }) {
  return sa4Name.startsWith("Melbourne - ") || sa4Name === "Mornington Peninsula";
}

/**
 * Generates src/lib/data/vic-regional-suburbs.json: the lowercase names of
 * suburbs in src/lib/data/vic-suburbs.json that sit outside Greater Melbourne.
 *
 * Classification uses the ABS SA4 region from the public-domain
 * matthewproctor/australianpostcodes dataset (the same source as
 * vic-suburbs.json). Greater Melbourne is every "Melbourne - *" SA4 plus
 * "Mornington Peninsula". Names that are metro under one postcode and regional
 * under another are left out, because jobs store suburb names without
 * postcodes.
 *
 * Usage: node scripts/generate-regional-suburbs.mjs
 */
async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to download postcode dataset: ${response.status}`);
  }
  const lines = (await response.text()).split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine({ line: lines[0] });
  const col = ({ name }) => header.indexOf(name);
  const [localityCol, postcodeCol, stateCol, sa4Col] = [
    col({ name: "locality" }),
    col({ name: "postcode" }),
    col({ name: "state" }),
    col({ name: "sa4name" }),
  ];

  const sa4ByKey = new Map();
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine({ line });
    if (fields[stateCol] !== "VIC" || !fields[sa4Col]) continue;
    const key = `${fields[localityCol].toLowerCase()}|${fields[postcodeCol]}`;
    const existing = sa4ByKey.get(key) ?? new Set();
    existing.add(fields[sa4Col]);
    sa4ByKey.set(key, existing);
  }

  const suburbs = JSON.parse(readFileSync(SUBURBS_PATH, "utf8"));
  const regionsByName = new Map();
  const unclassified = [];
  for (const { name, postcode } of suburbs) {
    const key = `${name.toLowerCase()}|${postcode}`;
    const sa4Names = sa4ByKey.get(key);
    let region = MANUAL_REGIONS[key];
    if (!region && sa4Names) {
      const metroFlags = [...sa4Names].map((sa4Name) => isMetroSa4({ sa4Name }));
      if (metroFlags.every(Boolean)) region = "metro";
      else if (!metroFlags.some(Boolean)) region = "regional";
      else region = "mixed";
    }
    if (!region) {
      unclassified.push(key);
      continue;
    }
    const regions = regionsByName.get(name.toLowerCase()) ?? new Set();
    regions.add(region);
    regionsByName.set(name.toLowerCase(), regions);
  }

  if (unclassified.length > 0) {
    throw new Error(
      `Unclassified suburbs, add them to MANUAL_REGIONS: ${unclassified.join(", ")}`,
    );
  }

  const regionalNames = [...regionsByName]
    .filter(([, regions]) => regions.size === 1 && regions.has("regional"))
    .map(([name]) => name)
    .sort();

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(regionalNames)}\n`);
  console.log(`Wrote ${regionalNames.length} regional suburbs to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
