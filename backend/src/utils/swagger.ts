import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env.js";

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Policy Agent API",
      version: "1.0.0",
      description: "RAG ingestion and retrieval API for the policy agent knowledge base",
    },
    servers: [{ url: `http://localhost:${env.PORT}/api/v1` }],
  },
  apis: ["./src/routes/*.ts"],
});

export { swaggerSpec };
