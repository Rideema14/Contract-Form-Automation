import type { CorsOptions } from "cors";
import { env } from "./env";

const allowedOrigins = new Set(env.frontendOrigins);

export const corsOptions: CorsOptions = {
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  // Lets the browser read the download filename and request id from responses.
  exposedHeaders: ["Content-Disposition", "X-Request-Id"],
  origin(origin, callback) {
    // Requests from server-to-server clients, health probes and CLI tools have no Origin.
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, allowedOrigins.has(origin));
  },
};
