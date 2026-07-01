import type { CppMistakeCode, PracticeSuggestion } from '@/lib/mistake/domain/types';

const practiceMap: Record<CppMistakeCode, [PracticeSuggestion, PracticeSuggestion]> = {
  compile_error: [
    { prompt: '把下面这段代码改对：int a = 1 cout << a', answer: 'int a = 1; cout << a;' },
    { prompt: '检查你的代码：是否每个 if/for 都有花括号？', answer: '加花括号' },
  ],
  wrong_answer: [
    { prompt: '用样例 1 手算一遍，再把代码每步中间值打出来对比', answer: '找到第一个不一致的步骤' },
    { prompt: '边界条件都覆盖了吗？n=0、n=1、最大最小值？', answer: '补边界测试' },
  ],
  runtime_error: [
    { prompt: '检查所有数组下标是否可能越界', answer: '加范围判断' },
    { prompt: '递归深度是否可能超过 10^5？', answer: '改成迭代或加大栈' },
  ],
  time_limit: [
    { prompt: '把 O(n^2) 改写成 O(n log n) 或 O(n)', answer: '用更快的算法' },
    { prompt: '用前缀和 / 双指针 / 二分 优化', answer: '减少嵌套循环' },
  ],
  memory_limit: [
    { prompt: '把 vector<int> 改成 vector<short> 或位图', answer: '减小每个元素' },
    { prompt: '释放不需要的 vector', answer: '用 .clear() + shrink_to_fit()' },
  ],
  output_format: [
    { prompt: '用 diff 对比输出和样例，注意空格、换行、大小写', answer: '修正格式' },
    { prompt: '所有 cout 是否都加了 endl 或 \\n？', answer: '加换行' },
  ],
  concept_gap: [
    { prompt: '把题目的输入、输出、样例说一遍', answer: '按题意复述即可' },
    { prompt: '先想用什么算法 / 数据结构，再开始写', answer: '列出思路再写代码' },
  ],
};

export function generateCppPractice(code: CppMistakeCode): PracticeSuggestion[] {
  return practiceMap[code];
}
