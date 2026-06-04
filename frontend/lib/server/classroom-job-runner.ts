import { createLogger } from '@/lib/logger';
import { updateMistakeSession } from '@/lib/mistake/session/store';
import { generateClassroom, type GenerateClassroomInput } from '@/lib/server/classroom-generation';
import {
  markClassroomGenerationJobFailed,
  markClassroomGenerationJobRunning,
  markClassroomGenerationJobSucceeded,
  updateClassroomGenerationJobProgress,
} from '@/lib/server/classroom-job-store';

const log = createLogger('ClassroomJob');
const runningJobs = new Map<string, Promise<void>>();

export function runClassroomGenerationJob(
  jobId: string,
  input: GenerateClassroomInput,
  baseUrl: string,
  options?: { sessionId?: string },
): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) {
    return existing;
  }

  const jobPromise = (async () => {
    try {
      await markClassroomGenerationJobRunning(jobId);

      const result = await generateClassroom(input, {
        baseUrl,
        onProgress: async (progress) => {
          await updateClassroomGenerationJobProgress(jobId, progress);
        },
        onPlayable: async (playable) => {
          if (!options?.sessionId) {
            return;
          }

          await updateMistakeSession(options.sessionId, {
            classroomId: playable.id,
            classroomJobId: jobId,
            status: 'live',
            error: undefined,
          });
        },
      });

      if (options?.sessionId) {
        await updateMistakeSession(options.sessionId, {
          classroomId: result.id,
          classroomJobId: jobId,
          status: 'completed',
          error: undefined,
        });
      }

      await markClassroomGenerationJobSucceeded(jobId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Classroom generation job ${jobId} failed:`, error);
      try {
        if (options?.sessionId) {
          await updateMistakeSession(options.sessionId, {
            classroomJobId: jobId,
            status: 'failed',
            error: message,
          });
        }
        await markClassroomGenerationJobFailed(jobId, message);
      } catch (markFailedError) {
        log.error(`Failed to persist failed status for job ${jobId}:`, markFailedError);
      }
    } finally {
      runningJobs.delete(jobId);
    }
  })();

  runningJobs.set(jobId, jobPromise);
  return jobPromise;
}
