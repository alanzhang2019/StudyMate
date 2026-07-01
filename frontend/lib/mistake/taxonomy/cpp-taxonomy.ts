import type { CppMistakeCode } from '@/lib/mistake/domain/types';
import type { MistakeLabel } from './math-taxonomy';

export const cppMistakeTaxonomy: Record<CppMistakeCode, MistakeLabel> = {
  compile_error: {
    name: '编译错误',
    description: 'C++ 代码无法通过编译（CE）。',
    triggers: ['语法错', '缺分号', '未声明变量', '头文件缺失'],
  },
  wrong_answer: {
    name: '答案错误',
    description: '代码能跑但结果不对（WA）。',
    triggers: ['思路错', '边界遗漏', '题意理解偏差'],
  },
  runtime_error: {
    name: '运行错误',
    description: '运行时崩溃（RE），例如段错误、越界、除零。',
    triggers: ['段错误', '越界', '除零', '爆栈', '空指针'],
  },
  time_limit: {
    name: '时间超限',
    description: '算法太慢，超出题目时间限制（TLE）。',
    triggers: ['O(n^2) 过高', '未优化', '常数大'],
  },
  memory_limit: {
    name: '内存超限',
    description: '占用的内存超过限制（MLE）。',
    triggers: ['数组过大', '递归太深', '未释放'],
  },
  output_format: {
    name: '输出格式错误',
    description: '输出与标准答案格式不一致（PE）。',
    triggers: ['多换行', '多空格', '大小写', '忘了 flush'],
  },
  concept_gap: {
    name: '概念理解不足',
    description: '尚未掌握题目涉及的算法或数据结构。',
    triggers: ['看不懂题', '没思路', '知识点缺失'],
  },
};
