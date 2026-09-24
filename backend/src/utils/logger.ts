import path from "node:path";
import pino from "pino";
import { env } from "./env.js";

// every log line lands in three places at once:
// 1. pretty-printed on stdout, for whoever is watching the terminal
// 2. newline-delimited JSON at backend/logs/kb-pipeline.log, for local grepping/tailing
// 3. Axiom (https://axiom.co), when AXIOM_TOKEN + AXIOM_DATASET are set - gives a
//    searchable UI and survives past whatever's in the terminal scrollback
const targets: pino.TransportTargetOptions[] = [
  {
    target: "pino-pretty",
    level: env.LOG_LEVEL,
    options: {
      colorize: true,
      translateTime: "SYS:HH:MM:ss.l",
      ignore: "pid,hostname",
    },
  },
  {
    target: "pino/file",
    level: "debug",
    options: {
      destination: path.resolve(process.cwd(), "logs", "kb-pipeline.log"),
      mkdir: true,
    },
  },
];

if (env.AXIOM_TOKEN && env.AXIOM_DATASET) {
  targets.push({
    target: "@axiomhq/pino",
    level: "debug",
    options: {
      dataset: env.AXIOM_DATASET,
      token: env.AXIOM_TOKEN,
    },
  });
}

export const logger = pino(
  { level: "debug" },
  pino.transport({ targets }),
);

if (!env.AXIOM_TOKEN || !env.AXIOM_DATASET) {
  logger.warn(
    "AXIOM_TOKEN/AXIOM_DATASET not set - logs are only going to stdout and logs/kb-pipeline.log, not Axiom",
  );
}

// one child logger per kb/ pipeline step, tagged so `step` is filterable
// both in the local file and in the Axiom UI
export const stepLogger = (step: string) => logger.child({ step });
