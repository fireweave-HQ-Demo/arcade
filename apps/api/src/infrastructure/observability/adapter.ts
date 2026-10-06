import type { ObservabilityPort } from "../../domain/ports";
import { emitAction, log, metric, traceSpan } from "./openobserve";

export const observability: ObservabilityPort = {
  log,
  metric,
  async span(input) {
    const result = await traceSpan({
      name: input.name,
      traceId: input.traceId,
      parentSpanId: input.parentSpanId,
      attributes: input.attributes,
      statusCode: input.statusCode,
      statusMessage: input.statusMessage,
    });
    return { traceId: result.traceId, spanId: result.spanId };
  },
  emitAction,
};
