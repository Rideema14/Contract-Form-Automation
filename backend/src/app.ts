import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { corsOptions } from "./config/cors";
import healthRoutes from "./routes/health.routes";
import contractsRoutes from "./routes/contracts.routes";
import referenceDataRoutes from "./routes/reference-data.routes";
import approvalsRoutes from "./routes/approvals.routes";
import usersRoutes from "./routes/users.routes";
import notificationsRoutes from "./routes/notifications.routes";
import authRoutes from "./modules/auth/auth.routes";
import attachmentsRoutes from "./routes/attachments.routes";
import { AppError } from "./utils/app-error";
import notFoundHandler from "./middleware/notFound";

const app = express();

app.use(helmet());

app.use(cors(corsOptions));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use((req, _res, next) => {
  req.requestId = crypto.randomUUID();
  next();
});

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/forms", contractsRoutes);
app.use("/api/forms", attachmentsRoutes);
app.use("/api/reference-data", referenceDataRoutes);
app.use("/api/approvals", approvalsRoutes);
app.use(notFoundHandler);

app.use((err: unknown, req: express.Request, res: express.Response,
  _next: express.NextFunction) => {
  console.error(err);
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: { code: err.code, details: err.details },
      meta: { requestId: req.requestId },
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    res.status(409).json({
      success: false,
      message: "A record with the same unique value already exists",
      error: { code: "CONFLICT", details: [] },
      meta: { requestId: req.requestId },
    });
    return;
  }
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: { code: "INTERNAL_ERROR", details: [] },
    meta: { requestId: req.requestId },
  });
});

export default app;
