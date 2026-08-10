import { DemoOpsApi } from "./demo-ops-api";
import { HttpOpsApi } from "./http-ops-api";
import type { OpsApi } from "./ops-api";

export type DataSource = "demo" | "live";

/**
 * Which backend the console talks to is fixed at build time, not toggled at runtime.
 *
 * That is the point: the build published to GitHub Pages is a demo build, and a demo build
 * contains no code path that can reach a real API. There is no query parameter or hidden
 * setting that flips it, so a public URL cannot be pointed at someone's live agent — or at an
 * Anthropic key — by anyone who reads the source.
 */
export const DATA_SOURCE: DataSource =
  process.env.NEXT_PUBLIC_DATA_SOURCE === "live" ? "live" : "demo";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const IS_DEMO = DATA_SOURCE === "demo";

let instance: OpsApi | null = null;

/**
 * One client for the whole app. The demo client holds the dataset, so handing out a fresh
 * instance per screen would mean approving something on the queue and finding it still pending
 * on the ticket page.
 */
export function getOpsApi(): OpsApi {
  if (instance === null) {
    instance = IS_DEMO ? new DemoOpsApi() : new HttpOpsApi(API_BASE_URL);
  }
  return instance;
}

/** Non-null only in a demo build; the demo banner's controls are the only caller. */
export function getDemoApi(): DemoOpsApi | null {
  const api = getOpsApi();
  return api instanceof DemoOpsApi ? api : null;
}

/**
 * A live build with no base URL configured cannot work, and the failure would otherwise show
 * up as a confusing request to the console's own origin. The queue screen checks this first
 * and explains what is missing instead.
 */
export function liveConfigError(): string | null {
  if (IS_DEMO) {
    return null;
  }
  if (API_BASE_URL.trim() === "") {
    return "NEXT_PUBLIC_API_BASE_URL is not set.";
  }
  return null;
}

export type { OpsApi } from "./ops-api";
