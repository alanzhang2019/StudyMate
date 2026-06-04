export function normalizeFetchErrorMessage(
  error: unknown,
  context?: { fileSizes?: number[] },
): string {
  const sizes = context?.fileSizes ?? [];
  const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
  const totalMb = totalBytes > 0 ? (totalBytes / (1024 * 1024)).toFixed(2) : null;

  const isNetworkError =
    error instanceof TypeError ||
    (error instanceof Error &&
      /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(error.message));

  if (isNetworkError) {
    const sizeHint = totalMb ? `（本次上传约 ${totalMb}MB）` : '';
    return [
      `网络请求失败${sizeHint}。`,
      '如果你是通过花生壳/反向代理访问，常见原因是：上传体积或 multipart/form-data 被代理限制/中断，浏览器会直接报 Failed to fetch。',
      '处理建议：',
      '1）在花生壳里开启/提高“POST/大文件上传”限额（或换 TCP 穿透 + 本机 Nginx 反代）。',
      '2）把图片裁剪/压缩后再试（手机原图往往 3-10MB）。',
      '3）优先用 http 方案先验证链路（https 证书/协议也可能导致中断）。',
    ].join('\n');
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return '网络请求失败，请重试';
}
