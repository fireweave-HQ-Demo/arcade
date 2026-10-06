import type { ObservabilityPort } from "../../domain/ports";
import { log, metric, traceSpan } from "./openobserve";

export const observability: ObservabilityPort = {
  log,
  metric,
  async span(input) {
    const result = await traceSpan({
      name: input.name,
      traceId: input.traceId,
      attributes: input.attributes,
    });
    return { traceId: result.traceId, spanId: result.spanId };
  },
};
