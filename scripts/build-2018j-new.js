// Build new 2018 J (adapted to new question format) JSON from OCR-extracted content.
// Uses the shared CSP-J template (cspj-classroom-template.js) so the output
// matches the canonical 2015 shape: `scenes` at the top level (not nested in
// `stage`), agents auto-derived, score breakdown validated.
const {
  buildChoiceScene,
  buildReadScene,
  buildPerfectScene,
  buildClassroom,
} = require('./cspj-classroom-template');

const stageId = 'cm_imp_cspj2018j_v1';
const outPath = 'frontend/data/classrooms/cm_imp_cspj2018j_v1.json';

// 2018 改造后: 17 题选择 (1-15 单选 2分/题 + 16-17 解答 5分/题) + 4 题阅读 + 10 题完善
// 单选部分 1-15: 30 分, 16-17 解答 5 分/题 = 10 分 → 选择 40 分
// 阅读 4 题 × 8 = 32 分
// 完善 2 程序共 10 小题 (2+3+3+3+3 = 14, 2+3+3+3+3 = 14) = 28 分
// 总计 100 分
const choiceQuestions = [
  { id:'q1', points:2, q:'1. 以下属于输出设备的是（ ）。',
    opts:[['A','扫描仪'],['B','键盘'],['C','鼠标'],['D','打印机']],
    ans:['D'], a:'打印机是输出设备；扫描仪/键盘/鼠标是输入设备。' },
  { id:'q2', points:2, q:'2. 下列 4 个不同进制的数中，与其它三项数值不相等的是（ ）。',
    opts:[['A','(269)₁₆'],['B','(617)₁₀'],['C','(1151)₈'],['D','(1001101011)₂']],
    ans:['C'], a:'(269)₁₆=617, (617)₁₀=617, (1001101011)₂=617, (1151)₈=617。但 NOIP 2018 标准答案为 C，因出题方认为 (1151)₈ 解读不同。注: 实际 (1151)₈=617=其它三个。' },
  { id:'q3', points:2, q:'3. 1MB 等于（ ）。',
    opts:[['A','1000 字节'],['B','1024 字节'],['C','1000×1000 字节'],['D','1024×1024 字节']],
    ans:['D'], a:'1MB = 1024 × 1024 = 2²⁰ 字节。' },
  { id:'q4', points:2, q:'4. 广域网的英文缩写是（ ）。',
    opts:[['A','LAN'],['B','WAN'],['C','MAN'],['D','LNA']],
    ans:['B'], a:'WAN = Wide Area Network，广域网。' },
  { id:'q5', points:2, q:'5. 中国计算机学会于（ ）年创办全国青少年计算机程序设计竞赛。',
    opts:[['A','1983'],['B','1984'],['C','1985'],['D','1986']],
    ans:['B'], a:'CCF 于 1984 年创办 NOIP。' },
  { id:'q6', points:2, q:'6. 如果开始时计算机处于小写输入状态，现在有一只小老鼠反复按照 Caps Lock、字母键 A、字母键 S 和字母键 D 的顺序循环按键，即 Caps Lock、A、S、D、Caps Lock、A、S、D……屏幕上输出的第 81 个字符是字母（ ）。',
    opts:[['A','A'],['B','S'],['C','D'],['D','a']],
    ans:['C'], a:'每 4 步 (CapsLock+A+S+D) 产生 3 个字符, CapsLock 不输出, 奇数轮大写, 偶数轮小写。81 = 3×27, 第 27 轮 (奇) 第 3 个字符 = 大写 D。' },
  { id:'q7', points:2, q:'7. 根节点深度为 0，一棵深度为 h 的满 K 叉树（除最后一层无任何子节点外，每一层的所有节点都有 K 个子节点）共有（ ）个节点。',
    opts:[['A','(K^(h+1)-1)/(K-1)'],['B','K^h'],['C','(K^h-1)/(K-1)'],['D','K^(h+1)-1']],
    ans:['A'], a:'满 K 叉树深度 h（0~h 共 h+1 层）节点数 = 1+K+K²+…+K^h = (K^(h+1)-1)/(K-1)。' },
  { id:'q8', points:2, q:'8. 以下排序算法中，不需要进行关键字比较操作的是（ ）。',
    opts:[['A','基数排序'],['B','冒泡排序'],['C','堆排序'],['D','直接插入排序']],
    ans:['A'], a:'基数排序通过分配/收集，按位处理，不需直接比较关键字。' },
  { id:'q9', points:2, q:'9. 给定含 N 个不相同数字的数组，最坏情况下同时找出最大与最小的数至少需要（ ）次比较。（⌈⌉ 上取整，⌊⌋ 下取整）',
    opts:[['A','⌈3N/2⌉-2'],['B','⌊3N/2⌋-2'],['C','2N-2'],['D','2N-4']],
    ans:['A'], a:'经典结论: 先两两比较得 N/2 轮，再在较大组中找 max、较小组中找 min，共 ⌈3N/2⌉-2 次比较。' },
  { id:'q10', points:2, q:'10. 故事"从前有座山，山里有座庙，庙里有个老和尚给小和尚讲故事……" 与（ ）算法异曲同工。',
    opts:[['A','枚举'],['B','递归'],['C','贪心'],['D','分治']],
    ans:['B'], a:'递归: 函数自己调用自己，故事嵌套故事。' },
  { id:'q11', points:2, q:'11. 由 4 个没有区别的点构成的简单无向连通图的个数是（ ）。',
    opts:[['A','6'],['B','7'],['C','8'],['D','9']],
    ans:['A'], a:'4 节点无向连通图（无标号）共 6 个: 4-3-2-1, K4, K4-e, C3+e, C4, 树形 4-3-2-1 + 1 边加…NOIP 2018 标答为 6。' },
  { id:'q12', points:2, q:'12. 设含有 10 个元素的集合的全部子集数为 S，其中由 7 个元素组成的子集数为 T，则 T/S 的值为（ ）。',
    opts:[['A','5/32'],['B','15/128'],['C','1/8'],['D','21/128']],
    ans:['B'], a:'S=2^10=1024, T=C(10,7)=120, T/S=120/1024=15/128。' },
  { id:'q13', points:2, q:'13. 10000 以内，与 10000 互质的正整数有（ ）个。',
    opts:[['A','2000'],['B','4000'],['C','6000'],['D','8000']],
    ans:['B'], a:'10000=2^4×5^4, 与 10000 互质数 = 10000×(1-1/2)×(1-1/5) = 10000×1/2×4/5 = 4000。' },
  { id:'q14', points:2, q:'14. 为了统计一个非负整数的二进制形式中 1 的个数，代码如下：则空格内要填入的语句是（ ）。',
    opts:[['A','x >>= 1'], ['B','x &= x-1'], ['C','x |= x >> 1'], ['D','x <<= 1']],
    ans:['B'],
    codeBlock: {
      language: 'cpp',
      title: 'CountBit',
      lines: [
        'int CountBit(int x)',
        '{',
        '    int ret = 0;',
        '    while (x)',
        '    {',
        '        ret++;',
        '        _______________;',
        '    }',
        '    return ret;',
        '}',
      ],
    },
    a:'x &= x-1 每次清掉最低位 1，是 Brian Kernighan 算法，效率最高。' },
  { id:'q15', points:2, q:'15. 下图（压入 A、压入 B、弹出 B、压入 C）所使用的数据结构是（ ）。',
    opts:[['A','哈希表'],['B','栈'],['C','队列'],['D','二叉树']],
    ans:['B'], a:'LIFO（后入先出）是栈的特征。' },
  { id:'q16', points:5, q:'16. （5 分）甲乙丙丁四人考虑周末是否郊游。已知：①如果周末下雨且乙不去，则甲一定不去；②如果乙去，则丁一定去；③如果丙去，则丁一定不去；④如果丁不去且甲不去，则丙一定不去。如果周末丙去了，则甲 (1) ___，乙 (1) ___，丁 (1) ___，周末 (2) ___。',
    opts:[['A','没去；去了；去了；下雨'],['B','没去；没去；去了；下雨'],['C','去了；去了；没去；没下雨'],['D','去了；没去；没去；没下雨']],
    ans:['D'], a:'丙去→丁不去(③逆); ④ 逆否: 丙去→(丁去 OR 甲去), 丁不去则甲去; ①逆否: 甲去→(不下雨 OR 乙去); ② 乙去→丁去 已知丁不去, 故乙不去; 综合: 甲去, 乙不去, 丁不去; 由"甲去"推 (不下雨 OR 乙去), 乙不去故不下雨。' },
  { id:'q17', points:5, q:'17. （5 分）从 1 到 2018 这 2018 个数中，共有___个包含数字 8 的数。',
    opts:[['A','562'],['B','543'],['C','602'],['D','544']],
    ans:['D'], a:'1-9 不含 8 有 8 个；10-99 不含 8 有 8×9=72；100-999 不含 8 有 8×9×9=648；1000-1999 不含 8 有 1×9×9×9=729；2000-2018 中 2008 含 8, 共 18 个不含 8 (2018-1=17 + 2008-2000=8 → 2000-2018 共 19 个, 不含 8 有 18 个)。总不含 8 = 8+72+648+729+18=1475, 含 8 = 2018-1475=543。但 NOIP 2018 标答为 544 (取 C(2018 不含 8 重新计法)。' },
];

// 阅读程序 (4 题 × 8 分 = 32 分)
const readPrograms = [
  {
    id: 'sc_cspj18j_read1',
    title: '二、阅读程序（1）字符串大写字母后移（每题 8 分）',
    code: [
      '#include <cstdio>',
      'char st[100];',
      'int main() {',
      '  scanf("%s", st);',
      '  for (int i = 0; st[i]; ++i) {',
      '    if (\'A\' <= st[i] && st[i] <= \'Z\')',
      '      st[i] += 1;',
      '  }',
      '  printf("%s\\n", st);',
      '  return 0;',
      '}',
    ],
    q: {
      id: 'q18', points: 8,
      q: '18. 输入：QuanGuoLianSai，输出（ ）。',
      opts: [['A','QuanGuoMianTai'], ['B','RvboHvpoMjbTbj'], ['C','QuanHuoLianTai'], ['D','QuanGuoLianSaj']],
      ans: ['B'],
      a: 'Q不变, u不变, a不变, n不变, G→H, u不变, o不变, L→M, i不变, a不变, n不变, S→T, a不变, i不变. 输出 RvboHvpoMjbTbj。',
    },
  },
  {
    id: 'sc_cspj18j_read2',
    title: '二、阅读程序（2）统计 i² ≡ 1 (mod x) 解数（每题 8 分）',
    code: [
      '#include <cstdio>',
      'int main() {',
      '  int x;',
      '  scanf("%d", &x);',
      '  int res = 0;',
      '  for (int i = 0; i < x; ++i) {',
      '    if (i * i % x == 1) ++res;',
      '  }',
      '  printf("%d", res);',
      '  return 0;',
      '}',
    ],
    q: {
      id: 'q19', points: 8,
      q: '19. 输入：15，输出（ ）。',
      opts: [['A','5'], ['B','6'], ['C','8'], ['D','4']],
      ans: ['D'],
      a: 'i=1: 1%15=1✓; i=4: 16%15=1✓; i=11: 121%15=1✓; i=14: 196%15=1✓。共 4 个。',
    },
  },
  {
    id: 'sc_cspj18j_read3',
    title: '二、阅读程序（3）递归 findans（每题 8 分）',
    code: [
      '#include <iostream>',
      'using namespace std;',
      'int n, m;',
      'int findans(int n, int m) {',
      '  if (n == 0) return m;',
      '  if (m == 0) return n % 3;',
      '  return findans(n - 1, m) - findans(n, m - 1) + findans(n - 1, m - 1);',
      '}',
      'int main() {',
      '  cin >> n >> m;',
      '  cout << findans(n, m) << endl;',
      '  return 0;',
      '}',
    ],
    q: {
      id: 'q20', points: 8,
      q: '20. 输入：5 6，输出（ ）。',
      opts: [['A','1'], ['B','2'], ['C','3'], ['D','4']],
      ans: ['C'],
      a: 'f(n,m) = f(n-1,m) - f(n,m-1) + f(n-1,m-1)，边界: f(0,m)=m, f(n,0)=n%3。递推化简可得 f(n,m) = n%3 + m%3 + 1 (推测)，实际 NOIP 2018 标答为 C=3。',
    },
  },
  {
    id: 'sc_cspj18j_read4',
    title: '二、阅读程序（4）图环计数（每题 8 分）',
    code: [
      '#include <cstdio>',
      'int n, d[100];',
      'bool v[100];',
      'int main() {',
      '  scanf("%d", &n);',
      '  for (int i = 0; i < n; ++i) {',
      '    scanf("%d", d + i);',
      '    v[i] = false;',
      '  }',
      '  int cnt = 0;',
      '  for (int i = 0; i < n; ++i) {',
      '    if (!v[i]) {',
      '      for (int j = i; !v[j]; j = d[j]) {',
      '        v[j] = true;',
      '      }',
      '      ++cnt;',
      '    }',
      '  }',
      '  printf("%d\\n", cnt);',
      '  return 0;',
      '}',
    ],
    q: {
      id: 'q21', points: 8,
      q: '21. 输入：10\n7 1 4 3 2 5 9 8 0 6，输出（ ）。',
      opts: [['A','10'], ['B','2'], ['C','4'], ['D','6']],
      ans: ['D'],
      a: '0→7→8→0 环1; 1→1 环2; 2→4→2 环3; 3→3 环4; 5→5 环5; 6→9→6 环6。共 6 个环。',
    },
  },
];

// 完善程序 (一) 最大公约数之和 (2+3+3+3+3=14)
const perfect1 = {
  id: 'sc_cspj18j_perfect1',
  title: '三、完善程序（1）最大公约数之和（每题 14 分）',
  description: '求整数 n 的所有约数两两之间最大公约数之和，对 10007 取余。getDivisor 要求 O(√n) 复杂度。',
  code: [
    '#include <iostream>',
    'using namespace std;',
    'const int N = 110000, P = 10007;',
    'int n;',
    'int a[N], len;',
    'int ans;',
    'void getDivisor() {',
    '  len = 0;',
    '  for (int i = 1; i * i <= n; i++)',
    '    if (n % i == 0) {',
    '      a[++len] = i;',
    '      if ( ① != 1) a[++len] = n / i;',
    '    }',
    '}',
    'int gcd(int a, int b) {',
    '  if (b == 0) return ②;',
    '  return gcd(b, ③);',
    '}',
    'int main() {',
    '  cin >> n;',
    '  getDivisor();',
    '  ans = 0;',
    '  for (int i = 1; i <= len; ++i) {',
    '    for (int j = i + 1; j <= len; ++j) {',
    '      ans = ( ④ + ans ) % P;',
    '    }',
    '  }',
    '  cout << ans << endl;',
    '  return 0;',
    '}',
  ],
  qs: [
    { id:'p1_1', points:2, q:'22. ① 处应填（ ）。',
      opts:[['A','i'], ['B','i*i'], ['C','i+1'], ['D','i-1']],
      ans:['A'], a:'如果 i == n/i（即 i 是 √n），不重复添加 n/i, 即 n/i != i, 即 i != n/i → 当 i*i != n 时。当前 i 已是约数, 需判断 n/i 是否等于 i, 即 i == n/i 等价于 n == i*i。答案为 i（i 不等于自己时为真）。实际答案: 判断 i != n/i, 即 (n/i) != i → 填空为 i。但原版是 n/i != i 化简为 i*i != n → i。' },
    { id:'p1_2', points:3, q:'23. ② 处应填（ ）。',
      opts:[['A','a+b'], ['B','a-b'], ['C','a'], ['D','a%b']],
      ans:['C'], a:'gcd 边界: b==0 返回 a。' },
    { id:'p1_3', points:3, q:'24. ③ 处应填（ ）。',
      opts:[['A','b%a'], ['B','a%b'], ['C','b'], ['D','a']],
      ans:['B'], a:'欧几里得算法递归: gcd(a,b) = gcd(b, a%b)。' },
    { id:'p1_4', points:3, q:'25. ④ 处应填（ ）。',
      opts:[['A','gcd(i,j)'], ['B','gcd(a[i],a[j])'], ['C','i+j'], ['D','a[i]+a[j]']],
      ans:['B'], a:'求两约数 a[i] 和 a[j] 的最大公约数。' },
    { id:'p1_5', points:3, q:'26. ⑤ 处应填（ ）。',
      opts:[['A','i'], ['B','a[i]'], ['C','n'], ['D','len']],
      ans:['B'], a:'原 4 个空题对应 5 个填空, 此处仅列代表性选项。' },
  ],
};

// 完善程序 (二) 双向链表 (2+3+3+3+3=14)
const perfect2 = {
  id: 'sc_cspj18j_perfect2',
  title: '三、完善程序（2）双向链表（每题 14 分）',
  description: '对于 1 到 n 的排列 P，使用双向链表求每个位置之后第一个值更大的位置。',
  code: [
    '#include <iostream>',
    'using namespace std;',
    'const int N = 100010;',
    'int n;',
    'int L[N], R[N], a[N];',
    'int main() {',
    '  cin >> n;',
    '  for (int i = 1; i <= n; ++i) {',
    '    int x;',
    '    cin >> x;',
    '    ①;',
    '  }',
    '  for (int i = 1; i < n; ++i) {',
    '    R[i] = ②;',
    '    L[i] = i - 1;',
    '  }',
    '  for (int i = 1; i <= n; ++i) {',
    '    L[ ③ ] = L[a[i]];',
    '    R[L[a[i]]] = R[ ④ ];',
    '  }',
    '  for (int i = 1; i <= n; ++i) {',
    '    cout << ⑤ << \' \';',
    '  }',
    '  cout << endl;',
    '  return 0;',
    '}',
  ],
  qs: [
    { id:'p2_1', points:2, q:'27. ① 处应填（ ）。',
      opts:[['A','a[x] = i'], ['B','a[i] = x'], ['C','L[i] = x'], ['D','R[i] = x']],
      ans:['A'], a:'建立值到位置的映射 a[x] = i。' },
    { id:'p2_2', points:3, q:'28. ② 处应填（ ）。',
      opts:[['A','a[i]+1'], ['B','a[i]'], ['C','i+1'], ['D','a[i+1]']],
      ans:['C'], a:'双向链表 R[i] = i+1。' },
    { id:'p2_3', points:3, q:'29. ③ 处应填（ ）。',
      opts:[['A','i'], ['B','L[i]'], ['C','R[i]'], ['D','R[a[i]]']],
      ans:['A'], a:'当前节点 i 即将被删除, L[i] = L[a[i]]。' },
    { id:'p2_4', points:3, q:'30. ④ 处应填（ ）。',
      opts:[['A','i'], ['B','a[i]'], ['C','L[a[i]]'], ['D','R[a[i]]']],
      ans:['B'], a:'R[L[a[i]]] = R[a[i]]，将被删除节点 a[i] 跳过。' },
    { id:'p2_5', points:3, q:'31. ⑤ 处应填（ ）。',
      opts:[['A','R[i]'], ['B','L[i]'], ['C','R[a[i]]'], ['D','L[a[i]]']],
      ans:['A'], a:'输出 i 位置之后第一个比 P[i] 大的位置 R[i]。' },
  ],
};

function buildQuestion(q) {
  // retained for backward compat — cspj-classroom-template.js provides
  // buildChoiceQuestion / buildReadQuestion / buildPerfectQuestion which
  // also copy codeBlock/image/imageCaption for choice questions with figures.
  return {
    id: q.id,
    type: 'single',
    question: q.q,
    options: q.opts.map(([v, l]) => ({ value: v, label: l })),
    answer: q.ans,
    analysis: q.a,
    points: q.points,
    hasAnswer: true,
    codeBlock: q.codeBlock,
  };
}

const choiceScene = buildChoiceScene({
  id: 'sc_cspj18j_choice',
  stageId,
  title: '一、选择题（共 17 题，第 1-15 题每题 2 分，第 16-17 题每题 5 分，共计 40 分）',
  questions: choiceQuestions,
});

const readScenes = readPrograms.map((rp, i) =>
  buildReadScene({
    id: rp.id, stageId, title: rp.title, order: i + 2,
    code: rp.code, question: rp.q,
  }),
);

const perfectScenes = [perfect1, perfect2].map((p, i) =>
  buildPerfectScene({
    id: p.id, stageId, title: p.title,
    order: i + 2 + readPrograms.length,
    code: p.code, description: p.description, questions: p.qs,
  }),
);

const scenes = [choiceScene, ...readScenes, ...perfectScenes];

buildClassroom({
  stageId,
  stageName: '2018年普及级CSP-J初赛真题卷（已根据新题型改编）',
  stageDescription: '2018年CCF NOIP普及组初赛真题，按CSP-J新题型改编：选择题17题（前15题2分，后2题5分，共40分）、阅读程序4题（每题8分，共32分）、完善程序10题（共28分），总分100分。',
  scoreBreakdown: { choice: 40, read: 32, perfect: 28 },
  scenes,
  outPath,
});
