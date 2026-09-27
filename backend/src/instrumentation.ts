import { register } from "@arizeai/phoenix-otel";
import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import * as CallbackManagerModule from "@langchain/core/callbacks/manager";
import { env } from "./utils/env.js";

register({
  projectName: "policy-agent",
  url: env.PHOENIX_COLLECTOR_ENDPOINT,
});

// LangChain.js has no traditional module structure for OTel to auto-patch,
// so the callback manager module has to be instrumented by hand.
new LangChainInstrumentation().manuallyInstrument(CallbackManagerModule);
