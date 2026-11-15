import { describe, it, expect } from "vitest";
import request from "supertest";

// Integration check: needs PostgreSQL running and a DEDICATED test database
// (never a shared or production database). Skipped unless TEST_DATABASE_URL is set:
//   TEST_DATABASE_URL="postgresql://contract_user:pw@localhost:5432/contract_automation_test" npm test
describe.skipIf(!process.env.TEST_DATABASE_URL)("GET /api/health/db", () => {
  it("can query PostgreSQL through Prisma", async () => {
    const { default: app } = await import("../src/app");
    const response = await request(app).get("/api/health/db");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
