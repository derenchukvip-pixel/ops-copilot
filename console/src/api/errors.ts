/**
 * The console distinguishes three failure shapes because the operator needs three
 * different sentences, not one "Something went wrong".
 */

/** The request never reached the API: server down, wrong base URL, CORS, offline. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super("Could not reach the API");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

/** The API answered with a non-2xx status. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * 409 from approve/reject. The backend raises `PendingActionAlreadyReviewedException`
 * when the atomic `transitionIfPending` UPDATE matches no row, which means the action
 * left PENDING between the operator loading the queue and clicking the button. This is
 * an expected outcome in a two-operator setup, not a bug, and gets its own message.
 */
export class AlreadyReviewedError extends ApiError {
  constructor(message: string) {
    super(409, message);
    this.name = "AlreadyReviewedError";
  }
}

/** The requested ticket or action does not exist. */
export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(404, message);
    this.name = "NotFoundError";
  }
}
