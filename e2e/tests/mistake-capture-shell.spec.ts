import path from 'node:path';

import { expect, test } from '../fixtures/base';

test.describe('/mistake capture shell', () => {
  test('high confidence extraction skips confirm and enters generation preview', async ({
    page,
    mockApi,
  }) => {
    await mockApi.mockMistakeExtract({
      success: true,
      extraction: {
        problemText: '36 + 27 = ?',
        studentAnswer: '53',
        correctAnswerCandidate: '63',
        confidence: 0.95,
        needsUserConfirmation: false,
      },
    });

    await mockApi.mockCreateMistakeSession({
      success: true,
      session: { id: 'session-1', status: 'ready_to_generate' },
      liveUrl: 'http://localhost:3000/mistake/session/session-1',
    });
    await mockApi.mockPatchMistakeSession({
      success: true,
      session: {
        id: 'session-1',
        status: 'live',
        classroomId: 'mock-classroom-1',
      },
    });
    await mockApi.setupGenerationMocks();

    await page.goto('/mistake');
    await page.setInputFiles('input[type="file"]', path.resolve('public/logos/kimi.png'));
    await page.getByRole('button', { name: '拍照识题' }).click();

    await page.waitForURL('**/generation-preview');
  });

  test('low confidence extraction stays on page for light confirmation', async ({ page, mockApi }) => {
    await mockApi.mockMistakeExtract({
      success: true,
      extraction: {
        problemText: '24 ÷ 6 = ?',
        studentAnswer: '',
        correctAnswerCandidate: '4',
        confidence: 0.62,
        needsUserConfirmation: true,
      },
    });

    await page.goto('/mistake');
    await page.setInputFiles('input[type="file"]', path.resolve('public/logos/kimi.png'));
    await page.getByRole('button', { name: '拍照识题' }).click();

    const problemField = page.getByLabel('题干');
    const studentAnswerField = page.getByLabel('学生答案');
    const correctAnswerField = page.getByLabel('正确答案候选');

    await expect(problemField).toHaveValue('24 ÷ 6 = ?');
    await expect(problemField.locator('..')).toHaveCSS('display', 'grid');
    await expect(studentAnswerField.locator('..')).toHaveCSS('display', 'grid');
    await expect(correctAnswerField.locator('..')).toHaveCSS('display', 'grid');
    await expect(page.getByRole('button', { name: '开始讲解' })).toBeVisible();
  });
});
