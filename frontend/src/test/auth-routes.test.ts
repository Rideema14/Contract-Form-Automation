import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import {
  GET as proxyGet,
  POST as proxyPost,
} from "@/app/api/[...path]/route";

const originalApiUrl = process.env.API_BASE_URL;

function request(
  path: string,
  method: string,
  headers: Record<string, string> = {},
  body?: string,
) {
  return new NextRequest(`https://app.example.test${path}`, {
    method,
    headers,
    body,
  });
}

function routeContext(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.API_BASE_URL;
  else process.env.API_BASE_URL = originalApiUrl;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("dedicated authentication routes", () => {
  it("logs in via the backend and forwards only the session cookie", async () => {
    process.env.API_BASE_URL = "https://api.example.test/api";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { user: { id: "u1" } } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "contract_token=jwt.value; Path=/; HttpOnly; SameSite=Lax",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await login(
      request(
        "/api/auth/login",
        "POST",
        {
          Origin: "https://app.example.test",
          Cookie: "unrelated=secret",
          "Content-Type": "application/json",
        },
        JSON.stringify({ email: "user@example.test", password: "pass" }),
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("contract_token=jwt.value");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "user@example.test", password: "pass" }),
      }),
    );
    expect(new Headers(fetchMock.mock.calls[0][1].headers).has("cookie")).toBe(false);
  });

  it("forwards Azure-proxied login requests despite Next.js using an internal URL", async () => {
    process.env.API_BASE_URL = "https://api.example.test/api";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, user: { id: "u1" } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "contract_token=jwt.value; Path=/; HttpOnly; SameSite=Lax",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const publicHost = "contract-forms-frontend-261126.azurewebsites.net";
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEBSITE_HOSTNAME", publicHost);

    const response = await login(
      new NextRequest("https://localhost:8080/api/auth/login", {
        method: "POST",
        headers: {
          Host: publicHost,
          Origin: `https://${publicHost}`,
          Referer: `https://${publicHost}/login`,
          "X-Forwarded-Proto": "https",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: "user@example.test", password: "pass" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("checks /me with only contract_token and clears invalid sessions", async () => {
    process.env.API_BASE_URL = "https://api.example.test/api";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ success: false, message: "Unauthorized" }, { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await me(
      request("/api/auth/me", "GET", {
        Cookie: "theme=dark; contract_token=expired.jwt; other=private",
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("contract_token=");
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("cookie")).toBe(
      "contract_token=expired.jwt",
    );
  });

  it("rejects missing cookies, clears stale browser cookies, and avoids backend calls", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await me(request("/api/auth/me", "GET", { Cookie: "theme=dark" }));

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs out with only the session cookie and clears it in the response", async () => {
    process.env.API_BASE_URL = "https://api.example.test/api";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ success: true, message: "Logged out" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await logout(
      request("/api/auth/logout", "POST", {
        Origin: "https://app.example.test",
        Cookie: "other=private; contract_token=jwt.value",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("cookie")).toBe(
      "contract_token=jwt.value",
    );
  });

  it("supports bodyless logout responses", async () => {
    process.env.API_BASE_URL = "https://api.example.test/api";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const response = await logout(
      request("/api/auth/logout", "POST", {
        Origin: "https://app.example.test",
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects cross-origin authentication and invalid backend URLs", async () => {
    process.env.API_BASE_URL = "https://api.example.test/api";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const crossOrigin = await login(
      request(
        "/api/auth/login",
        "POST",
        { Origin: "https://attacker.example", "Content-Type": "application/json" },
        JSON.stringify({ email: "user@example.test", password: "pass" }),
      ),
    );
    expect(crossOrigin.status).toBe(403);

    process.env.API_BASE_URL = "http://api.example.test/api";
    const invalidUrl = await login(
      request(
        "/api/auth/login",
        "POST",
        { Origin: "https://app.example.test", "Content-Type": "application/json" },
        JSON.stringify({ email: "user@example.test", password: "pass" }),
      ),
    );
    expect(invalidUrl.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("catch-all API proxy", () => {
  it("preserves query strings and forwards only the session cookie", async () => {
    process.env.API_BASE_URL = "https://api.example.test/api";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ success: true, data: [] }, { headers: { ETag: '"item-list"' } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyPost(
      request(
        "/api/forms?status=draft&page=2",
        "POST",
        {
          Origin: "https://app.example.test",
          Cookie: "unrelated=private; contract_token=jwt.value",
          Authorization: "Bearer browser-token",
          "Content-Type": "application/json",
        },
        JSON.stringify({ name: "form" }),
      ),
      routeContext(["forms"]),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"item-list"');
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.example.test/api/forms?status=draft&page=2");
    expect(new Headers(options.headers).get("cookie")).toBe("contract_token=jwt.value");
    expect(new Headers(options.headers).has("authorization")).toBe(false);
    expect(options.body).toBeInstanceOf(ReadableStream);
  });

  it.each([[".."], ["%2e%2e"], ["%252e%252e"]])(
    "rejects path traversal segment %s before backend fetch",
    async (segment) => {
      process.env.API_BASE_URL = "https://api.example.test/api";
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const response = await proxyPost(
        request("/api/%2e%2e", "POST", { Origin: "https://app.example.test" }),
        routeContext([segment]),
      );

      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects cross-origin mutations and reports unavailable backends", async () => {
    process.env.API_BASE_URL = "https://api.example.test/api";
    const fetchMock = vi.fn().mockRejectedValue(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);

    const crossOrigin = await proxyPost(
      request("/api/forms", "POST", { Origin: "https://attacker.example" }),
      routeContext(["forms"]),
    );
    expect(crossOrigin.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();

    const unavailable = await proxyPost(
      request("/api/forms", "POST", { Origin: "https://app.example.test" }),
      routeContext(["forms"]),
    );
    expect(unavailable.status).toBe(502);
  });

  it("preserves empty-body statuses and does not expose backend redirects", async () => {
    process.env.API_BASE_URL = "https://api.example.test/api";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 205 }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "https://api.example.test/private" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const noContent = await proxyPost(
      request("/api/forms", "POST", { Origin: "https://app.example.test" }),
      routeContext(["forms"]),
    );
    expect(noContent.status).toBe(204);

    const resetContent = await proxyPost(
      request("/api/forms", "POST", { Origin: "https://app.example.test" }),
      routeContext(["forms"]),
    );
    expect(resetContent.status).toBe(205);
    expect(resetContent.body).toBeNull();

    const notModified = await proxyPost(
      request("/api/forms", "POST", { Origin: "https://app.example.test" }),
      routeContext(["forms"]),
    );
    expect(notModified.status).toBe(304);
    expect(notModified.body).toBeNull();

    const redirect = await proxyPost(
      request("/api/forms", "POST", { Origin: "https://app.example.test" }),
      routeContext(["forms"]),
    );
    expect(redirect.status).toBe(302);
    expect(redirect.headers.has("location")).toBe(false);
  });

  it("supports HEAD and OPTIONS methods without request or response bodies", async () => {
    process.env.API_BASE_URL = "https://api.example.test/api";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { ETag: '"item"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204, headers: { Allow: "GET, POST" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { HEAD, OPTIONS } = await import("@/app/api/[...path]/route");

    const headResponse = await HEAD(
      request("/api/forms", "HEAD"),
      routeContext(["forms"]),
    );
    const optionsResponse = await OPTIONS(
      request("/api/forms", "OPTIONS"),
      routeContext(["forms"]),
    );

    expect(headResponse.status).toBe(200);
    expect(headResponse.body).toBeNull();
    expect(headResponse.headers.get("etag")).toBe('"item"');
    expect(optionsResponse.status).toBe(204);
    expect(optionsResponse.headers.get("allow")).toBe("GET, POST");
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    expect(fetchMock.mock.calls[1][1].body).toBeUndefined();
  });

  it("streams downloads and preserves download response headers", async () => {
    process.env.API_BASE_URL = "https://api.example.test/api";
    const upstream = new Response(new Blob(["download bytes"]), {
      status: 206,
      headers: {
        "Content-Disposition": 'attachment; filename="report.pdf"',
        "Content-Range": "bytes 0-14/15",
        "Content-Type": "application/pdf",
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream));

    const response = await proxyGet(
      request("/api/files/download", "GET", { Range: "bytes=0-14" }),
      routeContext(["files", "download"]),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-disposition")).toContain("report.pdf");
    expect(response.headers.get("content-range")).toBe("bytes 0-14/15");
    expect(await response.text()).toBe("download bytes");
  });
});
