/**
 * Shared client-side helpers for calling the app's JSON API routes.
 */

/**
 * Error thrown by fetchJson when the server responds with a non-ok status.
 * Carries the HTTP status so React Query can skip retries on client errors.
 */
export class ApiError extends Error {
  status: number;

  constructor({ message, status }: { message: string; status: number }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readErrorMessage({
  response,
  fallbackMessage,
}: {
  response: Response;
  fallbackMessage: string;
}): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string" &&
      body.error
    ) {
      return body.error;
    }
  } catch {
    // The body was not JSON; fall back to the generic message
  }
  return fallbackMessage;
}

/**
 * Fetch a URL and parse the JSON response.
 * Throws an ApiError carrying the server's `error` message (or the fallback
 * message) when the response is not ok.
 */
export async function fetchJson<T>({
  url,
  init,
  fallbackMessage = "Request failed",
}: {
  url: string;
  init?: RequestInit;
  fallbackMessage?: string;
}): Promise<T> {
  const response = init ? await fetch(url, init) : await fetch(url);
  if (!response.ok) {
    const message = await readErrorMessage({ response, fallbackMessage });
    throw new ApiError({ message, status: response.status });
  }
  return (await response.json()) as T;
}
