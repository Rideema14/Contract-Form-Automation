// Test environment: dummy values only. Never point tests at a shared or
// production database. DB integration tests use TEST_DATABASE_URL.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123";
process.env.FRONTEND_ORIGIN = "http://localhost:3000";
