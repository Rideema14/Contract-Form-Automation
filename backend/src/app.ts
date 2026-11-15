import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import healthRoutes from "./routes/health.routes";

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.frontendOrigin,
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.status(200).json({ success: true, message: "API is online" });
});

app.use("/api/health", healthRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response,
  _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

export default app;
