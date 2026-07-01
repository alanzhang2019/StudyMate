import type { CppMistakeCode } from '@/lib/mistake/domain/types';
import { cppMistakeTaxonomy } from '@/lib/mistake/taxonomy/cpp-taxonomy';

const map: Record<Exclude<CppMistakeCode, 'concept_gap'>, string> = {
  compile_error:
    '这段代码没通过编译，先把编译器报的第一行错误看清楚，再回去查那一行附近的语法。',
  wrong_answer:
    '这段代码能跑出结果但答案是错的。先用最简单的样例手算一遍，再把代码每一步的中间值打出来对比。',
  runtime_error:
    '程序在运行时崩溃了，常见原因是数组越界、除零、指针为空或递归太深。先把出问题的输入范围列出来，再回去查对应分支。',
  time_limit:
    '你的算法太慢。先估算当前复杂度，如果题目数据大就要换更快的思路（比如用前缀和、单调队列、二分等）。',
  memory_limit:
    '占的内存太大了。先看看是不是数组开大了，或者递归/栈太深，能改成迭代或扩大用堆就更好。',
  output_format:
    '输出和标准答案格式不一致。常见问题：多一个换行或少一个空格、大小写错了、忘了输出换行。用 diff 工具对着样例对比最快。',
};

export function explainCppForChild(code: CppMistakeCode, _problemText?: string): string {
  if (code === 'concept_gap') {
    return `这道题更像是${cppMistakeTaxonomy.concept_gap.name}。先把题目意思、输入、输出和样例说清楚，再想用什么算法。`;
  }
  return map[code];
}
