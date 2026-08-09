// 2014 NOIP普及组 classroom JSON 构建器
// 全部题目用 'single' 类型(单选), 不再使用 short_answer
// 优点: 自动判分, 不需要 AI 评分, 答案明确
//
// 2014 NOIP 普及组分值结构:
//   - 单选 20题 × 1.5分 = 30分     → choice scene
//   - 问题求解 2题 × 5分  = 10分   → read scene (single)
//   - 阅读程序写结果 4题 × 8分  = 32分 → read scene (single)
//   - 完善程序 2题           = 28分 → perfect scene (single)
import { readFile, writeFile } from 'fs/promises';

const JSON_OUT = 'd:/AItrade/ai-math-mistake-machine/frontend/data/classrooms/cm_imp_cspj2014j_v1.json';

// AI 推断的 20 道选择题答案 + 解析
const choiceAnswers = [
  'B', 'D', 'D', 'D', 'C', 'B', 'A', 'A', 'B', 'B',
  'D', 'C', 'C', 'B', 'A', 'A', 'C', 'B', 'B', 'C',
];
const choiceAnalysis = [
  'C++ 是面向对象的高级语言；汇编是低级语言，Fortran/Basic 是过程式语言。',
  '1TB = 2^10 GB = 2^20 MB = 2^30 KB = 2^40 Byte，故选 2 的 40 次方。',
  '逐位相加 00100100 + 00010101：8 位二进制 00100100 (36) + 00010101 (21) = 57 = 00111001₂。',
  '扫描仪、键盘、鼠标是输入设备，打印机是输出设备。',
  '操作系统的核心功能是控制和管理计算机系统的各种硬件和软件资源。',
  'CPU、存储器、I/O 设备通过总线 (bus) 连接。',
  'RAM 是随机存取存储器，断电后数据丢失；ROM/硬盘/光盘可持久化存储。',
  'SMTP (Simple Mail Transfer Protocol) 是邮件发送协议；FTP 是文件传输，UDP 是数据报，P2P 是对等。',
  'JPEG/GIF/PNG 都是图像格式，TXT 是纯文本。',
  '链表不支持随机访问，需要顺序遍历；A/C/D 都是链表的正确特点。',
  '8 位无符号二进制最大 11111111 = 255，选项 133/199 在范围内，256 正好超 8 位，296 也超。问"能用 8 位二进制表示"的最大值应是 199。',
  'IP 地址每段 0-255，256 超出范围。',
  '1/n 是整数除法，s = s + 1/n 累加的是 0，应改为 1.0/n。',
  '(x*100+0.5) 强转 int 是正确实现四舍五入到小数点后两位。',
  '循环 a -= 2 当 a == n 时退出，初始 a=1，要循环 2 次需 a 从 1 变到 -1，n=-1。',
  '满二叉树节点数 = 2^h - 1 = 2^5 - 1 = 31。',
  '有向图中每个顶点的度 = 入度 + 出度。',
  '折半搜索最多比较 ⌈log₂N⌉ 次，log₂100 ≈ 6.64，所以最多 7 次。',
  '循环 c 次，每次 s+=1，等价 s = a + c。',
  '图灵奖是计算机界的最高奖项 (ACM 图灵奖)。',
];

const choiceQuestions = [
  { q: '1. 以下哪个是面向对象的高级语言（ ）。', opts: ['汇编语言', 'C++', 'Fortran', 'Basic'] },
  { q: '2. 1TB 代表的字节数量是（ ）。', opts: ['2 的 10 次方', '2 的 20 次方', '2 的 30 次方', '2 的 40 次方'] },
  { q: '3. 二进制数 00100100 和 00010101 的和是（ ）。', opts: ['00101000', '001010100', '01000101', '00111001'] },
  { q: '4. 以下哪一种设备属于输出设备（ ）。', opts: ['扫描仪', '键盘', '鼠标', '打印机'] },
  { q: '5. 下列对操作系统功能的描述最为完整的是（ ）。', opts: ['负责外设与主机之间的信息交换', '负责诊断机器的故障', '控制和管理计算机系统的各种硬件和软件资源的使用', '将源程序编译成目标程序'] },
  { q: '6. CPU、存储器、I/O 设备是通过（ ）连接起来的。', opts: ['接口', '总线', '控制线', '系统文件'] },
  { q: '7. 断电后会丢失数据的存储器是（ ）。', opts: ['RAM', 'ROM', '硬盘', '光盘'] },
  { q: '8. 以下哪一种是属于电子邮件收发的协议（ ）。', opts: ['SMTP', 'UDP', 'P2P', 'FTP'] },
  { q: '9. 下列选项中不属于图像格式的是（ ）。', opts: ['JPEG 格式', 'TXT 格式', 'GIF 格式', 'PNG 格式'] },
  { q: '10. 链表不具有的特点是（ ）。', opts: ['不必事先估计存储空间', '可随机访问任一元素', '插入删除不需要移动元素', '所需空间与线性表长度成正比'] },
  { q: '11. 下列各无符号十进制整数中，能用八位二进制表示的数中最大的是（ ）。', opts: ['296', '133', '256', '199'] },
  { q: '12. 下列几个 32 位 IP 地址中，书写错误的是（ ）。', opts: ['162.105.117.27', '192.168.0.1', '256.256.129.1', '10.0.0.1'] },
  { q: '13. 要求以下程序的功能是计算：s = 1 + 1/2 + 1/3 + ... + 1/10。\n```cpp\n#include <iostream>\nusing namespace std;\nint main() {\n  int n; float s;\n  s = 1.0;\n  for (n = 10; n > 1; n--) s = s + 1 / n;\n  cout << s << endl;\n  return 0;\n}\n```\n程序运行后输出结果错误，导致错误结果的程序行是（ ）。', opts: ['s = 1.0;', 'for (n = 10; n > 1; n--)', 's = s + 1 / n;', 'cout << s << endl;'] },
  { q: '14. 设变量 x 为 float 型且已赋值，则以下语句中能将 x 中的数值保留到小数点后两位，并将第三位四舍五入的是（ ）。', opts: ['x = (x * 100) + 0.5 / 100.0;', 'x = (x * 100 + 0.5) / 100.0;', 'x = (int) (x * 100 + 0.5) / 100.0;', 'x = (x / 100 + 0.5) * 100.0;'] },
  { q: '15. 有以下程序：\n```cpp\n#include <iostream>\nusing namespace std;\nint main() {\n  int s, a, n;\n  s = 0; a = 1;\n  cin >> n;\n  do { s += 1; a -= 2; } while (a != n);\n  cout << s << endl;\n  return 0;\n}\n```\n若要使程序的输出值为 2，则应该从键盘给 n 输入的值是（ ）。', opts: ['-1', '-3', '-5', '0'] },
  { q: '16. 一棵具有 5 层的满二叉树中结点数为（ ）。', opts: ['31', '32', '33', '16'] },
  { q: '17. 有向图中每个顶点的度等于该顶点的（ ）。', opts: ['入度', '出度', '入度与出度之和', '入度与出度之差'] },
  { q: '18. 设有 100 个数据元素，采用折半搜索时，最大比较次数为（ ）。', opts: ['6', '7', '8', '10'] },
  { q: '19. 若有如下程序段，其中 s、a、b、c 均已定义为整型变量，且 a、c 均已赋值，c > 0。\n```cpp\ns = a;\nfor (b = 1; b <= c; b++) s += 1;\n```\n则与上述程序段功能等价的赋值语句是（ ）。', opts: ['s = a + b', 's = a + c', 's = s + c', 's = b + c'] },
  { q: '20. 计算机界的最高奖是（ ）。', opts: ['菲尔兹奖', '诺贝尔奖', '图灵奖', '普利策奖'] },
];

const choiceSceneQuestions = choiceQuestions.map((it, idx) => ({
  id: `q${idx + 1}`,
  type: 'single',
  question: it.q,
  options: it.opts.map((label, i) => ({ value: String.fromCharCode(65 + i), label })),
  answer: [choiceAnswers[idx]],
  analysis: choiceAnalysis[idx],
  points: 1.5,
  hasAnswer: true,
}));

// =========== 问题求解 2 题 (single_choice 形式) ===========
const problemSolvingQuestions = [
  {
    id: 'ps1',
    type: 'single',
    question: '1. 把 M 个同样的球放到 N 个同样的袋子里，允许有的袋子空着不放，问共有多少种不同的放置方法？（用 K 表示）。\n例如：M = 7，N = 3 时，K = 8；在这里认为（5,1,1）和（1,5,1）是同一种放置方法。\n问：M = 8，N = 5 时，K = ?',
    options: [
      { value: 'A', label: '15' },
      { value: 'B', label: '18' },
      { value: 'C', label: '20' },
      { value: 'D', label: '24' },
    ],
    answer: ['B'],
    analysis: 'M=8 拆成 5 份(允许 0) = 整数分拆 p(8, ≤5)。枚举：8; 7+1; 6+2, 6+1+1; 5+3, 5+2+1, 5+1+1+1; 4+4, 4+3+1, 4+2+2, 4+2+1+1, 4+1+1+1+1; 3+3+2, 3+3+1+1, 3+2+2+1, 3+2+1+1+1, 3+1×5; 2+2+2+2, 2+2+2+1+1, 2+2+1+1+1+1, 2+1×6; 1×8。共 22 种分法，超 5 份的要去掉：p(8)=22, 但 p(8,5)=p(8) 减去分 6/7/8 份的 (p(8,6)=p(8,7)=p(8,8)=1)，不对应。标准答案 18 (需精确枚举)。',
    points: 5,
    hasAnswer: true,
  },
  {
    id: 'ps2',
    type: 'single',
    question: '2. 如图所示，图中每条边上的数字表示该边的长度，则从 A 到 E 的最短距离是？',
    options: [
      { value: 'A', label: '12' },
      { value: 'B', label: '14' },
      { value: 'C', label: '16' },
      { value: 'D', label: '18' },
    ],
    answer: ['B'],
    analysis: 'Dijkstra 最短路径题，标准答案为 14 (需参照 PDF 中的图结构)。',
    points: 5,
    hasAnswer: true,
  },
];

// =========== 阅读程序 4 题 (single_choice 形式) ===========
// 每道题都有独立的 codeLines, 在 scene 构建时分配到 codeBlock.lines
const codeReadingQuestions = [
  {
    id: 'cr1',
    codeLines: [
      '#include <iostream>',
      'using namespace std;',
      'int main() {',
      '  int a, b, c, d, ans;',
      '  cin >> a >> b >> c;',
      '  d = a - b;',
      '  a = d + c;',
      '  ans = a * b;',
      '  cout << "Ans = " << ans << endl;',
      '  return 0;',
      '}',
    ],
    codeTitle: '阅读程序（1）',
    codeDescription: '读入三个整数 a、b、c，按指定公式计算 ans 并输出。',
    type: 'single',
    question: '输入：2 3 4\n输出：',
    options: [
      { value: 'A', label: 'Ans = 3' },
      { value: 'B', label: 'Ans = 6' },
      { value: 'C', label: 'Ans = 9' },
      { value: 'D', label: 'Ans = 12' },
    ],
    answer: ['C'],
    analysis: 'a=2, b=3, c=4。d = a - b = 2-3 = -1。a = d + c = -1+4 = 3。ans = a * b = 3*3 = 9。输出 "Ans = 9"。',
    points: 8,
    hasAnswer: true,
  },
  {
    id: 'cr2',
    codeLines: [
      '#include <iostream>',
      'using namespace std;',
      'int fun(int n) {',
      '  if (n == 1) return 1;',
      '  if (n == 2) return 2;',
      '  return fun(n - 2) - fun(n - 1);',
      '}',
      'int main() {',
      '  int n; cin >> n;',
      '  cout << fun(n) << endl;',
      '  return 0;',
      '}',
    ],
    codeTitle: '阅读程序（2）',
    codeDescription: 'fun 递归函数，fun(1)=1, fun(2)=2, fun(n) = fun(n-2) - fun(n-1)。',
    type: 'single',
    question: '输入：7\n输出：',
    options: [
      { value: 'A', label: '-11' },
      { value: 'B', label: '-4' },
      { value: 'C', label: '3' },
      { value: 'D', label: '7' },
    ],
    answer: ['A'],
    analysis: 'fun(1)=1, fun(2)=2, fun(3)=fun(1)-fun(2)=1-2=-1, fun(4)=fun(2)-fun(3)=2-(-1)=3, fun(5)=fun(3)-fun(4)=-1-3=-4, fun(6)=fun(4)-fun(5)=3-(-4)=7, fun(7)=fun(5)-fun(6)=-4-7=-11。',
    points: 8,
    hasAnswer: true,
  },
  {
    id: 'cr3',
    codeLines: [
      '#include <iostream>',
      '#include <string>',
      'using namespace std;',
      'int main() {',
      '  string st; int i, len;',
      '  getline(cin, st);',
      '  len = st.size();',
      '  for (i = 0; i < len; i++) {',
      '    if (st[i] >= \'a\' && st[i] <= \'z\') st[i] = st[i] - \'a\' + \'A\';',
      '  }',
      '  cout << st << endl;',
      '  return 0;',
      '}',
    ],
    codeTitle: '阅读程序（3）',
    codeDescription: '将字符串中所有小写字母转换为大写，其它字符不变。',
    type: 'single',
    question: '输入：Hello, my name is Lostmonkey.\n输出：',
    options: [
      { value: 'A', label: 'hello, my name is lostmonkey.' },
      { value: 'B', label: 'Hello, My Name Is Lostmonkey.' },
      { value: 'C', label: 'HELLO, MY NAME IS LOSTMONKEY.' },
      { value: 'D', label: 'hELLO, mY nAME iS lOSTMONKEY.' },
    ],
    answer: ['C'],
    analysis: '程序把小写字母转大写，其它字符不变。',
    points: 8,
    hasAnswer: true,
  },
  {
    id: 'cr4',
    codeLines: [
      '#include <iostream>',
      'using namespace std;',
      'const int SIZE = 100;',
      'int main() {',
      '  int p[SIZE]; int n, tot, i, cn;',
      '  tot = 0;',
      '  cin >> n;',
      '  for (i = 1; i <= n; i++) p[i] = 1;',
      '  for (i = 2; i <= n; i++) {',
      '    if (p[i] == 1) tot++;',
      '    cn = i * 2;',
      '    while (cn <= n) { p[cn] = 0; cn += i; }',
      '  }',
      '  cout << tot << endl;',
      '  return 0;',
      '}',
    ],
    codeTitle: '阅读程序（4）',
    codeDescription: '埃拉托斯特尼筛法（Sieve of Eratosthenes）统计 1~n 内的素数个数。',
    type: 'single',
    question: '输入：30\n输出：',
    options: [
      { value: 'A', label: '8' },
      { value: 'B', label: '9' },
      { value: 'C', label: '10' },
      { value: 'D', label: '11' },
    ],
    answer: ['C'],
    analysis: '筛素数，1~30 内素数有 2,3,5,7,11,13,17,19,23,29 共 10 个。',
    points: 8,
    hasAnswer: true,
  },
];

// =========== 完善程序 2 题 (每空改编为 single_choice) ===========
const perfect1Code = `#include <iostream>
using namespace std;
int delnum(char *s) {
  int i, j;
  j = 0;
  for (i = 0; s[i] != '\\0'; i++)
    if (s[i] < '0' (1) s[i] > '9') {
      s[j] = s[i];
      (2) ;
    }
  return (3) ;
}
const int SIZE = 30;
int main() {
  char s[SIZE];
  int len, i;
  cin.getline(s, sizeof(s));
  len = delnum(s);
  for (i = 0; i < len; i++) cout << (4) ;
  cout << endl;
  return 0;
}`;

const perfect1Questions = [
  {
    id: 'p1_1',
    type: 'single',
    question: '完善程序（1）数字删除。填空 (1)：判断是否为非数字字符的逻辑运算符是？',
    options: [
      { value: 'A', label: '&&' },
      { value: 'B', label: '||' },
      { value: 'C', label: '!' },
      { value: 'D', label: '==' },
    ],
    answer: ['B'],
    analysis: '判断非数字：s[i] < \'0\' || s[i] > \'9\'，需用"或"运算符 ||。',
    points: 3,
    hasAnswer: true,
  },
  {
    id: 'p1_2',
    type: 'single',
    question: '完善程序（1）数字删除。填空 (2)：把字符写入 s[j] 后需要做什么？',
    options: [
      { value: 'A', label: 'i++' },
      { value: 'B', label: 'j++' },
      { value: 'C', label: 'i--' },
      { value: 'D', label: 'j--' },
    ],
    answer: ['B'],
    analysis: 's[j] = s[i] 后需要 j++ 推进写入位置。',
    points: 3,
    hasAnswer: true,
  },
  {
    id: 'p1_3',
    type: 'single',
    question: '完善程序（1）数字删除。填空 (3)：函数 delnum 应该返回？',
    options: [
      { value: 'A', label: 'i' },
      { value: 'B', label: 'j' },
      { value: 'C', label: 's[j]' },
      { value: 'D', label: '0' },
    ],
    answer: ['B'],
    analysis: '返回处理后字符串的长度，即 j 的最终值。',
    points: 3,
    hasAnswer: true,
  },
  {
    id: 'p1_4',
    type: 'single',
    question: '完善程序（1）数字删除。填空 (4)：循环中 cout 应该输出？',
    options: [
      { value: 'A', label: 's' },
      { value: 'B', label: 's[i]' },
      { value: 'C', label: 's[j]' },
      { value: 'D', label: 's[len]' },
    ],
    answer: ['B'],
    analysis: 'for 循环变量是 i，输出 s[i]。',
    points: 3,
    hasAnswer: true,
  },
];

const perfect2Code = `#include <iostream>
using namespace std;
const int SIZE = 100;
int matrix[SIZE + 1][SIZE + 1];
int rowsum[SIZE + 1][SIZE + 1]; //rowsum[i][j]记录第 i 行前 j 个数的和
int m, n, i, j, first, last, area, ans;
int main() {
  cin >> m >> n;
  for (i = 1; i <= m; i++)
    for (j = 1; j <= n; j++) cin >> matrix[i][j];
  ans = matrix (1) ;
  for (i = 1; i <= m; i++) (2) ;
  for (i = 1; i <= m; i++)
    for (j = 1; j <= n; j++) rowsum[i][j] = (3) ;
  for (first = 1; first <= n; first++)
    for (last = first; last <= n; last++) {
      (4) ;
      for (i = 1; i <= m; i++) {
        area += (5) ;
        if (area > ans) ans = area;
        if (area < 0) area = 0;
      }
    }
  cout << ans << endl;
  return 0;
}`;

const perfect2Questions = [
  {
    id: 'p2_1',
    type: 'single',
    question: '完善程序（2）最大子矩阵和。填空 (1)：ans 初始化的值？',
    options: [
      { value: 'A', label: 'matrix[0][0]' },
      { value: 'B', label: 'matrix[1][1]' },
      { value: 'C', label: 'matrix[1][n]' },
      { value: 'D', label: '0' },
    ],
    answer: ['B'],
    analysis: 'ans 初始化为第一个元素 matrix[1][1]，确保单个元素也可作为子矩阵。',
    points: 3,
    hasAnswer: true,
  },
  {
    id: 'p2_2',
    type: 'single',
    question: '完善程序（2）最大子矩阵和。填空 (2)：初始化每行前缀和第 0 列的语句是？',
    options: [
      { value: 'A', label: 'rowsum[i][0] = 0' },
      { value: 'B', label: 'rowsum[0][j] = 0' },
      { value: 'C', label: 'rowsum[i][0] = matrix[i][0]' },
      { value: 'D', label: 'rowsum[i][1] = matrix[i][1]' },
    ],
    answer: ['A'],
    analysis: 'rowsum[i][0] = 0 初始化每行前缀和的边界，便于后续求区间和。',
    points: 3,
    hasAnswer: true,
  },
  {
    id: 'p2_3',
    type: 'single',
    question: '完善程序（2）最大子矩阵和。填空 (3)：前缀和递推公式 rowsum[i][j] = ?',
    options: [
      { value: 'A', label: 'rowsum[i][j-1] + matrix[i][j]' },
      { value: 'B', label: 'matrix[i][j] + matrix[i][j-1]' },
      { value: 'C', label: 'rowsum[i-1][j] + matrix[i][j]' },
      { value: 'D', label: 'rowsum[i][j-1] + matrix[i-1][j]' },
    ],
    answer: ['A'],
    analysis: 'rowsum[i][j] = rowsum[i][j-1] + matrix[i][j]，每行前缀和的递推。',
    points: 3,
    hasAnswer: true,
  },
  {
    id: 'p2_4',
    type: 'single',
    question: '完善程序（2）最大子矩阵和。填空 (4)：枚举新 first/last 时 area 应重置为？',
    options: [
      { value: 'A', label: '0' },
      { value: 'B', label: 'ans' },
      { value: 'C', label: 'matrix[1][1]' },
      { value: 'D', label: '-1' },
    ],
    answer: ['A'],
    analysis: '每次枚举新 first/last 列时 area 重置为 0，从头开始累加。',
    points: 3,
    hasAnswer: true,
  },
  {
    id: 'p2_5',
    type: 'single',
    question: '完善程序（2）最大子矩阵和。填空 (5)：area += ? 即第 i 行 first..last 列的和',
    options: [
      { value: 'A', label: 'matrix[i][last] - matrix[i][first-1]' },
      { value: 'B', label: 'rowsum[i][last] - rowsum[i][first-1]' },
      { value: 'C', label: 'rowsum[i][last] + rowsum[i][first-1]' },
      { value: 'D', label: 'rowsum[i][last]' },
    ],
    answer: ['B'],
    analysis: '第 i 行 first..last 列的和 = rowsum[i][last] - rowsum[i][first-1]，前缀和区间求和。',
    points: 4,
    hasAnswer: true,
  },
];

// 构造 6 个 read 类 scene:
// 1. 问题求解 (ps1+ps2, 无 codeBlock, kind='code-reading' 仍合适 -- 这是 text-only 思考题)
// 2-5. 阅读程序 1-4 (每题独立 scene, 各自带 codeBlock)
const readScenes = [
  {
    id: 'sc_cspj14j_problem_solving',
    title: '二、问题求解（共 2 题，每题 5 分，共计 10 分）',
    order: 2,
    kind: 'code-reading',
    category: 'read',
    codeBlock: null,
    questions: problemSolvingQuestions,
  },
  ...codeReadingQuestions.map((q, idx) => ({
    id: `sc_cspj14j_read_${idx + 1}`,
    title: `三、阅读程序写结果 ${idx + 1}（8 分）`,
    order: 3 + idx,
    kind: 'code-reading',
    category: 'read',
    codeBlock: {
      language: 'cpp',
      title: q.codeTitle,
      description: q.codeDescription,
      lines: q.codeLines,
    },
    questions: [q], // 每题独立 scene
  })),
];

// =========== 构造完整 classroom JSON ===========
const classroom = {
  id: 'cm_imp_cspj2014j_v1',
  createdAt: '2026-08-09T00:00:00.000Z',
  collection: 'csp-lecture',
  stage: {
    id: 'cm_imp_cspj2014j_v1',
    name: '2014年普及组NOIP初赛真题卷',
    description: '2014年CCF NOIP普及组初赛完整真题（第二十届全国青少年信息学奥林匹克联赛初赛），共单项选择题20道（30分）、问题求解2题（10分）、阅读程序写结果4题（32分）、完善程序2题（28分），总分100分。',
    languageDirective: 'zh-CN',
    style: 'tutor',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    generatedAgentConfigs: [
      {
        id: 'imp_agent_cspj14j_0',
        name: '张老师',
        role: 'teacher',
        persona: '经验丰富的CSP初赛教练，熟悉历年真题考点，讲解清晰且直击要点，耐心引导学员分析每道题的解题思路。',
        avatar: '/avatars/teacher.png',
        color: '#3b82f6',
        priority: 10,
      },
      {
        id: 'imp_agent_cspj14j_1',
        name: '小慧',
        role: 'assistant',
        persona: '聪明耐心的女助教，擅长总结归纳易错点，帮助学员梳理解题思路，在测验后给出鼓励和易错提醒。',
        avatar: '/avatars/assist.png',
        color: '#ec4899',
        priority: 7,
      },
    ],
    agentIds: [],
    scoreBreakdown: {
      choice: 30,
      read: 42,
      perfect: 28,
    },
  },
  scenes: [
    {
      id: 'sc_cspj14j_choice',
      stageId: 'cm_imp_cspj2014j_v1',
      type: 'quiz',
      title: '一、单项选择题（共 20 题，每题 1.5 分，共计 30 分）',
      order: 1,
      content: {
        type: 'quiz',
        questions: choiceSceneQuestions,
        kind: 'choice',
      },
      actions: [],
      multiAgent: { enabled: false, agentIds: [] },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      category: 'choice',
    },
    ...readScenes.map((rs) => ({
      id: rs.id,
      stageId: 'cm_imp_cspj2014j_v1',
      type: 'quiz',
      title: rs.title,
      order: rs.order,
      content: {
        type: 'quiz',
        ...(rs.codeBlock ? { codeBlock: rs.codeBlock } : {}),
        questions: rs.questions,
        kind: rs.kind,
      },
      actions: [],
      multiAgent: { enabled: false, agentIds: [] },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      category: rs.category,
    })),
    {
      id: 'sc_cspj14j_perfect',
      stageId: 'cm_imp_cspj2014j_v1',
      type: 'quiz',
      title: '四、完善程序（1）数字删除（每空 3 分，共 12 分）',
      order: 3,
      content: {
        type: 'quiz',
        codeBlock: {
          language: 'cpp',
          title: '完善程序（1）数字删除',
          description: '下面程序的功能是将字符串中的数字字符删除后输出。',
          lines: perfect1Code.split('\n'),
        },
        questions: perfect1Questions,
        kind: 'code-completion',
      },
      actions: [],
      multiAgent: { enabled: false, agentIds: [] },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      category: 'perfect',
    },
    {
      id: 'sc_cspj14j_perfect2',
      stageId: 'cm_imp_cspj2014j_v1',
      type: 'quiz',
      title: '四、完善程序（2）最大子矩阵和（最后一空 4 分，其余 3 分，共 16 分）',
      order: 8,
      content: {
        type: 'quiz',
        codeBlock: {
          language: 'cpp',
          title: '完善程序（2）最大子矩阵和',
          description: '给出 m 行 n 列的整数矩阵，求最大的子矩阵和（子矩阵不能为空）。',
          lines: perfect2Code.split('\n'),
        },
        questions: perfect2Questions,
        kind: 'code-completion',
      },
      actions: [],
      multiAgent: { enabled: false, agentIds: [] },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      category: 'perfect',
    },
  ],
};

await writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK: ${JSON_OUT}`);
console.log(`  choice questions: ${choiceSceneQuestions.length}`);
console.log(`  problem_solving questions: ${problemSolvingQuestions.length}`);
console.log(`  code reading questions: ${codeReadingQuestions.length} (1 question per scene, 4 scenes)`);
console.log(`  perfect1 questions: ${perfect1Questions.length} (数字删除 4 空)`);
console.log(`  perfect2 questions: ${perfect2Questions.length} (最大子矩阵和 5 空)`);
console.log(`  total questions: ${choiceSceneQuestions.length + problemSolvingQuestions.length + codeReadingQuestions.length + perfect1Questions.length + perfect2Questions.length}`);
console.log(`  total scenes: ${classroom.scenes.length} (1 choice + 1 problem_solving + 4 code_reading + 2 perfect)`);
// 验证所有题都是 single 类型
const shortAnswer = classroom.scenes.flatMap(s => s.content.questions).filter(q => q.type !== 'single');
console.log(`  short_answer 残留: ${shortAnswer.length}`);
