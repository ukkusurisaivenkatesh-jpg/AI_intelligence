import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

describe("API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves backend status and detail for failed API responses", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: "Administrator role required" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    )));

    await expect(api.admin()).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "Administrator role required",
    });
  });

  it("reports network failures as service connectivity errors", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(api.admin()).rejects.toBeInstanceOf(ApiError);
    await expect(api.admin()).rejects.toMatchObject({ status: 0 });
  });
});
