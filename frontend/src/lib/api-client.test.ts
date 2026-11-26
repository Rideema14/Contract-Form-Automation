import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiRequest body handling", () => {
  it("serializes JSON payloads and preserves JSON content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ success: true, data: { id: "created" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiRequest<{ id: string }>("/forms", {
        method: "POST",
        body: { name: "Example" },
      }),
    ).resolves.toEqual({ id: "created" });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBe(JSON.stringify({ name: "Example" }));
    expect(new Headers(options.headers).get("content-type")).toBe("application/json");
    expect(options.credentials).toBe("include");
  });

  it("passes FormData through without setting Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ success: true, data: { uploaded: true } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const formData = new FormData();
    formData.append("title", "attachment");

    await expect(
      apiRequest<{ uploaded: boolean }>("/forms/1/attachments", {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      }),
    ).resolves.toEqual({ uploaded: true });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBe(formData);
    expect(new Headers(options.headers).has("content-type")).toBe(false);
  });
});
