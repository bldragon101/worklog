/**
 * An expected failure a handler can throw to respond with the given status
 * and `{ error: message }`, plus any extra body fields.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor({
    status,
    message,
    body = {},
  }: {
    status: number;
    message: string;
    body?: Record<string, unknown>;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}
