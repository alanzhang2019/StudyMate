// Stage and Scene data types
import type { Slide } from '@/lib/types/slides';
import type { Action } from '@/lib/types/action';
import type { PBLProjectConfig } from '@/lib/pbl/types';
import type { WidgetType, WidgetConfig, TeacherAction } from '@/lib/types/widgets';

export type SceneType = 'slide' | 'quiz' | 'interactive' | 'pbl';

export type StageMode = 'autonomous' | 'playback';

export type Whiteboard = Omit<Slide, 'theme' | 'turningMode' | 'sectionTag' | 'type'>;

export interface VideoManifestEntry {
  type: 'video';
  prompt: string;
  aspectRatio?: string;
}

export type VideoManifest = Record<string, VideoManifestEntry>;

/**
 * Stage - Represents the entire classroom/course
 */
export interface Stage {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  // Stage metadata
  languageDirective?: string;
  style?: string;
  // Whiteboard data
  whiteboard?: Whiteboard[];
  // Generated video requests keyed by the mediaRef used by PPTVideoElement.
  // Runtime media state lives in the media task store / persisted media files.
  videoManifest?: VideoManifest;
  // Agent IDs selected when this classroom was created
  agentIds?: string[];
  /**
   * Server-generated agent configurations.
   * Embedded in persisted classroom JSON so clients can hydrate
   * the agent registry without relying on IndexedDB pre-population.
   * Only present for API-generated classrooms.
   */
  generatedAgentConfigs?: Array<{
    id: string;
    name: string;
    role: string;
    persona: string;
    avatar: string;
    color: string;
    priority: number;
  }>;
  /**
   * True when this classroom was generated with Interactive Mode enabled
   * (the INTERACTIVE_OUTLINES prompt branch).
   * Absent on legacy classrooms, imports, and regular-mode generations.
   */
  interactiveMode?: boolean;
}

/**
 * Scene - Represents a single page/scene in the course
 */
export interface Scene {
  id: string;
  stageId: string; // ID of the parent stage (for data integrity checks)
  type: SceneType;
  title: string;
  order: number; // Display order

  // Type-specific content
  content: SceneContent;

  // Actions to execute during playback
  actions?: Action[];

  // Whiteboards to explain deeply
  whiteboards?: Slide[];

  // Multi-agent discussion configuration
  multiAgent?: {
    enabled: boolean; // Enable multi-agent for this scene
    agentIds: string[]; // Which agents to include (from registry)
    directorPrompt?: string; // Optional custom director instructions
  };

  // Metadata
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Scene content based on type
 */
export type SceneContent = SlideContent | QuizContent | InteractiveContent | PBLContent;

/**
 * Slide content - PPTist Canvas data
 */
export interface SlideContent {
  type: 'slide';
  // PPTist slide data structure
  canvas: Slide;
}

/**
 * High-level "kind" of a quiz scene. Used by the chapter-cover
 * (QuizCover) to show a one-line type tag such as "单项选择题"
 * / "阅读程序题" / "完善程序题" before the student presses
 * "开始答题". The QuizView still derives the right rendering
 * from `questions[]` + `codeBlock?` — `kind` is just a label,
 * never a behaviour switch — so an old classroom JSON that
 * omits this field keeps working (we default to "choice").
 *
 *   choice           — only multiple/single-choice questions
 *   code-reading     — question references a shared program
 *                       listing (read-only; pick the output)
 *   code-completion  — student fills in numbered blanks
 *                       "(1)", "(2)" ... in the shared listing
 */
export type QuizKind = 'choice' | 'code-reading' | 'code-completion';

/**
 * Quiz content - React component props/data
 */
export interface QuizContent {
  type: 'quiz';
  /** High-level type label. Optional; falls back to "choice". */
  kind?: QuizKind;
  /**
   * Optional shared code block rendered once above the question
   * list. Used by code-reading ("阅读程序") and code-completion
   * ("完善程序") scenes in CSP exam papers where the same
   * program listing is referenced by multiple questions — keeps
   * the JSON DRY and lets the renderer draw a single, properly
   * line-numbered, paper-style code block instead of repeating
   * the code in every question's `question` string.
   */
  codeBlock?: QuizCodeBlock;
  questions: QuizQuestion[];
}

/**
 * Shared code listing displayed once above the question list.
 * `lines[]` is the canonical, line-by-line source. The renderer
 * prepends a 1-based line number gutter (or `startLine` if set)
 * so the student can refer to "line 12" the same way the exam
 * paper does. We intentionally do NOT parse a fenced code block
 * out of the question string — that was the v0 approach and it
 * broke for any scene that wanted real line numbers.
 */
export interface QuizCodeBlock {
  /** Programming language hint, e.g. "cpp", "c", "python". Used for label only. */
  language: string;
  /** Optional heading shown above the code (e.g. "阅读程序（1）：质数统计"). */
  title?: string;
  /** Optional description shown above (or below) the code — e.g. problem preamble. */
  description?: string;
  /**
   * Source lines in order. May be empty (no code block) but
   * should typically contain at least one line if the field is
   * present. Whitespace and indentation are preserved verbatim.
   */
  lines: string[];
  /**
   * 1-based first line number. Defaults to 1. Set this when the
   * program is a fragment of a larger file or when the paper
   * already numbers lines starting at a non-1 value.
   */
  startLine?: number;
}

export interface QuizOption {
  label: string; // Display text
  value: string; // Selection key: "A", "B", "C", "D"
}

export interface QuizQuestion {
  id: string;
  type: 'single' | 'multiple' | 'short_answer';
  question: string;
  options?: QuizOption[];
  answer?: string[]; // Correct answer values: ["A"], ["A","C"], or undefined for text
  analysis?: string; // Explanation shown after grading
  commentPrompt?: string; // Grading guidance for text questions
  hasAnswer?: boolean; // Whether auto-grading is possible
  points?: number; // Points per question (default 1)
}

/**
 * Interactive content - Interactive web page (iframe)
 */
export interface InteractiveContent {
  type: 'interactive';
  url: string; // URL of the interactive page
  // Optional: embedded HTML content
  html?: string;
  // Ultra Mode widget fields
  widgetType?: WidgetType;
  widgetConfig?: WidgetConfig;
  teacherActions?: TeacherAction[];
}

/**
 * PBL content - Project-based learning
 */
export interface PBLContent {
  type: 'pbl';
  projectConfig: PBLProjectConfig;
}

// Re-export generation types for convenience
export type {
  UserRequirements,
  SceneOutline,
  GenerationSession,
  GenerationProgress,
  UploadedDocument,
} from './generation';
