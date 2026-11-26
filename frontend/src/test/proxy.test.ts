import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("page authentication proxy", () => {
  it("uses the same-origin /api/auth/me route and forwards only contract_token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxy(
      new NextRequest("https://app.example.test/dashboard", {
        headers: { Cookie: "theme=dark; contract_token=jwt.value; private=secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://app.example.test/api/auth/me",
    );
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("cookie")).toBe(
      "contract_token=jwt.value",
    );
  });

  it("redirects unauthenticated pages and clears an invalid session cookie", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxy(
      new NextRequest("https://app.example.test/dashboard", {
        headers: { Cookie: "contract_token=expired.jwt" },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.test/login");
    expect(response.headers.get("set-cookie")).toContain("contract_token=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
