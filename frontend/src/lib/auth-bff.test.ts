
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backendApiBaseUrl,
  getContractTokenCookie,
  isSameOriginRequest,
} from "./auth-bff";

const originalApiUrl = process.env.API_BASE_URL;
const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const originalFrontendOrigin = process.env.FRONTEND_PUBLIC_ORIGIN;

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.API_BASE_URL;
  else process.env.API_BASE_URL = originalApiUrl;

  if (originalPublicApiUrl === undefined)
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalPublicApiUrl;

  if (originalFrontendOrigin === undefined)
    delete process.env.FRONTEND_PUBLIC_ORIGIN;
  else process.env.FRONTEND_PUBLIC_ORIGIN = originalFrontendOrigin;

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
    expect(() => backendApiBaseUrl()).toThrow(
      "configured backend API URL is invalid",
    );
  });
});

describe("same-origin and cookie helpers", () => {
  const publicOrigin =
    "https://contract-forms-frontend-261126.azurewebsites.net";

  it("accepts the configured public origin even when the Next.js URL is internal", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_PUBLIC_ORIGIN", publicOrigin);

    expect(
      isSameOriginRequest(
        new Request("http://n/api/auth/login", {
          headers: {
            Host: "internal-container:3000",
            Origin: publicOrigin,
            Referer: `${publicOrigin}/login`,
            "Sec-Fetch-Site": "same-origin",
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts the configured public origin when forwarded protocol is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_PUBLIC_ORIGIN", publicOrigin);

    expect(
      isSameOriginRequest(
        new Request("http://internal-container:3000/api/auth/login", {
          headers: {
            Origin: publicOrigin,
            Host: "internal-container:3000",
          },
        }),
      ),
    ).toBe(true);
  });

  it("rejects a different or malformed Origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_PUBLIC_ORIGIN", publicOrigin);

    expect(
      isSameOriginRequest(
        new Request("http://internal-container:3000/api/auth/login", {
          headers: { Origin: "https://attacker.example" },
        }),
      ),
    ).toBe(false);

    expect(
      isSameOriginRequest(
        new Request("http://internal-container:3000/api/auth/login", {
          headers: { Origin: "not-a-valid-origin" },
        }),
      ),
    ).toBe(false);
  });

  it("rejects missing or invalid production configuration", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.FRONTEND_PUBLIC_ORIGIN;

    expect(
      isSameOriginRequest(
        new Request("http://internal-container:3000/api/auth/login", {
          headers: { Origin: publicOrigin },
        }),
      ),
    ).toBe(false);

    vi.stubEnv("FRONTEND_PUBLIC_ORIGIN", "http://app.example.test");

    expect(
      isSameOriginRequest(
        new Request("http://internal-container:3000/api/auth/login", {
          headers: { Origin: "http://app.example.test" },
        }),
      ),
    ).toBe(false);
  });

  it("accepts the configured public Referer when Origin is absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_PUBLIC_ORIGIN", publicOrigin);

    expect(
      isSameOriginRequest(
        new Request("http://internal-container:3000/api/auth/login", {
          headers: {
            Referer: `${publicOrigin}/login`,
          },
        }),
      ),
    ).toBe(true);
  });

  it("rejects a different Referer when Origin is absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_PUBLIC_ORIGIN", publicOrigin);

    expect(
      isSameOriginRequest(
        new Request("http://internal-container:3000/api/auth/login", {
          headers: {
            Referer: "https://attacker.example/login",
          },
        }),
      ),
    ).toBe(false);
  });

  it("rejects a cross-origin request even if forwarded headers claim the public host", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_PUBLIC_ORIGIN", publicOrigin);

    expect(
      isSameOriginRequest(
        new Request("http://internal-container:3000/api/auth/login", {
          headers: {
            Origin: "https://attacker.example",
            "X-Forwarded-Host":
              "contract-forms-frontend-261126.azurewebsites.net",
            "X-Forwarded-Proto": "https",
          },
        }),
      ),
    ).toBe(false);
  });

  it("forwards only one well-formed contract token cookie", () => {
    expect(
      getContractTokenCookie(
        "theme=dark; contract_token=token.value; session=other",
      ),
    ).toBe("contract_token=token.value");

    expect(getContractTokenCookie("contract_token=; other=value")).toBeNull();

    expect(
      getContractTokenCookie("contract_token=first; contract_token=second"),
    ).toBeNull();
  });
});
