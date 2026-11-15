import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    success: true,
    message: "Backend is running",
    service: "contract-forms-api"
  });
});

router.get("/db", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      success: true,
      message: "Database connection is healthy"
    });
  } catch (error) {
    next(error);
  }
});

export default router;
