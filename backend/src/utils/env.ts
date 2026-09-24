import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z
    .string()
    .default("5000")
    .transform((val) => Number(val)),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  MONGODB_ATLAS_URI: z.string().min(1, "MONGODB_ATLAS_URI is required"),
  MONGODB_DB_NAME: z.string().min(1, "MONGODB_DB_NAME is required"),
  LOG_LEVEL: z.string().default("debug"),
  // optional: shipping logs to Axiom (https://axiom.co) is skipped when either is unset
  AXIOM_TOKEN: z.string().optional(),
  AXIOM_DATASET: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    z.treeifyError(parsed.error)
  );
  process.exit(1);
}

export const env = parsed.data;
