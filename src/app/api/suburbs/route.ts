import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api-route";
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

// Search query: at least 2 trimmed characters. Shorter or absent queries are
// treated as "no search" and yield an empty list rather than an error.
const querySchema = z.object({
  q: z.string().trim().min(2),
});

// Local VIC suburb dataset (sourced from the public-domain
// matthewproctor/australianpostcodes dataset, filtered to Victorian delivery
// areas). Searching locally keeps lookups instant and offline, avoiding the
// dead external postcode API that previously caused ~40s hangs and 500s.
const suburbs = vicSuburbs as VicSuburb[];

// Build a stable, unique, lowercase option value from the suburb name and
// postcode so duplicate suburb names (e.g. Melbourne 3000 vs 3004, or
// Amphitheatre across postcodes) stay distinguishable in the combobox.
// Lowercase keeps it consistent with cmdk, which lowercases item values.
function buildOptionValue({ name, postcode }: VicSuburb): string {
  return `${name.toLowerCase().replace(/\s+/g, "-")}-vic-${postcode}`;
}

export const GET = apiRoute({
  auth: "user",
  errorMessage: "Error searching suburbs",
  handler: async ({ request }) => {
    // Validate the query. Missing or too-short queries return an empty list so
    // the combobox simply shows no results rather than surfacing an error.
    const parsedQuery = querySchema.safeParse({
      q: request.nextUrl.searchParams.get("q") ?? "",
    });
    if (!parsedQuery.success) {
      return NextResponse.json([]);
    }

    const normalisedQuery = parsedQuery.data.q.toLowerCase();
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
        value: buildOptionValue(suburb),
        label: `${suburb.name}, VIC ${suburb.postcode}`,
        postcode: Number(suburb.postcode),
        name: suburb.name,
      }));

    return NextResponse.json(results);
  },
});
