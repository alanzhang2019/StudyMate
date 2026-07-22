// Classroom ZIP manifest types
//
// Mirrors the export format produced by OpenMAIC. We only need the
// *portable* shape: relative media references, agent references by
// index, and an opaque scene content blob. StudyMate's own Stage /
// Scene / Action types take over once the manifest is parsed.

import type { SceneType, SceneContent } from '@/lib/types/stage';
import type { Slide } from '@/lib/types/slides';

export const CLASSROOM_ZIP_FORMAT_VERSION = 1;

export interface ClassroomManifest {
  formatVersion: number;
  exportedAt: string;
  appVersion?: string;
  stage: ManifestStage;
  agents: ManifestAgent[];
  scenes: ManifestScene[];
  mediaIndex?: Record<string, MediaIndexEntry>;
}

export interface ManifestStage {
  name: string;
  description?: string;
  language?: string;
  style?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ManifestAgent {
  name: string;
  role: string;
  persona: string;
  avatar: string;
  color: string;
  priority: number;
  voiceConfig?: { providerId: string; voiceId: string };
}

/**
 * Action as it appears in the manifest. `audioId` and `agentId` are
 * replaced with portable references so the same ZIP can be imported
 * into a different environment without an ID collision.
 */
export interface ManifestAction {
  id: string;
  type: string;
  title?: string;
  description?: string;
  // Speech
  text?: string;
  voice?: string;
  speed?: number;
  audioRef?: string;          // relative path inside the ZIP, e.g. audio/abc123.mp3
  // Discussion
  topic?: string;
  prompt?: string;
  agentIndex?: number;        // index into manifest.agents
  // Spotlight / laser
  elementId?: string;
  dimOpacity?: number;
  color?: string;
  // Whiteboard
  content_?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  shape?: string;
  fillColor?: string;
  latex?: string;
  data?: unknown;
  chartType?: string;
  language?: string;
  code?: string;
  // Anything else from the live Action union: keep the field name by
  // accepting extra keys at parse time (we map them by JSON).
  [key: string]: unknown;
}

export interface ManifestScene {
  type: SceneType;
  title: string;
  order: number;
  content: SceneContent;
  actions?: ManifestAction[];
  whiteboards?: Slide[];
  multiAgent?: {
    enabled: boolean;
    agentIndices: number[];
    directorPrompt?: string;
  };
}

export interface MediaIndexEntry {
  type: 'audio' | 'image' | 'generated';
  mimeType?: string;
  format?: string;
  duration?: number;
  voice?: string;
  size?: number;
  prompt?: string;
  missing?: boolean;
}

export class ClassroomImportError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ClassroomImportError';
  }
}
