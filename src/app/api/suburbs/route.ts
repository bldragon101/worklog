import { NextRequest, NextResponse } from "next/server";
import vicSuburbs from "@/lib/data/vic-suburbs.json";

interface VicSuburb {
  name: string;
  postcode: string;
}

interface SuburbResult {
  value: string;
  label: string;
  postcode: number;
  name: string;
}

const MAX_RESULTS = 50;

// Local VIC suburb dataset (sourced from the public-domain
// matthewproctor/australianpostcodes dataset, filtered to Victorian delivery
// areas). Searching locally keeps lookups instant and offline, avoiding the
// dead external postcode API that previously caused ~40s hangs and 500s.
const suburbs = vicSuburbs as VicSuburb[];

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json([]);
  }

  const normalisedQuery = query.trim().toLowerCase();
  const isNumericQuery = /^\d+$/.test(normalisedQuery);

  // Rank prefix matches ahead of substring matches so the most relevant
  // suburbs surface first, then cap the payload for a snappy dropdown.
  const prefixMatches: VicSuburb[] = [];
  const substringMatches: VicSuburb[] = [];

  for (const suburb of suburbs) {
    const name = suburb.name.toLowerCase();
    const matchesName = name.includes(normalisedQuery);
    const matchesPostcode =
      isNumericQuery && suburb.postcode.startsWith(normalisedQuery);

    if (!matchesName && !matchesPostcode) {
      continue;
    }

    if (name.startsWith(normalisedQuery) || matchesPostcode) {
      prefixMatches.push(suburb);
    } else {
      substringMatches.push(suburb);
    }
  }

  const results: SuburbResult[] = [...prefixMatches, ...substringMatches]
    .slice(0, MAX_RESULTS)
    .map((suburb) => ({
      value: suburb.name,
      label: `${suburb.name}, VIC ${suburb.postcode}`,
      postcode: Number(suburb.postcode),
      name: suburb.name,
    }));

  return NextResponse.json(results);
}
