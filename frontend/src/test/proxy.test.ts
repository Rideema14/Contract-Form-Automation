import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("page authentication proxy", () => {
  it("allows the deploy info marker without authentication", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxy(
      new NextRequest("https://app.example.test/deploy-info.json"),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks the session with the backend, not through the internal request URL", async () => {
    vi.stubEnv("API_BASE_URL", "https://api.example.test/api");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxy(
      new NextRequest("https://localhost:8080/dashboard", {
        headers: { Cookie: "theme=dark; contract_token=jwt.value; private=secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.example.test/api/auth/me",
    );
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("cookie")).toBe(
      "contract_token=jwt.value",
    );
  });

  it("redirects without calling the backend when there is no session cookie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxy(new NextRequest("https://app.example.test/dashboard"));

    expect(response.status).toBe(307);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the session cookie when the backend is unreachable", async () => {
    vi.stubEnv("API_BASE_URL", "https://api.example.test/api");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await proxy(
      new NextRequest("https://app.example.test/dashboard", {
        headers: { Cookie: "contract_token=jwt.value" },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("redirects unauthenticated pages and clears an invalid session cookie", async () => {
    vi.stubEnv("API_BASE_URL", "https://api.example.test/api");
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
