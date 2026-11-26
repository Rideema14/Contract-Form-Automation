import { afterEach, describe, expect, it, vi } from "vitest";
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

    vi.stubEnv("NODE_ENV", "production");
    expect(
      isSameOriginRequest(
        new Request("http://app.example.test/api/action", {
          headers: {
            Origin: "https://app.example.test",
            Host: "app.example.test",
            "X-Forwarded-Proto": "https",
          },
        }),
      ),
    ).toBe(true);

    expect(
      isSameOriginRequest(
        new Request("http://app.example.test/api/action", {
          headers: {
            Origin: "https://attacker.example",
            Host: "app.example.test",
            "X-Forwarded-Proto": "https, http",
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
