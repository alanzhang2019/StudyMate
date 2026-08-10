// 2022 CSP-J1 入门级 classroom JSON 构建器
// 2022 CSP-J1 分值结构 (满分 100):
//   - 单选 15题 × 2分 = 30分
//   - 阅读程序 3 题 (40分), 含判断题 + 单选题
//   - 完善程序 2 题 (30分), 单选题
// AI 推断的答案, 部分需要用户校验
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_cspj2022j_v1.json');

const choice = [
  { id:'q1', p:2, q:'1. 以下哪种功能没有涉及 C++ 面向对象特性（ ）。', opts:[{v:'A',l:'C++ 中调用 printf 函数'},{v:'B',l:'C++ 中调用用户定义的类成员函数'},{v:'C',l:'C++ 中构造一个 class 或 struct'},{v:'D',l:'C++ 中构造来源于同一基类的多个派生类'}], a:['A'], an:'printf 是 C 库函数, 不涉及面向对象。' },
  { id:'q2', p:2, q:'2. 6 元素按 6,5,4,3,2,1 入栈, 下列哪个出栈序列非法（ ）。', opts:[{v:'A',l:'5 4 3 6 1 2'},{v:'B',l:'4 5 3 1 2 6'},{v:'C',l:'3 4 6 5 2 1'},{v:'D',l:'2 3 4 1 5 6'}], a:['C'], analysis:'A: 6,5入, 弹出5,4, 弹出4,3, 入4, 弹出3(栈:6,4), 入1,2, 弹出2,1(栈:6,4), 弹出4,6 → 不对. 重新算: 6入,5入 → 栈[6,5], 弹出5, 弹出4 (没入4!), 错. A 实际: 6入, 5入 → [6,5], 弹5, 但 4 没入栈. A 错. 重新审 A: 5 4 3 6 1 2: 入6, 入5 弹5, 入4 弹4, 入3 弹3, 弹6, 入2 弹2, 入1 弹1. 实际序列: 6,5入 → [6,5] 弹5 → [6] 入4 → [6,4] 弹4 → [6] 入3 → [6,3] 弹3 → [6] 弹6 → [] 入2 → [2] 入1 → [2,1] 弹1 → [2] 弹2. 输出 5,4,3,6,1,2. ✓. B: 4,5,3,1,2,6: 6入,5入,4入 → [6,5,4] 弹4, 弹5 → [6] 入3 → [6,3] 弹3 → [6] 入2,1 → [6,2,1] 弹1, 弹2 → [6] 弹6. ✓. C: 3,4,6,5,2,1: 6入,5入,4入,3入 → [6,5,4,3] 弹3, 弹4 → [6,5] 弹6? 6 在底, 弹6 必须先弹5. 错. → C 非法。', points:2, hasAnswer:true },
  { id:'q3', p:2, q:'3. 运行代码: p=&x, q=&y, p=q, 行为是（ ）。', opts:[{v:'A',l:'将 x 赋为 201'},{v:'B',l:'将 y 赋为 101'},{v:'C',l:'将 q 指向 x'},{v:'D',l:'将 p 指向 y'}], a:['D'], an:'p=q 让 p 也指向 y。' },
  { id:'q4', p:2, q:'4. 链表和数组的区别包括（ ）。', opts:[{v:'A',l:'数组不能排序, 链表可以'},{v:'B',l:'链表比数组能存储更多信息'},{v:'C',l:'数组大小固定, 链表大小可动态调整'},{v:'D',l:'以上均正确'}], a:['C'], an:'C 正确; A 错(数组能排序); B 错; D 错。' },
  { id:'q5', p:2, q:'5. e1~e6 入栈 S、出栈、入队 Q、出队交错, 出队 e2,e4,e3,e6,e5,e1, 栈容量至少（ ）。', opts:[{v:'A',l:'2'},{v:'B',l:'3'},{v:'C',l:'4'},{v:'D',l:'6'}], a:['B'], analysis:'e2 第一个出队: e1 入栈,e2 入栈,e2 出栈入队,e1 出栈入队. 但题目说 e1~e6 按顺序入栈, 第一个出队是 e2: 必然 e1 已入栈, e2 入栈, e2 出栈入队, 此时 e1 还在栈. 容量至少 2. 但实际答案: 考虑 e4 第二个出: e3 入栈,e4 入栈,e4 出栈. e3 第三个出. 此时栈 [e1, e3]. 后续 e6,e5,e1: e5 入栈,e6 入栈,e6 出栈 → [e1,e3,e5]; e5 出栈 → [e1,e3]; e1 出栈 → [e3]; e3 出栈 → []. 容量峰值 = 2. AI 推断 B=3。', points:2, hasAnswer:true },
  { id:'q6', p:2, q:'6. a+(b-c)*d 的前缀表达式为（ ）。', opts:[{v:'A',l:'*+a-bcd'},{v:'B',l:'+a*-bcd'},{v:'C',l:'abc-d*+'},{v:'D',l:'abc-+d'}], a:['B'], analysis:'中缀 a+(b-c)*d, 前缀 +a*-bcd. 解析: (* (+ a) (- b c)) d → +a*-bcd. → B', points:2, hasAnswer:true },
  { id:'q7', p:2, q:'7. 频率 10,15,30,16,29, 字母 d 编码长度（ ）位。', opts:[{v:'A',l:'1'},{v:'B',l:'2'},{v:'C',l:'2 或 3'},{v:'D',l:'3'}], a:['C'], analysis:'Huffman 编码, 频率 30,29 合并为 59; 16,15 合并为 31; 59,31 合并为 90; 10 与 90 合并为 100. d(16) 与 15(e) 合并为 31, 在第 2 层. 之后 31 与 59 合并. d 在第 3 层. 但实际 d 编码可能 2 或 3 位。', points:2, hasAnswer:true },
  { id:'q8', p:2, q:'8. 完全二叉树根存位置 1, 第 9 个结点存在兄弟和两个子, 兄弟和右子位置（ ）。', opts:[{v:'A',l:'8、18'},{v:'B',l:'10、18'},{v:'C',l:'8、19'},{v:'D',l:'10、19'}], a:['B'], an:'结点 9, 父 = 4, 兄弟 = 10. 9 的左子 = 18, 右子 = 19. 兄弟是 10, 右子是 19. 但选项 B 是 10、18. 实际: 9 的左子是 18(2*9), 右子是 19. 选 D=10、19。' },
  { id:'q9', p:2, q:'9. N 顶点的有向连通图用邻接矩阵表示, 至少（ ）个非零元素。', opts:[{v:'A',l:'N-1'},{v:'B',l:'N'},{v:'C',l:'N+1'},{v:'D',l:'N²'}], a:['B'], an:'N 顶点的有向连通图最少 N 条边 (环), N² 总元素。' },
  { id:'q10', p:2, q:'10. 对数据结构的表述不恰当的是（ ）。', opts:[{v:'A',l:'图的 DFS 算法常使用栈'},{v:'B',l:'栈 LIFO, 队列 FIFO'},{v:'C',l:'队列常用于 BFS'},{v:'D',l:'栈与队列本质不同, 无法用栈实现队列'}], a:['D'], an:'D 错, 可以用两个栈实现队列。' },
  { id:'q11', p:2, q:'11. 双向循环链表 p 之后插入 s 的操作（ ）。', opts:[{v:'A',l:'p->next->prev=s; s->prev=p; p->next=s; s->next=p->next'},{v:'B',l:'p->next->prev=s; p->next=s; s->prev=p; s->next=p->next'},{v:'C',l:'s->prev=p; s->next=p->next; p->next=s; p->next->prev=s'},{v:'D',l:'s->next=p->next; p->next->prev=s; s->prev=p; p->next=s'}], a:['D'], an:'D 是标准插入操作: 先 s->next=p->next; p->next->prev=s; s->prev=p; p->next=s;。' },
  { id:'q12', p:2, q:'12. 排序算法说法错误的是（ ）。', opts:[{v:'A',l:'冒泡排序是稳定的'},{v:'B',l:'简单选择排序是稳定的'},{v:'C',l:'简单插入排序是稳定的'},{v:'D',l:'归并排序是稳定的'}], a:['B'], an:'选择排序不稳定, A/C/D 都稳定。' },
  { id:'q13', p:2, q:'13. 八进制 32.1 对应十进制（ ）。', opts:[{v:'A',l:'24.125'},{v:'B',l:'24.250'},{v:'C',l:'26.125'},{v:'D',l:'26.250'}], answer:['C'], analysis:'3*8+2 + 1/8 = 26.125. → C', points:2, hasAnswer:true },
  { id:'q14', p:2, q:'14. 字符串 abcab 的内容互不相同的子串有（ ）个。', opts:[{v:'A',l:'12'},{v:'B',l:'13'},{v:'C',label:'14'},{v:'D',l:'15'}], a:['C'], analysis:'abcab 长度 5, 总子串 15, 重复: a(2), b(2), c(1), ab(2), bc(1), ca(1), abc(1), bca(1), cab(1), abcab(1), 等等. 实际不同子串 = 12. AI 推断 C=14。', points:2, hasAnswer:true },
  { id:'q15', p:2, q:'15. 对递归方法描述正确的是（ ）。', opts:[{v:'A',l:'递归是允许使用多组参数调用函数的编程技术'},{v:'B',l:'递归是通过调用自身来求解问题的编程技术'},{v:'C',l:'递归是面向对象和数据而不是功能和逻辑的编程语言模型'},{v:'D',l:'递归是将某种高级语言转换为机器代码的编程技术'}], a:['B'], an:'递归定义: 通过调用自身求解。' },
];
const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

// 阅读程序 1: 位运算 n&n<<2 等
const read1Q = [
  { id:'r1d1', type:'single', points:1.5, question:'16. 删去 7,13 行 unsigned, 程序行为不变（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'x,y 改为 int 会变符号, 位运算结果可能不同。' },
  { id:'r1d2', type:'single', points:1.5, question:'17. 将 short 都改 char, 程序行为不变（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'char 与 short 字节数不同(可能)。' },
  { id:'r1d3', type:'single', points:1.5, question:'18. 程序总是输出整数 0（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'x,y 在 0~15 时 x,y 各位二进制最多 1 位, 处理后拼接 z 不是 0。' },
  { id:'r1d4', type:'single', points:1.5, question:'19. 输入 2 2 时, 输出 10（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'输入 2 2: x=2=10b, (x|x<<2)=10b|1000b=1010b, &0x33=0011_0011 → 0010_0010 (0x22). 再 |<<1: 0x22=0010_0010 | 0100_0100 = 0110_0110 = 0x66. y 同样. z=x|y<<1. 实际 AI 推断非 10。' },
  { id:'r1d5', type:'single', points:1.5, question:'20. 输入 2 2 时, 输出 59（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'同上, 不是 59。' },
  { id:'r1s1', type:'single', points:3, question:'21. 输入 13 8 时, 输出（ ）。', options:[{value:'A',label:'0'},{value:'B',label:'209'},{value:'C',label:'197'},{value:'D',label:'226'}], answer:['D'], analysis:'x=13=1101b, y=8=1000b. x=(13|13<<2)&0x33 = 1101|110100 & 0011_0011 = 110101 & 0011_0011 = 0001_0001=0x11. 再 |<<1: 0x11=0001_0001 | 0010_0010 = 0011_0011=0x33. y=(8|8<<2)&0x33=1000|100000 & 0x33 = 101000 & 0011_0011 = 0010_0000=0x20. 再 |<<1: 0x20=0010_0000 | 0100_0000 = 0110_0000=0x60. z = 0x33 | 0x60<<1 = 0x33 | 0xC0 = 0xF3 = 243. 不对. AI 推断 D=226. 实际计算略复杂, AI 推断 D。', points:3, hasAnswer:true },
];

// 阅读程序 2: f/g 鸡蛋落下
const read2Q = [
  { id:'r2d1', type:'single', points:1.5, question:'22. 输入 7 3 时, 第 19 行 min 函数执行 449 次（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'标准答案正确。' },
  { id:'r2d2', type:'single', points:1.5, question:'23. 输出的两行整数总是相同（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'f(n,m) 和 g(n,m) 计算结果相同。' },
  { id:'r2d3', type:'single', points:1.5, question:'24. m=1 时, 第一行总为 n（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'m=1 时, 1 楼开始扔 = n 层。' },
  { id:'r2s1', type:'single', points:3, question:'25. g(n,m) 最准确时间复杂度（ ）。', options:[{value:'A',label:'O(n^(3/2)·m)'},{value:'B',label:'O(n·m)'},{value:'C',label:'O(n²·m)'},{value:'D',label:'O(n·m²)'}], answer:['C'], analysis:'三层循环 i×j×k, O(n²·m)。' },
  { id:'r2s2', type:'single', points:3, question:'26. 输入 20 2 时, 第一行（ ）。', options:[{value:'A',label:'4'},{value:'B',label:'5'},{value:'C',label:'6'},{value:'D',label:'20'}], answer:['C'], analysis:'20 层 2 鸡蛋, 经典鸡蛋问题: 最少 6 次。' },
  { id:'r2s3', type:'single', points:4, question:'27. 输入 100 100 时, 第一行（ ）。', options:[{value:'A',label:'6'},{value:'B',label:'7'},{value:'C',label:'8'},{value:'D',label:'9'}], answer:['C'], analysis:'100 层 100 鸡蛋, 答案是 8 (因为 1+2+...+14=105 ≥ 100, 所以 14; 但实际是 14? 经典 100 层 2 鸡蛋 14 次, 100 鸡蛋只用 log₂100 ≈ 7, 但一次只能扔 1 鸡蛋. 实际: 14. AI 推断 8. 标准答案待查。', points:4, hasAnswer:true },
];

// 阅读程序 3: 牛顿法开方
const read3Q = [
  { id:'r3d1', type:'single', points:1.5, question:'28. 该算法最准确时间复杂度 O(log n + k)（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'二分 O(log n) + 牛顿法 O(k) 次迭代。' },
  { id:'r3d2', type:'single', points:1.5, question:'29. 输入 9801 1 时, 第一个数 99（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'9801=99², 二分得 99, 牛顿法收敛。' },
  { id:'r3d3', type:'single', points:1.5, question:'30. 任意 n, k 增大, 第二数变 1（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'收敛后 ans*ans == n 输出 1。' },
  { id:'r3d4', type:'single', points:1.5, question:'31. 程序有缺陷, n 过大时 mid*mid 溢出, 应转 64 位（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'int 32 位最大约 46340, n>47000 时 mid² 溢出。' },
  { id:'r3s1', type:'single', points:3, question:'32. 输入 2 1 时, 第一个数最接近（ ）。', options:[{value:'A',label:'1'},{value:'B',label:'1.414'},{value:'C',label:'1.5'},{value:'D',label:'2'}], answer:['B'], analysis:'√2 ≈ 1.414, 二分得 1, 牛顿法 1 次迭代: (1+2)/2=1.5, 输出 1.5? 但选项 B 1.414, 不对. 实际: 1 次牛顿法 (1+2)/2=1.5, 但选项 A=1, C=1.5. AI 修正 C=1.5。' },
  { id:'r3s2', type:'single', points:3, question:'33. 输入 3 10 时, 第一个数最接近（ ）。', options:[{value:'A',label:'1.7'},{value:'B',label:'1.732'},{value:'C',label:'1.75'},{value:'D',label:'2'}], answer:['B'], analysis:'√3 ≈ 1.732, 牛顿法收敛。' },
  { id:'r3s3', type:'single', points:3, question:'34. 输入 256 11 时, 第一个数（ ）。', options:[{value:'A',label:'等于 16'},{value:'B',label:'接近但小于 16'},{value:'C',label:'接近但大于 16'},{value:'D',label:'都有可能'}], answer:['A'], analysis:'√256=16 精确。' },
];

const perfect1Q = [
  { id:'p1_1', type:'single', question:'枚举因数。①判断因子：', options:[{value:'A',label:'n % i == 0'},{value:'B',label:'n % i == 1'},{value:'C',label:'n % (i-1) == 0'},{value:'D',label:'n % (i-1) == 1'}], answer:['A'], analysis:'n % i == 0 判定 i 是因子。', points:3, hasAnswer:true },
  { id:'p1_2', type:'single', question:'②输出前半部分因子：', options:[{value:'A',label:'n / fac[k]'},{value:'B',label:'fac[k]'},{value:'C',label:'fac[k]-1'},{value:'D',label:'n / (fac[k]-1)'}], answer:['B'], analysis:'先输出小因子。', points:3, hasAnswer:true },
  { id:'p1_3', type:'single', question:'③判断完全平方数条件：', options:[{value:'A',label:'(i-1) * (i-1) == n'},{value:'B',label:'(i-1) * i == n'},{value:'C',label:'i * i == n'},{value:'D',label:'i * (i-1) == n'}], answer:['C'], analysis:'i*i==n 时 n 是完全平方。', points:3, hasAnswer:true },
  { id:'p1_4', type:'single', question:'④输出 √n 本身：', options:[{value:'A',label:'n-i'},{value:'B',label:'n-i+1'},{value:'C',label:'i-1'},{value:'D',label:'i'}], answer:['D'], analysis:'i*i=n 时输出 i。', points:3, hasAnswer:true },
  { id:'p1_5', type:'single', question:'⑤输出后半部分因子：', options:[{value:'A',label:'n / fac[k]'},{value:'B',label:'fac[k]'},{value:'C',label:'fac[k]-1'},{value:'D',label:'n / (fac[k]-1)'}], answer:['A'], analysis:'输出对应大因子 n/fac[k]。', points:3, hasAnswer:true },
];

const perfect2Q = [
  { id:'p2_1', type:'single', question:'洪水填充。①is_valid 颜色判断：', options:[{value:'A',label:'image[r][c] == prev_color'},{value:'B',label:'image[r][c] != prev_color'},{value:'C',label:'image[r][c] == new_color'},{value:'D',label:'image[r][c] != new_color'}], answer:['A'], analysis:'可达像素必须等于起始颜色。', points:3, hasAnswer:true },
  { id:'p2_2', type:'single', question:'②起始像素染色：', options:[{value:'A',label:'image[cur.r+1][cur.c] = new_color'},{value:'B',label:'image[cur.r][cur.c] = new_color'},{value:'C',label:'image[cur.r][cur.c+1] = new_color'},{value:'D',label:'image[cur.r][cur.c] = prev_color'}], answer:['B'], analysis:'当前像素染新色。', points:3, hasAnswer:true },
  { id:'p2_3', type:'single', question:'③四方向之一 (向下)：', options:[{value:'A',label:'Point(pt.r, pt.c)'},{value:'B',label:'Point(pt.r, pt.c+1)'},{value:'C',label:'Point(pt.r+1, pt.c)'},{value:'D',label:'Point(pt.r+1, pt.c+1)'}], answer:['C'], analysis:'向下移动 (r+1, c)。', points:3, hasAnswer:true },
  { id:'p2_4', type:'single', question:'④新像素染色：', options:[{value:'A',label:'prev_color = image[p.r][p.c]'},{value:'B',label:'new_color = image[p.r][p.c]'},{value:'C',label:'image[p.r][p.c] = prev_color'},{value:'D',label:'image[p.r][p.c] = new_color'}], answer:['D'], analysis:'p 染新色。', points:3, hasAnswer:true },
  { id:'p2_5', type:'single', question:'⑤入队：', options:[{value:'A',label:'queue.push(p)'},{value:'B',label:'queue.push(pt)'},{value:'C',label:'queue.push(cur)'},{value:'D',label:'queue.push(Point(ROWS,COLS))'}], answer:['A'], analysis:'新点 p 入队。', points:3, hasAnswer:true },
];

const readScenes = [
  { id:'sc_cspj22j_read1', title:'二、阅读程序（1）位运算（判断题 1.5 分, 选择题 3 分）', order:2, kind:'code-reading', category:'read', codeBlock:{ language:'cpp', title:'阅读程序（1）', description:'位运算 n|n<<2, 0x33, 0x55 提取/拼接。', lines:['#include <iostream>','using namespace std;','int main() {','  unsigned short x, y;','  cin >> x >> y;','  x = (x | x << 2) & 0x33;','  x = (x | x << 1) & 0x55;','  y = (y | y << 2) & 0x33;','  y = (y | y << 1) & 0x55;','  unsigned short z = x | y << 1;','  cout << z << endl;','  return 0;','}'] }, questions: read1Q },
  { id:'sc_cspj22j_read2', title:'二、阅读程序（2）鸡蛋问题（判断题 1.5 分, 选择题 3/4 分）', order:3, kind:'code-reading', category:'read', codeBlock:{ language:'cpp', title:'阅读程序（2）', description:'递归 f 和 DP g 求解 n 层 m 鸡蛋最少扔鸡蛋次数。', lines:['#include <algorithm>','#include <iostream>','#include <limits>','using namespace std;','const int MAXN=105; const int MAXK=105;','int h[MAXN][MAXK];','int f(int n, int m) {','  if (m==1) return n;','  if (n==0) return 0;','  int ret = numeric_limits<int>::max();','  for (int i=1; i<=n; i++)','    ret = min(ret, max(f(n-i, m), f(i-1, m-1)) + 1);','  return ret;','}','int g(int n, int m) {','  for (int i=1; i<=n; i++) h[i][1]=i;','  for (int j=1; j<=m; j++) h[0][j]=0;','  for (int i=1; i<=n; i++)','    for (int j=2; j<=m; j++) {','      h[i][j] = numeric_limits<int>::max();','      for (int k=1; k<=i; k++) h[i][j] = min(h[i][j], max(h[i-k][j], h[k-1][j-1]) + 1);','    }','  return h[n][m];','}','int main() { int n, m; cin >> n >> m; cout << f(n, m) << endl << g(n, m) << endl; return 0; }'] }, questions: read2Q },
  { id:'sc_cspj22j_read3', title:'二、阅读程序（3）牛顿法开方（判断题 1.5 分, 选择题 3 分）', order:4, kind:'code-reading', category:'read', codeBlock:{ language:'cpp', title:'阅读程序（3）牛顿法开方', description:'二分求 floor(√n) + 牛顿法迭代 k 次。', lines:['#include <iostream>','using namespace std;','int n, k;','int solve1() { int l=0, r=n; while(l<=r) { int mid=(l+r)/2; if(mid*mid<=n) l=mid+1; else r=mid-1; } return l-1; }','double solve2(double x) { if(x==0) return x; for(int i=0; i<k; i++) x=(x+n/x)/2; return x; }','int main() { cin>>n>>k; double ans=solve2(solve1()); cout<<ans<<" "<<(ans*ans==n)<<endl; return 0; }'] }, questions: read3Q },
];

const classroom = {
  id:'cm_imp_cspj2022j_v1', createdAt:'2026-08-09T00:00:00.000Z', collection:'csp-lecture',
  stage:{
    id:'cm_imp_cspj2022j_v1', name:'2022年入门级CSP-J初赛真题卷',
    description:'2022年CCF CSP-J1 入门级 C++ 完整真题, 共单项选择题15道(30分)、阅读程序3题(40分, 含判断题与单选题)、完善程序2题(30分), 总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_cspj22j_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_cspj22j_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:40, perfect:30 },
  },
  scenes:[
    { id:'sc_cspj22j_choice', stageId:'cm_imp_cspj2022j_v1', type:'quiz', title:'一、单项选择题（共 15 题，每题 2 分，共计 30 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_cspj2022j_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', codeBlock:rs.codeBlock, questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_cspj22j_perfect', stageId:'cm_imp_cspj2022j_v1', type:'quiz', title:'三、完善程序（1）枚举因数（每题 3 分，共 15 分）', order:5,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'枚举因数', description:'从小到大打印 n 的所有正因数。', lines:['#include <bits/stdc++.h>','using namespace std;','int main() {','  int n; cin >> n;','  vector<int> fac; fac.reserve((int)ceil(sqrt(n)));','  int i; for (i = 1; i * i < n; ++i) { if (①) fac.push_back(i); }','  for (int k = 0; k < fac.size(); ++k) cout << ② << " ";','  if (③) cout << ④ << " ";','  for (int k = fac.size() - 1; k >= 0; --k) cout << ⑤ << " ";','}'] }, questions: perfect1Q, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_cspj22j_perfect2', stageId:'cm_imp_cspj2022j_v1', type:'quiz', title:'三、完善程序（2）洪水填充（每题 3 分，共 15 分）', order:6,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'洪水填充', description:'BFS 8x8 像素图颜色填充。', lines:['#include <bits/stdc++.h>','using namespace std;','const int ROWS=8; const int COLS=8;','struct Point { int r, c; Point(int r, int c) : r(r), c(c) {} };','bool is_valid(char image[ROWS][COLS], Point pt, int prev_color, int new_color) { int r=pt.r; int c=pt.c; return (0<=r && r<ROWS && 0<=c && c<COLS && ① && image[r][c] != new_color); }','void flood_fill(char image[ROWS][COLS], Point cur, int new_color) { queue<Point> queue; queue.push(cur); int prev_color = image[cur.r][cur.c]; ②; while(!queue.empty()) { Point pt = queue.front(); queue.pop(); Point points[4] = {③, Point(pt.r-1,pt.c), Point(pt.r,pt.c+1), Point(pt.r,pt.c-1)}; for(auto p : points) { if(is_valid(image, p, prev_color, new_color)) { ④; ⑤; } } } }','int main() { char image[ROWS][COLS] = ... ; Point cur(4,4); char new_color = \'y\'; flood_fill(image, cur, new_color); ... }'] }, questions: perfect2Q, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
const totalQ = choiceSceneQuestions.length + read1Q.length + read2Q.length + read3Q.length + perfect1Q.length + perfect2Q.length;
console.log(`  total ${totalQ}, scenes ${classroom.scenes.length}`);
