import { AlreadyReviewedError, ApiError, NetworkError, NotFoundError } from "./errors";
import type { OpsApi } from "./ops-api";
import type {
  ApiErrorBody,
  AuditLogEntry,
  MetricsSummary,
  PendingAction,
  Ticket,
} from "./types";

/**
 * Talks to a running ops-copilot instance.
 *
 * Note that the browser reaching this backend at all requires the API to allow the
 * console's origin — see `WebCorsConfig` on the Java side. Without it every call here
 * fails as a NetworkError with nothing but an opaque CORS message in the console, which
 * is exactly why the error state names the base URL it tried.
 */
export class HttpOpsApi implements OpsApi {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    // A trailing slash would produce `//api/...`, which some proxies treat as a
    // different path than the one Spring maps.
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async listPendingActions(signal?: AbortSignal): Promise<PendingAction[]> {
    return this.request<PendingAction[]>("/api/pending-actions?status=PENDING", { signal });
  }

  async approve(id: number, reviewedBy: string): Promise<void> {
    await this.request<void>(`/api/pending-actions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewedBy }),
      expectEmptyBody: true,
    });
  }

  async reject(id: number, reason: string, reviewedBy: string): Promise<void> {
    await this.request<void>(`/api/pending-actions/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, reviewedBy }),
      expectEmptyBody: true,
    });
  }

  async getTicket(id: number, signal?: AbortSignal): Promise<Ticket> {
    return this.request<Ticket>(`/api/tickets/${id}`, { signal });
  }

  async getAuditLog(id: number, signal?: AbortSignal): Promise<AuditLogEntry[]> {
    return this.request<AuditLogEntry[]>(`/api/tickets/${id}/audit-log`, { signal });
  }

  async getMetrics(signal?: AbortSignal): Promise<MetricsSummary> {
    return this.request<MetricsSummary>("/api/metrics/summary", { signal });
  }

  private async request<T>(
    path: string,
    init: RequestInit & { expectEmptyBody?: boolean } = {},
  ): Promise<T> {
    const { expectEmptyBody, ...requestInit } = init;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, requestInit);
    } catch (cause) {
      // An aborted request is the caller unmounting, not a failure worth showing.
      if (cause instanceof DOMException && cause.name === "AbortError") {
        throw cause;
      }
      throw new NetworkError(cause);
    }

    if (!response.ok) {
      throw await toError(response);
    }

    if (expectEmptyBody) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

/**
 * Turns a non-2xx response into the most specific error we have. The message from
 * `GlobalExceptionHandler` is preferred when present because it names the actual
 * ticket or action id; the generic fallback is only for responses that are not our
 * ErrorResponse shape at all (a proxy's 502 page, say).
 */
async function toError(response: Response): Promise<ApiError> {
  let message = `${response.status} ${response.statusText}`.trim();

  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (typeof body?.message === "string" && body.message.length > 0) {
      message = body.message;
    }
  } catch {
    // Body was not JSON. The status line is all we have; keep it.
  }

  if (response.status === 409) {
    return new AlreadyReviewedError(message);
  }
  if (response.status === 404) {
    return new NotFoundError(message);
  }
  return new ApiError(response.status, message);
}
