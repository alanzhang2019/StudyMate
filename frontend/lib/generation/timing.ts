export type GenerationTimingMetadata = Record<string, unknown>;

export interface GenerationTimingRecord {
  label: string;
  name: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  metadata: GenerationTimingMetadata;
}

export interface GenerationTimingSummary {
  label: string;
  totalDurationMs: number;
  measuredDurationMs: number;
  slowestStage: {
    name: string;
    durationMs: number;
  } | null;
  stageCount: number;
  stages: Array<{
    name: string;
    durationMs: number;
  }>;
}

export interface GenerationTimingOptions {
  now?: () => number;
  log?: (message: string, data?: unknown) => void;
}

export interface GenerationTiming {
  start(name: string, metadata?: GenerationTimingMetadata): void;
  end(name: string, metadata?: GenerationTimingMetadata): GenerationTimingRecord;
  time<T>(name: string, fn: () => Promise<T>, metadata?: GenerationTimingMetadata): Promise<T>;
  record(name: string, durationMs: number, metadata?: GenerationTimingMetadata): GenerationTimingRecord;
  records(): GenerationTimingRecord[];
  summary(): GenerationTimingSummary;
}

const SENSITIVE_SUFFIXES = ['key', 'token', 'secret', 'baseurl', 'base_url', 'text', 'problem', 'answer', 'content'];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_SUFFIXES.some((suffix) => lower === suffix || lower.endsWith(suffix));
}

function defaultNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

function sanitizeMetadata(metadata: GenerationTimingMetadata = {}): GenerationTimingMetadata {
  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      isSensitiveKey(key) ? '[redacted]' : value,
    ]),
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createGenerationTiming(
  label: string,
  options: GenerationTimingOptions = {},
): GenerationTiming {
  const now = options.now ?? defaultNow;
  const log = options.log ?? ((message: string, data?: unknown) => console.info(message, data));
  const createdAt = now();
  const starts = new Map<string, { startMs: number; metadata: GenerationTimingMetadata }>();
  const finished: GenerationTimingRecord[] = [];

  const pushRecord = (
    name: string,
    startMs: number,
    endMs: number,
    metadata?: GenerationTimingMetadata,
  ): GenerationTimingRecord => {
    const durationMs = roundMs(endMs - startMs);
    const record: GenerationTimingRecord = {
      label,
      name,
      startMs: roundMs(startMs),
      endMs: roundMs(endMs),
      durationMs,
      metadata: sanitizeMetadata(metadata),
    };
    finished.push(record);
    log(`[GenerationTiming] ${label}.${name} ${durationMs}ms`, record.metadata);
    return record;
  };

  return {
    start(name, metadata = {}) {
      starts.set(name, {
        startMs: now(),
        metadata,
      });
    },

    end(name, metadata = {}) {
      const entry = starts.get(name);
      const endMs = now();
      if (!entry) {
        return pushRecord(name, endMs, endMs, metadata);
      }
      starts.delete(name);
      return pushRecord(name, entry.startMs, endMs, {
        ...entry.metadata,
        ...metadata,
      });
    },

    async time<T>(name: string, fn: () => Promise<T>, metadata = {}): Promise<T> {
      this.start(name, metadata);
      try {
        const result = await fn();
        this.end(name, { status: 'ok' });
        return result;
      } catch (error) {
        this.end(name, {
          status: 'error',
          error: getErrorMessage(error),
        });
        throw error;
      }
    },

    record(name, durationMs, metadata = {}) {
      const endMs = now();
      const startMs = endMs - durationMs;
      return pushRecord(name, startMs, endMs, metadata);
    },

    records() {
      return [...finished];
    },

    summary() {
      const stages = finished.map((record) => ({
        name: record.name,
        durationMs: record.durationMs,
      }));
      const measuredDurationMs = stages.reduce((sum, stage) => sum + stage.durationMs, 0);
      const slowestStage = stages.reduce<GenerationTimingSummary['slowestStage']>((slowest, stage) => {
        if (!slowest || stage.durationMs > slowest.durationMs) {
          return stage;
        }
        return slowest;
      }, null);
      const summary: GenerationTimingSummary = {
        label,
        totalDurationMs: roundMs(now() - createdAt),
        measuredDurationMs,
        slowestStage,
        stageCount: stages.length,
        stages,
      };
      log(`[GenerationTimingSummary] ${label}`, summary);
      return summary;
    },
  };
}
