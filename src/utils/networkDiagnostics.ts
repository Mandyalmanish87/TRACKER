/**
 * Privacy-Safe Network & Egress Diagnostics Layer
 *
 * Tracks network request frequencies, detects call bursts, in-flight duplicates,
 * and duplicate Realtime channels without logging any sensitive user data,
 * credentials, tokens, or message contents.
 */

export interface EndpointMetric {
  totalRequests: number;
  inFlight: number;
  recentBursts: boolean;
}

interface InternalEndpointMetric {
  totalRequests: number;
  inFlight: number;
  recentTimestamps: number[];
  lastBurstWarning: number;
}

interface ChannelMetric {
  topic: string;
  registeredAt: number;
  activeCount: number;
  lastDuplicateWarning: number;
}

const requestMetrics = new Map<string, InternalEndpointMetric>();
const activeChannels = new Map<string, ChannelMetric>();

export const BURST_THRESHOLD = 15; // 15 requests
export const BURST_WINDOW_MS = 5000; // within 5 seconds
export const WARNING_COOLDOWN_MS = 60000; // max 1 warning per 60s per endpoint

/**
 * Records the start of a network request to an endpoint/table.
 * Returns a cleanup function that must be called when the request finishes.
 */
export function recordRequestStart(endpoint: string): () => void {
  const now = Date.now();
  let metric = requestMetrics.get(endpoint);
  if (!metric) {
    metric = {
      totalRequests: 0,
      inFlight: 0,
      recentTimestamps: [],
      lastBurstWarning: 0,
    };
    requestMetrics.set(endpoint, metric);
  }

  metric.totalRequests += 1;
  metric.inFlight += 1;
  metric.recentTimestamps.push(now);

  // Prune timestamps older than the burst window
  metric.recentTimestamps = metric.recentTimestamps.filter((t) => now - t <= BURST_WINDOW_MS);

  // Detect burst
  if (metric.recentTimestamps.length > BURST_THRESHOLD) {
    if (now - metric.lastBurstWarning > WARNING_COOLDOWN_MS) {
      metric.lastBurstWarning = now;
      console.warn(
        `[NetworkDiagnostics] High request burst detected for "${endpoint}": ` +
        `${metric.recentTimestamps.length} calls in last 5s. In-flight: ${metric.inFlight}.`
      );
    }
  }

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    if (metric) {
      metric.inFlight = Math.max(0, metric.inFlight - 1);
    }
  };
}

/**
 * Records the registration of a Realtime channel subscription.
 * Detects duplicate subscriptions to the same topic.
 * Returns a cleanup function to call when the channel is unsubscribed.
 */
export function recordChannelSubscribed(topic: string): () => void {
  const now = Date.now();
  const existing = activeChannels.get(topic);
  if (existing) {
    existing.activeCount += 1;
    if (now - existing.lastDuplicateWarning > WARNING_COOLDOWN_MS) {
      existing.lastDuplicateWarning = now;
      console.warn(
        `[NetworkDiagnostics] Duplicate Realtime channel subscription detected for topic "${topic}". Active count: ${existing.activeCount}.`
      );
    }
  } else {
    activeChannels.set(topic, {
      topic,
      registeredAt: now,
      activeCount: 1,
      lastDuplicateWarning: 0,
    });
  }

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    const current = activeChannels.get(topic);
    if (current) {
      current.activeCount -= 1;
      if (current.activeCount <= 0) {
        activeChannels.delete(topic);
      }
    }
  };
}

/**
 * Returns a privacy-safe snapshot of request metrics and active channels.
 */
export function getDiagnosticsSummary(): {
  endpoints: Record<string, EndpointMetric>;
  activeChannels: Record<string, number>;
} {
  const now = Date.now();
  const endpoints: Record<string, EndpointMetric> = {};
  for (const [endpoint, metric] of requestMetrics.entries()) {
    const recentCount = metric.recentTimestamps.filter((t) => now - t <= BURST_WINDOW_MS).length;
    endpoints[endpoint] = {
      totalRequests: metric.totalRequests,
      inFlight: metric.inFlight,
      recentBursts: recentCount > BURST_THRESHOLD,
    };
  }

  const channels: Record<string, number> = {};
  for (const [topic, meta] of activeChannels.entries()) {
    channels[topic] = meta.activeCount;
  }

  return {
    endpoints,
    activeChannels: channels,
  };
}

/**
 * Clears all diagnostics state.
 */
export function resetDiagnostics(): void {
  requestMetrics.clear();
  activeChannels.clear();
}

export const networkDiagnostics = {
  recordRequestStart,
  recordChannelSubscribed,
  getDiagnosticsSummary,
  resetDiagnostics,
};
