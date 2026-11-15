import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("GET /api/health", () => {
  it("returns a healthy API response", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
