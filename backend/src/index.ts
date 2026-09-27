import "./instrumentation.js";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./utils/env.js";
import { swaggerSpec } from "./utils/swagger.js";
import { kdRouter, agentsRouter } from "./routes/index.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/v1/kb", kdRouter);
app.use("/api/v1/agents", agentsRouter);

app.listen(env.PORT, () => {
  console.log(`server listening on port ${env.PORT}`);
});
