import { expect, test } from '../fixtures/base';

test.describe('mistake live session page', () => {
  test('shows a fallback message on the deprecated waiting page', async ({ page, mockApi }) => {
    await mockApi.mockGetMistakeSession([
      {
        success: true,
        session: {
          id: 'session-1',
          status: 'waiting_first_scene',
          confirmed: { problemText: '36 + 27 = ?', studentAnswer: '53', correctAnswer: '63' },
        },
      },
    ]);

    await page.goto('/mistake/session/session-1');
    await expect(page.getByText('此页面不再作为主入口')).toBeVisible();
    await expect(page.getByRole('link', { name: '返回重新拍题' })).toBeVisible();
  });

  test('shows failure state when the mistake session job has failed', async ({ page, mockApi }) => {
    await mockApi.mockGetMistakeSession([
      {
        success: true,
        session: {
          id: 'session-1',
          status: 'failed',
          classroomJobId: 'job-1',
          error: 'rate limit reached for RPM',
          confirmed: { problemText: '36 + 27 = ?', studentAnswer: '53', correctAnswer: '63' },
        },
      },
    ]);

    await page.goto('/mistake/session/session-1');
    await expect(page.getByText('讲解生成失败')).toBeVisible();
    await expect(page.getByText('rate limit reached for RPM')).toBeVisible();
    await expect(page.getByRole('link', { name: '返回重新拍题' })).toBeVisible();
  });
});
