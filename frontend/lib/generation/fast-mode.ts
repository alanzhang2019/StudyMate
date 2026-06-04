/**
 * Fast Generation Mode Optimizations
 *
 * When FAST_GENERATION_MODE is enabled:
 * 1. Reduces max output tokens to speed up generation
 * 2. Uses simplified prompts for faster processing
 * 3. Limits the number of actions per scene
 */

import { createLogger } from '@/lib/logger';
const log = createLogger('FastMode');

/**
 * Check if fast generation mode is enabled
 */
export function isFastGenerationEnabled(): boolean {
  return process.env.FAST_GENERATION_MODE === 'true' || process.env.FAST_GENERATION_MODE === '1';
}

/**
 * Get optimized max tokens for fast mode
 */
export function getOptimizedMaxTokens(defaultMaxTokens: number | undefined): number | undefined {
  if (!isFastGenerationEnabled()) {
    return defaultMaxTokens;
  }
  // Limit to 4096 tokens for faster generation
  return Math.min(defaultMaxTokens || 4096, 4096);
}

/**
 * Truncate prompt for fast mode if it's too long
 * Keeps the essential parts and removes verbose examples
 */
export function optimizePromptForFastMode(prompt: string): string {
  if (!isFastGenerationEnabled()) {
    return prompt;
  }

  // If prompt is already short, don't modify
  if (prompt.length < 8000) {
    return prompt;
  }

  log.info(`Optimizing long prompt (${prompt.length} chars) for fast mode`);

  // Remove detailed examples and keep only essential instructions
  let optimized = prompt;

  // Remove large tables if present (they're verbose but not critical)
  const tableRegex = /\|[-\s|]+\|[\s\S]*?(?=\n\n|\n#{1,3}|\n---|$)/g;
  optimized = optimized.replace(tableRegex, (match) => {
    // Keep table header but truncate rows
    const lines = match.split('\n');
    if (lines.length > 8) {
      return lines.slice(0, 6).join('\n') + '\n... (table truncated for fast mode)';
    }
    return match;
  });

  // Remove verbose examples sections
  const exampleRegex = /##+\s*Examples?[\s\S]*?(?=##+|$)/gi;
  optimized = optimized.replace(exampleRegex, '(Examples omitted for fast mode)\n\n');

  log.info(`Optimized prompt length: ${optimized.length} chars`);
  return optimized;
}

/**
 * Limit the number of scenes for fast mode
 */
export function getOptimizedSceneCount(requestedCount: number | undefined): number {
  if (!isFastGenerationEnabled()) {
    return requestedCount || 5;
  }
  // Limit to max 5 scenes in fast mode
  return Math.min(requestedCount || 5, 5);
}

/**
 * Get optimized action count for fast mode
 */
export function getOptimizedActionCount<T>(actions: T[]): T[] {
  if (!isFastGenerationEnabled()) {
    return actions;
  }
  // Limit to max 5 actions per scene in fast mode
  if (actions.length > 5) {
    log.info(`Limiting actions from ${actions.length} to 5 for fast mode`);
    return actions.slice(0, 5);
  }
  return actions;
}
