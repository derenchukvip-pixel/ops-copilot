import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlreadyReviewedError, ApiError, NetworkError, NotFoundError } from "./errors";
import { HttpOpsApi } from "./http-ops-api";

/**
 * The client that talks to a real ops-copilot.
 *
 * These tests stand in for an end-to-end run against a live backend, which needs Postgres and
 * an Anthropic key. What they pin down is everything that can be wrong without either: the exact
 * request the console sends, and what it makes of every response shape the API can return —
 * including the two error statuses the UI branches on.
 */

const BASE = "http://localhost:8080";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** `GlobalExceptionHandler` renders every handled failure as this shape. */
function errorResponse(status: number, error: string, message: string): Response {
  return jsonResponse(
    { timestamp: "2026-01-15T10:00:00Z", status, error, message, details: [] },
    status,
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastCall(): [string, RequestInit] {
  const call = fetchMock.mock.calls.at(-1);
  return [call?.[0] as string, (call?.[1] ?? {}) as RequestInit];
}

describe("request construction", () => {
  it("asks only for pending actions", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await new HttpOpsApi(BASE).listPendingActions();

    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/pending-actions?status=PENDING`);
    expect(init.method).toBeUndefined(); // GET
  });

  it("sends the reviewer with an approval", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await new HttpOpsApi(BASE).approve(7, "ops-jane");

    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/pending-actions/7/approve`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ reviewedBy: "ops-jane" });
  });

  /* `RejectActionRequest.reason` is @NotBlank — omitting it would be a 400, not a rejection. */
  it("sends both the reason and the reviewer with a rejection", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await new HttpOpsApi(BASE).reject(7, "Not owed", "ops-jane");

    const [url, init] = lastCall();
    expect(url).toBe(`${BASE}/api/pending-actions/7/reject`);
    expect(JSON.parse(init.body as string)).toEqual({
      reason: "Not owed",
      reviewedBy: "ops-jane",
    });
  });

  it("builds the ticket and audit-log paths", async () => {
    const api = new HttpOpsApi(BASE);

    fetchMock.mockResolvedValue(jsonResponse({}));
    await api.getTicket(4);
    expect(lastCall()[0]).toBe(`${BASE}/api/tickets/4`);

    fetchMock.mockResolvedValue(jsonResponse([]));
    await api.getAuditLog(4);
    expect(lastCall()[0]).toBe(`${BASE}/api/tickets/4/audit-log`);

    fetchMock.mockResolvedValue(jsonResponse({}));
    await api.getMetrics();
    expect(lastCall()[0]).toBe(`${BASE}/api/metrics/summary`);
  });

  /*
   * A base URL pasted from a browser address bar ends in a slash. `//api/...` is a different
   * path to some proxies than the one Spring maps, so the difference cannot be left to chance.
   */
  it("normalises a trailing slash on the base URL", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await new HttpOpsApi("http://localhost:8080///").listPendingActions();

    expect(lastCall()[0]).toBe(`${BASE}/api/pending-actions?status=PENDING`);
  });

  /*
   * approve and reject are `void` on the Java side: 200 with an empty body. Calling
   * `response.json()` on that throws, and the operator would see a failure for a write that
   * actually succeeded — the worst possible direction for this error to point.
   */
  it("does not try to parse a body that is not there", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await expect(new HttpOpsApi(BASE).approve(7, "ops-jane")).resolves.toBeUndefined();
  });
});

describe("response handling", () => {
  it("returns the parsed payload on success", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ totalTickets: 7, averageResolutionSeconds: null }),
    );

    await expect(new HttpOpsApi(BASE).getMetrics()).resolves.toMatchObject({
      totalTickets: 7,
      averageResolutionSeconds: null,
    });
  });

  /*
   * 409 is the atomic `transitionIfPending` UPDATE matching no row — someone reviewed the action
   * first. The queue treats this differently from every other failure: the card stays gone. It
   * has to arrive as its own type for that branch to be reachable at all.
   */
  it("maps 409 to AlreadyReviewedError", async () => {
    fetchMock.mockResolvedValue(
      errorResponse(409, "Conflict", "PendingAction 7 has already been reviewed"),
    );

    const error = await new HttpOpsApi(BASE).approve(7, "ops-jane").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AlreadyReviewedError);
    expect((error as ApiError).message).toBe("PendingAction 7 has already been reviewed");
  });

  it("maps 404 to NotFoundError", async () => {
    fetchMock.mockResolvedValue(errorResponse(404, "Not Found", "Ticket 999 not found"));

    const error = await new HttpOpsApi(BASE).getTicket(999).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotFoundError);
    expect((error as ApiError).status).toBe(404);
  });

  /* The handler's message names the actual ticket or action; the status line does not. */
  it("prefers the API's own message on other errors", async () => {
    fetchMock.mockResolvedValue(
      errorResponse(400, "Validation Failed", "Request payload is invalid"),
    );

    const error = await new HttpOpsApi(BASE)
      .reject(7, "", "ops-jane")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).message).toBe("Request payload is invalid");
  });

  /* A proxy's 502 page is HTML. Parsing it must not turn a real failure into a crash. */
  it("falls back to the status line when the error body is not our shape", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>Bad Gateway</html>", { status: 502, statusText: "Bad Gateway" }),
    );

    const error = await new HttpOpsApi(BASE).getMetrics().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).message).toContain("502");
  });

  /*
   * A blocked CORS preflight and a backend that is simply down are indistinguishable here —
   * both reject the fetch itself. The error state names the base URL for exactly that reason.
   */
  it("reports a failed fetch as a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(new HttpOpsApi(BASE).listPendingActions()).rejects.toBeInstanceOf(NetworkError);
  });

  /*
   * An abort is the caller unmounting, not a failure. Wrapping it as a NetworkError would put
   * "can't reach the API" on screen every time an operator navigated away mid-request.
   */
  it("lets an abort through untouched", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted", "AbortError"));

    const error = await new HttpOpsApi(BASE).listPendingActions().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe("AbortError");
    expect(error).not.toBeInstanceOf(NetworkError);
  });

  it("passes the abort signal down to fetch", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(jsonResponse([]));

    await new HttpOpsApi(BASE).listPendingActions(controller.signal);
    expect(lastCall()[1].signal).toBe(controller.signal);
  });
});
