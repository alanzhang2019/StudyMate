import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '深圳九年义务教育系列教材 | 作业通',
  description:
    '深圳九年义务教育在用教材电子版：语文（部编版）、数学（北师大版）、英语（沪教牛津版）、科学（教科版）等 10 科 89 册，覆盖 1-9 年级，支持在线阅读与下载。',
};

export default function TextbooksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
