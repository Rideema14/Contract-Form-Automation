import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadAttachments } from "@/features/attachments/attachments-api";
import { importCostEstimate } from "@/services/contracts";

class MockXMLHttpRequest {
  static instance: MockXMLHttpRequest;
  upload = {};
  withCredentials = false;
  status = 200;
  responseText = JSON.stringify({ success: true, data: [{ id: "attachment-1" }] });
  method = "";
  url = "";
  sentBody: Document | XMLHttpRequestBodyInit | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    MockXMLHttpRequest.instance = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: Document | XMLHttpRequestBodyInit | null) {
    this.sentBody = body;
    this.onload?.();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("upload flows", () => {
  it("sends attachment uploads as FormData through the same-origin API", async () => {
    vi.stubGlobal("XMLHttpRequest", MockXMLHttpRequest);

    await expect(
      uploadAttachments("form-1", "SUPPORTING", [new File(["file"], "proof.txt")]),
    ).resolves.toEqual([{ id: "attachment-1" }]);

    const xhr = MockXMLHttpRequest.instance;
    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe("/api/forms/form-1/attachments");
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.sentBody).toBeInstanceOf(FormData);
    expect((xhr.sentBody as FormData).get("files")).toBeInstanceOf(File);
  });

  it("sends contract cost-estimate imports as FormData without a manual boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ success: true, data: { items: [{ id: "line-1" }] } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      importCostEstimate("form-2", new File(["csv"], "estimate.csv")),
    ).resolves.toEqual([{ id: "line-1" }]);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/forms/form-2/cost-lines/import");
    expect(options.body).toBeInstanceOf(FormData);
    expect(new Headers(options.headers).has("content-type")).toBe(false);
    expect(options.credentials).toBe("include");
  });
});
