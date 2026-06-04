import type { getCurrentModelConfig } from '@/lib/utils/model-config';

type ModelConfig = ReturnType<typeof getCurrentModelConfig>;

export function buildMistakeExtractHeaders(_modelConfig: ModelConfig): Record<string, string> {
  return {};
}
