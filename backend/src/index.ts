import "./instrumentation.js";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./utils/env.js";
import { checkpointer } from "./agent/04_memory.js";
import { swaggerSpec } from "./utils/swagger.js";
import { closeDatabaseConnection } from "./utils/mongodb.js";
import { kdRouter, agentsRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/v1/kb", kdRouter);
app.use("/api/v1/agents", agentsRouter);

app.use(errorHandler);

try {
  const memorySetupErrors = await checkpointer.setup();
  if (memorySetupErrors.length > 0) {
    console.error("checkpointer setup failed:", memorySetupErrors);
    process.exit(1);
  }
} catch (err) {
  console.error("checkpointer setup threw:", err);
  process.exit(1);
}

const server = app.listen(env.PORT, () => {
  console.log(`server listening on port ${env.PORT}`);
});

server.on("error", (err) => {
  console.error("server failed to start:", err);
  process.exit(1);
});

const shutdown = () => {
  server.close(() => {
    closeDatabaseConnection()
      .catch((err) => console.error("error closing MongoDB connection:", err))
      .finally(() => process.exit(0));
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
