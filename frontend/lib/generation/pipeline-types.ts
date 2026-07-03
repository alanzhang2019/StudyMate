/**
 * Type definitions for the generation pipeline.
 */

import type { GenerationProgress } from '@/lib/types/generation';

// ==================== Agent Info ====================

/** Lightweight agent info passed to the generation pipeline */
export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  persona?: string;
}

// ==================== Cross-Page Context ====================

/** Cross-page context for maintaining speech coherence across scenes */
export interface SceneGenerationContext {
  pageIndex: number; // Current page (1-based)
  totalPages: number; // Total number of pages
  allTitles: string[]; // All page titles in order
  previousSpeeches: string[]; // Speech texts from the previous page only
}

// ==================== Generated Slide Data Interface ====================

/**
 * AI-generated slide data structure
 * Used to parse AI responses
 *
 * The `actions` field was added in r12 (content+actions merge) — it carries
 * the teaching action sequence the LLM produced in the same response, so the
 * pipeline does NOT need a second LLM call to fetch actions.
 *
 * If absent (e.g. older LLM, malformed response, or fallback), the caller
 * derives default actions locally without burning another LLM call.
 */
export interface GeneratedSlideData {
  elements: Array<{
    type: 'text' | 'image' | 'video' | 'shape' | 'chart' | 'latex' | 'line';
    left: number;
    top: number;
    width: number;
    height: number;
    [key: string]: unknown;
  }>;
  background?: {
    type: 'solid' | 'gradient';
    color?: string;
    gradient?: {
      type: 'linear' | 'radial';
      colors: Array<{ pos: number; color: string }>;
      rotate: number;
    };
  };
  remark?: string;
  /**
   * Teaching action sequence (raw, AI-typed element IDs). The pipeline
   * remaps `elementId` references to the post-processed nanoid IDs before
   * running them through `processActions`.
   */
  actions?: Array<Record<string, unknown>>;
}

/**
 * AI-generated quiz data structure (r12+).
 *
 * Quiz content and quiz actions are now returned in the same JSON:
 *
 *   { questions: QuizQuestion[], actions: [{type, name, params}, {type:"text", content}] }
 */
export interface GeneratedQuizData {
  questions: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
}

// ==================== Types ====================

export interface GenerationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GenerationCallbacks {
  onProgress?: (progress: GenerationProgress) => void;
  onStageComplete?: (stage: 1 | 2 | 3, result: unknown) => void;
  onError?: (error: string) => void;
}

export type AICallFn = (
  systemPrompt: string,
  userPrompt: string,
  images?: Array<{ id: string; src: string }>,
) => Promise<string>;
