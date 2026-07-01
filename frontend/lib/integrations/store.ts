import { db } from '@/lib/db';
import type { CreateMistakeJobInput } from './schemas';

export type IntegrationJobStatus = 'queued' | 'running' | 'ready' | 'failed';
export type IntegrationJobStage = 'diagnosing' | null;

export interface IntegrationJob {
  id: string;
  subject: string;
  source: string | null;
  requestPayload: CreateMistakeJobInput;
  status: IntegrationJobStatus;
  stage: IntegrationJobStage;
  sessionId: string | null;
  classroomId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  ip: string;
  ua: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

const TTL_MS = 24 * 60 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function genId(): string {
  return `ij_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function rowToJob(row: any): IntegrationJob {
  let requestPayload: CreateMistakeJobInput;
  try {
    requestPayload = JSON.parse(row.requestPayload);
  } catch {
    requestPayload = row.requestPayload;
  }
  return {
    id: row.id,
    subject: row.subject,
    source: row.source ?? null,
    requestPayload,
    status: row.status as IntegrationJobStatus,
    stage: (row.stage ?? null) as IntegrationJobStage,
    sessionId: row.sessionId ?? null,
    classroomId: row.classroomId ?? null,
    errorCode: row.errorCode ?? null,
    errorMessage: row.errorMessage ?? null,
    ip: row.ip,
    ua: row.ua ?? null,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface CreateIntegrationJobArgs {
  request: CreateMistakeJobInput;
  ip: string;
  ua: string | null;
}

export function createIntegrationJob(args: CreateIntegrationJobArgs): IntegrationJob {
  const id = genId();
  const now = nowIso();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const requestPayload = JSON.stringify(args.request);

  db.integrationJob.create({
    data: {
      id,
      subject: args.request.subject,
      source: args.request.source ?? null,
      requestPayload,
      status: 'queued',
      stage: null,
      sessionId: null,
      classroomId: null,
      errorCode: null,
      errorMessage: null,
      ip: args.ip,
      ua: args.ua,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    },
  });

  const job = readIntegrationJob(id);
  if (!job) throw new Error('integration job not found after create');
  return job;
}

export function readIntegrationJob(id: string): IntegrationJob | null {
  const row = db.integrationJob.findUnique({ where: { id } });
  if (!row) return null;
  return rowToJob(row);
}

export interface UpdateIntegrationJobPatch {
  status?: IntegrationJobStatus;
  stage?: IntegrationJobStage;
  sessionId?: string | null;
  classroomId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export function updateIntegrationJob(
  id: string,
  patch: UpdateIntegrationJobPatch,
): IntegrationJob | null {
  const existing = readIntegrationJob(id);
  if (!existing) return null;

  db.integrationJob.update({
    where: { id },
    data: {
      status: patch.status ?? existing.status,
      stage: patch.stage === undefined ? existing.stage : patch.stage,
      sessionId: patch.sessionId === undefined ? existing.sessionId : patch.sessionId,
      classroomId: patch.classroomId === undefined ? existing.classroomId : patch.classroomId,
      errorCode: patch.errorCode === undefined ? existing.errorCode : patch.errorCode,
      errorMessage: patch.errorMessage === undefined ? existing.errorMessage : patch.errorMessage,
      updatedAt: nowIso(),
    },
  });

  return readIntegrationJob(id);
}
