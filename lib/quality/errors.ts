export class ReviewOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message = code,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ReviewOperationError";
  }
}
