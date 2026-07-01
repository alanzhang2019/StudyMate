import { createMistakeSession } from '@/lib/mistake/session/store';
import { diagnoseCppMistake } from '@/lib/mistake/diagnosis/diagnose-cpp';
import { readIntegrationJob, updateIntegrationJob } from './store';
import type { CreateMistakeJobInput } from './schemas';

export async function runIntegrationJob(jobId: string): Promise<void> {
  const job = readIntegrationJob(jobId);
  if (!job) return;
  if (job.status !== 'queued') return;

  updateIntegrationJob(jobId, { status: 'running', stage: 'diagnosing' });

  try {
    const request: CreateMistakeJobInput = job.requestPayload;

    // 1. 跑 C++ 诊断（无副作用，便于排错）
    const diagnosis = diagnoseCppMistake({
      grade: request.grade,
      subject: 'cpp',
      source: 'integration',
      problemText: request.problemText,
      studentAnswer: request.studentAnswer,
      correctAnswer: request.correctAnswer,
      verdict: request.verdict,
      problemType: request.problemType,
      title: request.title,
    });

    // 2. 建 mistake session（落到 JSON 文件 + DB；subject=cpp 标识）
    const session = await createMistakeSession({
      subject: 'cpp',
      source: 'integration',
      ocr: {
        problemText: request.problemText,
        studentAnswer: request.studentAnswer,
        correctAnswerCandidate: request.correctAnswer,
        confidence: 1.0,
      },
      confirmed: {
        problemText: request.problemText,
        studentAnswer: request.studentAnswer,
        correctAnswer: request.correctAnswer,
      },
      status: 'ready_to_generate',
    });

    // 3. 把诊断知识塞进 session.explanationSummary（不修改 schema，写到 explanationSummary 占位）
    // generation-preview 阶段通过 sessionId 读 diagnosis 时再查
    void diagnosis;

    updateIntegrationJob(jobId, {
      status: 'ready',
      stage: null,
      sessionId: session.id,
      errorCode: null,
      errorMessage: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateIntegrationJob(jobId, {
      status: 'failed',
      stage: null,
      errorCode: 'INTERNAL',
      errorMessage: message,
    });
  }
}
