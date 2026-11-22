import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, currentAcademicYear } from "./api";

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

  it("shows field validation messages without echoing submitted values", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        detail: [{ loc: ["body", "password"], msg: "String should have at least 12 characters", input: "sensitive-value" }],
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    )));

    await expect(api.register("Student", "student@example.edu", "sensitive-value")).rejects.toMatchObject({
      status: 422,
      message: "Please check: password: String should have at least 12 characters",
    });
  });

  it("uses the current Indian academic year without reusing a previous year", () => {
    expect(currentAcademicYear(new Date(2026, 0, 15))).toBe("2025-26");
    expect(currentAcademicYear(new Date(2026, 7, 15))).toBe("2026-27");
  });
});
