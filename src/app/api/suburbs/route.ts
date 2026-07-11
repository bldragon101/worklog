import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { createRateLimiter, rateLimitConfigs } from "@/lib/rate-limit";
import vicSuburbs from "@/lib/data/vic-suburbs.json";

const rateLimit = createRateLimiter(rateLimitConfigs.general);

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

export async function GET(request: NextRequest) {
  // SECURITY: Apply rate limiting (kept first so its headers can be attached to
  // every response, including early validation and empty-result responses).
  const rateLimitResult = rateLimit(request);
  if (rateLimitResult instanceof NextResponse) {
    return rateLimitResult;
  }

  // SECURITY: Check authentication.
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    for (const [key, value] of Object.entries(rateLimitResult.headers)) {
      authResult.headers.set(key, value);
    }
    return authResult;
  }

  // Apply rate-limit headers uniformly to every JSON response.
  const respond = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: rateLimitResult.headers });

  // Validate the query. Missing or too-short queries return an empty list so
  // the combobox simply shows no results rather than surfacing an error.
  const parsedQuery = querySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
  });
  if (!parsedQuery.success) {
    return respond([]);
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

  return respond(results);
}
