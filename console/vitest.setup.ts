import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  // Guarded because a jsdom document can be created without either store, which is the same
  // condition the app code has to survive in a locked-down browser.
  window.sessionStorage?.clear();
  window.localStorage?.clear();
});
