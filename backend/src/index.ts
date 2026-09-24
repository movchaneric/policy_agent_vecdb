import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./utils/env.js";
import { swaggerSpec } from "./utils/swagger.js";
import { kdRouter } from "./routes/index.js";
import { logger } from "./utils/logger.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/v1/kb", kdRouter);

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "server listening");
});
