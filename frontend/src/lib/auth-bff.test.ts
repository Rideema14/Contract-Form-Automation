import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  backendApiBaseUrl,
  getContractTokenCookie,
  isSameOriginRequest,
} from "./auth-bff";

const originalApiUrl = process.env.API_BASE_URL;
const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.API_BASE_URL;
  else process.env.API_BASE_URL = originalApiUrl;
  if (originalPublicApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalPublicApiUrl;
  vi.unstubAllEnvs();
});

describe("backendApiBaseUrl", () => {
  it("accepts HTTPS API URLs and local HTTP only during development", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.API_BASE_URL = "https://api.example.test/api/";
    expect(backendApiBaseUrl()).toBe("https://api.example.test/api");

    vi.stubEnv("NODE_ENV", "development");
    process.env.API_BASE_URL = "http://localhost:4000/api";
    expect(backendApiBaseUrl()).toBe("http://localhost:4000/api");
  });

  it.each([
    "http://api.example.test/api",
    "https://user:password@api.example.test/api",
    "https://@api.example.test/api",
    "https://api.example.test/api/v2",
    "https://api.example.test/api?key=value",
    "https://api.example.test/api?",
    "https://api.example.test/api#fragment",
    "https://api.example.test/api#",
  ])("rejects unsafe backend URL %s", (url) => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.API_BASE_URL = url;
    expect(() => backendApiBaseUrl()).toThrow("configured backend API URL is invalid");
  });
});

describe("production origin check behind a reverse proxy", () => {
  const publicHost = "contract-forms-frontend-261126.azurewebsites.net";
  const publicOrigin = `https://${publicHost}`;
  // What Next.js hands the route on Azure: the URL of its internal listener.
  const internalUrl = "https://localhost:8080/api/auth/login";

  function check(headers: Record<string, string>, url = internalUrl) {
    return isSameOriginRequest(new Request(url, { method: "POST", headers }));
  }

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("WEBSITE_HOSTNAME", publicHost);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it.each<[string, Record<string, string>]>([
    ["public Host and proxy protocol", { Host: publicHost, "X-Forwarded-Proto": "https" }],
    ["an internal Host", { Host: "localhost:8080", "X-Forwarded-Proto": "https" }],
    ["no X-Forwarded-Proto", { Host: publicHost }],
    ["unrelated proxy headers", { Host: "10.0.0.4", "X-Forwarded-Proto": "https, http", "X-Forwarded-Host": "internal" }],
  ])("accepts the public Origin with %s", (_name, headers) => {
    expect(check({ ...headers, Origin: publicOrigin })).toBe(true);
  });

  it("accepts a public Referer when Origin is absent", () => {
    expect(check({ Referer: `${publicOrigin}/login` })).toBe(true);
  });

  it.each([
    "https://attacker.example",
    `http://${publicHost}`,
    `${publicOrigin}.attacker.example`,
    "https://localhost:8080",
    "null",
    "not a url",
    "",
  ])("rejects Origin %j", (origin) => {
    expect(check({ Origin: origin, Referer: `${publicOrigin}/login` })).toBe(false);
  });

  it.each(["https://attacker.example/login", "garbage"])("rejects Referer %j", (referer) => {
    expect(check({ Referer: referer })).toBe(false);
  });

  it("ignores attacker-controlled Host and X-Forwarded-Host", () => {
    expect(
      check({
        Host: "attacker.example",
        "X-Forwarded-Host": "attacker.example",
        "X-Forwarded-Proto": "https",
        Origin: "https://attacker.example",
      }),
    ).toBe(false);
  });

  it("without Origin or Referer, relies on Sec-Fetch-Site", () => {
    expect(check({ "Sec-Fetch-Site": "same-origin" })).toBe(true);
    expect(check({ "Sec-Fetch-Site": "cross-site" })).toBe(false);
    expect(check({})).toBe(false);
  });

  it("prefers APP_ORIGIN, for example a custom domain", () => {
    vi.stubEnv("APP_ORIGIN", "https://forms.example.test/");
    expect(check({ Origin: "https://forms.example.test" })).toBe(true);
    expect(check({ Origin: publicOrigin })).toBe(false);
  });

  it.each([
    "http://forms.example.test",
    "forms.example.test",
    "https://forms.example.test/login",
    "https://user@forms.example.test",
    "https://forms.example.test?x=1",
    " https://forms.example.test",
  ])("fails closed for invalid APP_ORIGIN %j", (value) => {
    vi.stubEnv("APP_ORIGIN", value);
    expect(check({ Origin: "https://forms.example.test" })).toBe(false);
    expect(check({ "Sec-Fetch-Site": "same-origin" })).toBe(false);
  });

  it("fails closed when no public origin is configured", () => {
    vi.stubEnv("WEBSITE_HOSTNAME", "");
    expect(check({ Host: publicHost, Origin: publicOrigin, "X-Forwarded-Proto": "https" })).toBe(false);
  });

  it("still accepts local development requests", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("WEBSITE_HOSTNAME", "");
    const url = "http://localhost:3000/api/auth/login";
    expect(check({ Host: "localhost:3000", Origin: "http://localhost:3000" }, url)).toBe(true);
    expect(check({ Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" }, url)).toBe(true);
    expect(check({ Host: "localhost:3000", Origin: "http://localhost:3001" }, url)).toBe(false);
  });
});

describe("same-origin and cookie helpers", () => {
  it("accepts exact Origin or Referer and ignores forwarded host headers", () => {
    expect(
      isSameOriginRequest(
        new Request("https://app.example.test/api/action", {
          headers: { Origin: "https://app.example.test" },
        }),
      ),
    ).toBe(true);

    expect(
      isSameOriginRequest(
        new Request("https://app.example.test:443/api/action", {
          headers: {
            Host: "app.example.test:443",
            Origin: "https://app.example.test",
          },
        }),
      ),
    ).toBe(true);

    expect(
      isSameOriginRequest(
        new Request("https://app.example.test/api/action", {
          headers: {
            Origin: "https://attacker.example",
            "X-Forwarded-Host": "attacker.example",
            "X-Forwarded-Proto": "https",
          },
        }),
      ),
    ).toBe(false);

    expect(
      isSameOriginRequest(
        new Request("https://app.example.test/api/action", {
          headers: { Referer: "https://app.example.test/page" },
        }),
      ),
    ).toBe(true);
  });

  it("forwards only one well-formed contract token cookie", () => {
    expect(
      getContractTokenCookie("theme=dark; contract_token=token.value; session=other"),
    ).toBe("contract_token=token.value");
    expect(getContractTokenCookie("contract_token=; other=value")).toBeNull();
    expect(
      getContractTokenCookie("contract_token=first; contract_token=second"),
    ).toBeNull();
  });
});
