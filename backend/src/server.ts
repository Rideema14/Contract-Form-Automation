import app from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";

const server = app.listen(env.port, () => {
  console.info(`API listening on port ${env.port}`);
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`Received ${signal}; beginning graceful shutdown`);

  const forceCloseTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out; closing remaining connections");
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);
  forceCloseTimer.unref();

  server.close(async (error) => {
    clearTimeout(forceCloseTimer);
    try {
      await prisma.$disconnect();
      if (error) throw error;
      console.info("HTTP server and database connections closed");
      process.exitCode = 0;
    } catch (shutdownError) {
      console.error("Error during graceful shutdown", shutdownError);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
