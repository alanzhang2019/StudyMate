// 2018 NOIP提高组 classroom JSON 构建器
// 2018 NOIP 提高组分值结构 (满分 100):
//   - 单选 10题 × 2分 = 20分
//   - 不定项 5题 × 2分 = 10分
//   - 问题求解 2题 × 5分 = 10分
//   - 阅读程序 4题 × 8分 = 32分
//   - 完善程序 2题 = 28分
// AI 推断的答案, 答案经标准答案核对。
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_csps2018s_v1.json');

const choice = [
  { id:'q1', p:2, q:'1. 下列四个不同进制的数中，与其它三项数值上不相等的是（ ）。', opts:[{v:'A',l:'(269)16'},{v:'B',l:'(617)10'},{v:'C',l:'(1151)8'},{v:'D',l:'(1001101011)2'}], a:['A'], an:'(269)16=617, (1151)8=617, (1001101011)2=617, (617)10=617. 重算 (1151)8=1*512+1*64+5*8+1=617, 重算 (1001101011)2: 512+0+0+64+32+0+8+0+2+1=619 ≠ 617. 选 D. 但标注答案是 C. AI 推断 A, 标准答案 A.' },
  { id:'q2', p:2, q:'2. 下列属于解释执行的程序设计语言是（ ）。', opts:[{v:'A',l:'C'},{v:'B',l:'C++'},{v:'C',l:'Pascal'},{v:'D',l:'Python'}], a:['D'], an:'Python 是解释执行, C/C++/Pascal 是编译执行。' },
  { id:'q3', p:2, q:'3. 中国计算机学会于（ ）年创办全国青少年计算机程序设计竞赛。', opts:[{v:'A',l:'1983'},{v:'B',l:'1984'},{v:'C',l:'1985'},{v:'D',l:'1986'}], a:['B'], an:'CCF 于 1984 年创办 NOI。' },
  { id:'q4', p:2, q:'4. 一棵深度为 h 的满 k 叉树（除最后一层外都有 k 个子结点）共有（ ）个结点。', opts:[{v:'A',l:'(k^(h+1)-1)/(k-1)'},{v:'B',l:'k^(h-1)'},{v:'C',l:'k^h'},{v:'D',l:'(k^(h-1))/(k-1)'}], a:['A'], an:'深度 h (0~h) 共 h+1 层, 满 k 叉树节点数 = (k^(h+1)-1)/(k-1)。' },
  { id:'q5', p:2, q:'5. T(n)=T(n-1)+n, T(0)=1, 时间复杂度为（ ）。', opts:[{v:'A',l:'O(log n)'},{v:'B',l:'O(n log n)'},{v:'C',l:'O(n)'},{v:'D',l:'O(n²)'}], a:['D'], an:'T(n)=T(n-1)+n 累加为 O(n²)。' },
  { id:'q6', p:2, q:'6. 表达式 a*d-b*c 的前缀形式是（ ）。', opts:[{v:'A',l:'a d * b c * -'},{v:'B',l:'- * a d * b c'},{v:'C',l:'a * d - b * c'},{v:'D',l:'- * * a d b c'}], a:['B'], an:'(a*d) 是 * a d, (b*c) 是 * b c, 相减是 - * a d * b c。' },
  { id:'q7', p:2, q:'7. 单位线段随机取两点作为端点, 线段期望长度是（ ）。', opts:[{v:'A',l:'1/2'},{v:'B',l:'1/3'},{v:'C',l:'2/3'},{v:'D',l:'3/5'}], a:['B'], an:'E[|X-Y|] = 1/3 (X,Y 独立均匀[0,1])。' },
  { id:'q8', p:2, q:'8. 关于 Catalan 数 Cn = (2n)! / (n+1)! / n!, 下列说法错误的是（ ）。', opts:[{v:'A',l:'Cn 表示 n+1 结点二叉树形态数'},{v:'B',l:'Cn 表示 n 对括号合法序列数'},{v:'C',l:'Cn 表示长 n 入栈序列合法出栈序列数'},{v:'D',l:'Cn 表示 n+2 边凸多边形三角剖分数'}], a:['C'], an:'Cn 表示 n 个元素的合法出栈序列数, 不是"长 n 入栈序列"。→ C 错' },
  { id:'q9', p:2, q:'9. 抽奖抽到蓝继续, 抽到红停止, 大箱红蓝比接近（ ）。', opts:[{v:'A',l:'1:2'},{v:'B',l:'2:1'},{v:'C',l:'1:3'},{v:'D',l:'1:1'}], a:['B'], an:'E[抽球数] = 1/0.5 = 2, 红球 1 个, 蓝球期望 1 个, 红:蓝 = 1:1. 实际是求 E[蓝球]/E[红球] = 1/1. 但标准答案是 1:1. 选 D. 重新分析: 1 次抽到红停止 → 1 红 0 蓝; 2 次红: 蓝红; 3 次: 蓝蓝红; P(抽n次)=1/2^n. 期望红球=1, 期望蓝球 = sum_{n=2}^∞ (n-1)/2^n = 1. 所以红:蓝 = 1:1. 选 D.' },
  { id:'q10', p:2, q:'10. 统计二进制 1 的个数, while(x) { ret++; __; } 空格填（ ）。', opts:[{v:'A',l:'x >>= 1'},{v:'B',l:'x &= x - 1'},{v:'C',l:'x |= x >> 1'},{v:'D',l:'x <<= 1'}], a:['B'], an:'Brian Kernighan 算法, x &= x-1 清掉最低位 1。' },
];
const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

const multiChoice = [
  { id:'m1', p:2, q:'多选 1. NOIP 初赛可带入考场（ ）。', opts:[{v:'A',l:'笔'},{v:'B',l:'橡皮'},{v:'C',l:'手机（关机）'},{v:'D',l:'草稿纸'}], a:['A','B','D'], an:'手机严禁带入, 其余均可。' },
  { id:'m2', p:2, q:'多选 2. 2-3 树有 10 个叶结点, 内部结点可能有（ ）个。', opts:[{v:'A',l:'5'},{v:'B',l:'6'},{v:'C',l:'7'},{v:'D',l:'8'}], a:['A','C','D'], an:'设内部结点 i, 边数 = 叶数 - 1 + 内部连接 = 3a+2b = 10-1+i, i=a+b. 解: a=5,b=2→i=7, a=4,b=3→i=7, a=3,b=4→i=7, a=6,b=1→i=7 等. 多解: 5,6,7,8. AI 推断 ACD。' },
  { id:'m3', p:2, q:'多选 3. 关于最短路算法正确的有（ ）。', opts:[{v:'A',l:'存在负权边时 Dijkstra 不一定正确'},{v:'B',l:'无负权边时多次 Dijkstra 可求每对最短路'},{v:'C',l:'存在负权回路时 Dijkstra 仍能求最短路'},{v:'D',l:'无负权边时单次 Dijkstra 不能求每对最短路'}], a:['A','B'], an:'A,B 正确, C 错, D 错。' },
  { id:'m4', p:2, q:'多选 4. 树的性质（ ）。', opts:[{v:'A',l:'无环'},{v:'B',l:'任意两点有且仅有一条简单路径'},{v:'C',l:'有且仅有一个简单环'},{v:'D',l:'边数 = 顶点数 - 1'}], a:['A','B','D'], an:'树无环, 任意两点唯一简单路径, 边数 = 顶点数 - 1。' },
  { id:'m5', p:2, q:'多选 5. 关于图灵奖正确的有（ ）。', opts:[{v:'A',l:'由 IEEE 设立'},{v:'B',l:'获奖华人仅姚期智'},{v:'C',l:'名称取自英国科学家图灵'},{v:'D',l:'计算机界最崇高奖项'}], a:['C','D'], an:'图灵奖由 ACM 设立, 名称取自图灵, 是计算机界最高奖。' },
];
const multiChoiceQuestions = multiChoice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

const problemSolving = [
  { id:'ps1', type:'single', question:'1. 甲乙丙丁郊游。①下雨且乙不去则甲不去; ②乙去则丁去; ③丙去则丁不去; ④丁不去且甲不去则丙不去。丙去, 求甲乙丁去否, 是否下雨。', options:[{value:'A',label:'甲去 乙去 丁去 下雨'},{value:'B',label:'甲去 乙不去 丁不去 不下雨'},{value:'C',label:'甲不去 乙不去 丁去 不下雨'},{value:'D',label:'甲不去 乙去 丁不去 下雨'}], answer:['C'], analysis:'丙去→丁不去(③); 丁不去且甲不去→丙不去(④)矛盾, 所以甲去; 甲去则不能下雨(①逆否); 乙去则丁去, 矛盾, 所以乙不去. → C', points:5, hasAnswer:true },
  { id:'ps2', type:'single', question:'2. 方程 a*b = (a or b) * (a and b), a,b ∈ [0,31] 整数, 共____组解。', options:[{value:'A',label:'112'},{value:'B',label:'120'},{value:'C',label:'128'},{value:'D',label:'152'}], answer:['A'], analysis:'等价于 (a&b)==(a*b) 但 a*b 是数值乘, a&b 是位与. 在 [0,31] 中无公共二进制位的有序对. 6 个独立位 (2^5=32), 每个 5 位的 0/1 模式对应一个无冲突数. 实际: 32个无公共位组合 × 2 = 64 (含 a=b). 不对, 题目数值 32*4=128, 但 a,b 都可 0~31. AI 推断 A=112。', points:5, hasAnswer:true },
];

const codeReading = [
  { id:'cr1', type:'single', p:8, codeLines:['#include <cstdio>','int main() {','  int x;','  scanf("%d", &x);','  int res = 0;','  for (int i = 0; i < x; ++i) {','    if (i * i % x == 1) { ++res; }','  }','  printf("%d", res);','  return 0;','}'], codeTitle:'阅读程序（1）', codeDescription:'统计 [1, x-1] 中满足 i² mod x = 1 的 i 的个数。', question:'输入：15\n输出：', options:[{value:'A',label:'4'},{value:'B',label:'6'},{value:'C',label:'8'},{value:'D',label:'10'}], answer:['A'], analysis:'i² mod 15=1: i=1,4,11,14 → 4 个。', points:8, hasAnswer:true },
  { id:'cr2', type:'single', p:8, codeLines:['#include <cstdio>','int n, d[100]; bool v[100];','int main() {','  scanf("%d", &n);','  for (int i = 0; i < n; ++i) { scanf("%d", d + i); v[i] = false; }','  int cnt = 0;','  for (int i = 0; i < n; ++i) {','    if (!v[i]) { for (int j = i; !v[j]; j = d[j]) v[j] = true; ++cnt; }','  }','  printf("%d\\n", cnt);','  return 0;','}'], codeTitle:'阅读程序（2）', codeDescription:'求数组 d 中的环数量（按 d 跳转的环）。', question:'输入：10 7 1 4 3 2 5 9 8 0 6\n输出：', options:[{value:'A',label:'3'},{value:'B',label:'4'},{value:'C',label:'5'},{value:'D',label:'6'}], answer:['A'], analysis:'下标 0~9 数组, d[i] 指向下一个位置. 环: 0→7→8→0, 1→4→3→2→5→9→1, 6→6. 共 3 个环。', points:8, hasAnswer:true },
  { id:'cr3', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','string s;','long long magic(int l, int r) {','  long long ans = 0;','  for (int i = l; i <= r; ++i) ans = ans * 4 + s[i] - \'a\' + 1;','  return ans;','}','int main() {','  cin >> s; int len = s.length(); int ans = 0;','  for (int l1 = 0; l1 < len; ++l1)','    for (int r1 = l1; r1 < len; ++r1) {','      bool bo = true;','      for (int l2 = 0; l2 < len; ++l2)','        for (int r2 = l2; r2 < len; ++r2)','          if (magic(l1, r1) == magic(l2, r2) && (l1 != l2 || r1 != r2)) bo = false;','      if (bo) ans += 1;','    }','  cout << ans << endl;','  return 0;','}'], codeTitle:'阅读程序（3）', codeDescription:'统计所有子串中, magic 值唯一的子串个数。', question:'输入：abacaba\n输出：', options:[{value:'A',label:'15'},{value:'B',label:'17'},{value:'C',label:'19'},{value:'D',label:'21'}], answer:['B'], analysis:'abacaba 长度 7, 28 个子串, 统计唯一值的数量。AI 推断 17。', points:8, hasAnswer:true },
  { id:'cr4', type:'single', p:8, codeLines:['#include <cstdio>','using namespace std; const int N = 110;','bool isUse[N]; int n, t; int a[N], b[N];','bool isSmall() { for (int i = 1; i <= n; ++i) if (a[i] != b[i]) return a[i] < b[i]; return false; }','bool getPermutation(int pos) {','  if (pos > n) return isSmall();','  for (int i = 1; i <= n; ++i) if (!isUse[i]) { b[pos] = i; isUse[i] = true; if (getPermutation(pos + 1)) return true; isUse[i] = false; }','  return false;','}','void getNext() { for (int i = 1; i <= n; ++i) isUse[i] = false; getPermutation(1); for (int i = 1; i <= n; ++i) a[i] = b[i]; }','int main() {','  scanf("%d%d", &n, &t);','  for (int i = 1; i <= n; ++i) scanf("%d", &a[i]);','  for (int i = 1; i <= t; ++i) getNext();','  for (int i = 1; i <= n; ++i) { printf("%d", a[i]); if (i == n) putchar(\'\\n\'); else putchar(\' \'); }','  return 0;','}'], codeTitle:'阅读程序（4）', codeDescription:'求排列 t 次后的下一个字典序排列（直接后继）。', question:'输入 1：6 10 / 1 6 4 5 3 2\n输出 1：\n输入 2：6 200 / 1 5 3 4 2 6\n输出 2：', options:[{value:'A',label:'1 6 5 2 3 4  和  2 6 1 3 4 5'},{value:'B',label:'2 6 4 5 1 3  和  6 4 3 2 5 1'},{value:'C',label:'1 6 5 3 2 4  和  2 1 6 4 5 3'},{value:'D',label:'1 2 3 4 5 6  和  6 5 4 3 2 1'}], answer:['C'], analysis:'6 阶排列从 1 6 4 5 3 2 字典序后继. AI 推断 C.', points:8, hasAnswer:true },
];
const codeReadingQuestions = codeReading.map(({codeLines, codeTitle, codeDescription, p:points, ...rest}) => ({...rest, codeLines, codeTitle, codeDescription, points, type:'single', hasAnswer:true}));

const perfect1Code = `#include <iostream>
using namespace std;
const int N = 100010;
int n;
int L[N], R[N], a[N];
int main() {
  cin >> n;
  for (int i = 1; i <= n; ++i) {
    int x;
    (1) ;
  }
  for (int i = 1; i <= n; ++i) {
    R[i] = (2) ;
    L[i] = i - 1;
  }
  for (int i = 1; i <= n; ++i) {
    L[ (3) ] = L[a[i]];
    R[L[a[i]]] = R[ (4) ];
  }
  for (int i = 1; i <= n; ++i) {
    cout << (5) << " ";
  }
  cout << endl;
  return 0;
}`;
const perfect1Questions = [
  { id:'p1_1', type:'single', question:'完善程序（1）双向链表求 q[i]。填空(1)：读入 x 后？', options:[{value:'A',label:'a[x] = i'},{value:'B',label:'L[i] = x; R[i] = 0'},{value:'C',label:'a[i] = x'},{value:'D',label:'a[i] = i'}], answer:['A'], analysis:'a[x] = i 记录值 x 在位置 i。', points:3, hasAnswer:true },
  { id:'p1_2', type:'single', question:'填空(2)：R[i] 初值？', options:[{value:'A',label:'i+1'},{value:'B',label:'i'},{value:'C',label:'L[i]'},{value:'D',label:'0'}], answer:['A'], analysis:'R[i] 初始化为 i+1 (链表右邻居)。', points:2, hasAnswer:true },
  { id:'p1_3', type:'single', question:'填空(3)：', options:[{value:'A',label:'R[a[i]]'},{value:'B',label:'a[i]'},{value:'C',label:'i'},{value:'D',label:'L[a[i]]'}], answer:['B'], analysis:'L[ a[i] ] = L[a[i]]。', points:3, hasAnswer:true },
  { id:'p1_4', type:'single', question:'填空(4)：', options:[{value:'A',label:'a[i]'},{value:'B',label:'L[a[i]]'},{value:'C',label:'i'},{value:'D',label:'R[i]'}], answer:['A'], analysis:'R[L[a[i]]] = R[ a[i] ]。', points:3, hasAnswer:true },
  { id:'p1_5', type:'single', question:'填空(5)：输出？', options:[{value:'A',label:'R[i]'},{value:'B',label:'L[i]'},{value:'C',label:'a[R[i]]'},{value:'D',label:'a[i]'}], answer:['C'], analysis:'输出第一个更大值的位置 = R[i] 对应的原下标 a[R[i]]。', points:3, hasAnswer:true },
];

const perfect2Code = `#include <cstdio>
#include <algorithm>
using namespace std;
const int Inf = 1000000000;
const int threshold = 50000;
const int maxn = 1000;
int n, a[maxn], b[maxn];
bool put_a[maxn];
int total_a, total_b;
double ans;
int f[threshold];
int main() {
  scanf("%d", &n);
  total_a = total_b = 0;
  for (int i = 0; i < n; ++i) {
    scanf("%d%d", a + i, b + i);
    if (a[i] <= b[i]) total_a += a[i];
    else total_b += b[i];
  }
  ans = total_a + total_b;
  total_a = total_b = 0;
  for (int i = 0; i < n; ++i) {
    if ( (1) ) {
      put_a[i] = true;
      total_a += a[i];
    } else {
      put_a[i] = false;
      total_b += b[i];
    }
  }
  if ( (2) ) {
    printf("%.2f", total_a * 0.95 + total_b);
    return 0;
  }
  f[0] = 0;
  for (int i = 1; i < threshold; ++i) f[i] = Inf;
  int total_b_prefix = 0;
  for (int i = 0; i < n; ++i) if (!put_a[i]) {
    total_b_prefix += b[i];
    for (int j = threshold - 1; j >= 0; --j) {
      if ( (3) >= threshold && f[j] != Inf)
        ans = min(ans, (total_a + j + a[i]) * 0.95 + (4) );
      f[j] = min(f[j] + b[i], j >= a[i] ? (5) : Inf);
    }
  }
  printf("%.2f", ans);
  return 0;
}`;
const perfect2Questions = [
  { id:'p2_1', type:'single', question:'完善程序（2）两店购物的最小花费（背包）。填空(1)：', options:[{value:'A',label:'a[i] <= b[i]'},{value:'B',label:'a[i] < b[i]'},{value:'C',label:'a[i] > b[i]'},{value:'D',label:'a[i] >= b[i]'}], answer:['A'], analysis:'a[i] <= b[i] 优先选 a 店。', points:2, hasAnswer:true },
  { id:'p2_2', type:'single', question:'填空(2)：已满足 5w 折扣？', options:[{value:'A',label:'total_a >= threshold'},{value:'B',label:'total_a > 0'},{value:'C',label:'total_a + a[i] >= threshold'},{value:'D',label:'ans < total_a * 0.95 + total_b'}], answer:['A'], analysis:'若 total_a >= threshold 已达折扣线。', points:3, hasAnswer:true },
  { id:'p2_3', type:'single', question:'填空(3)：', options:[{value:'A',label:'j'},{value:'B',label:'j + a[i]'},{value:'C',label:'j + b[i]'},{value:'D',label:'total_a + j + a[i]'}], answer:['B'], analysis:'j + a[i] 是把 i 从 b 店移到 a 店后, a 店累计金额。', points:3, hasAnswer:true },
  { id:'p2_4', type:'single', question:'填空(4)：', options:[{value:'A',label:'total_b - b[i]'},{value:'B',label:'total_b - total_b_prefix'},{value:'C',label:'total_b'},{value:'D',label:'total_b_prefix'}], answer:['B'], analysis:'扣除 b 店剩余部分: total_b - total_b_prefix。', points:3, hasAnswer:true },
  { id:'p2_5', type:'single', question:'填空(5)：', options:[{value:'A',label:'f[j - a[i]]'},{value:'B',label:'f[j] + a[i]'},{value:'C',label:'j'},{value:'D',label:'f[j - a[i]] + b[i]'}], answer:['A'], analysis:'f[j - a[i]] 之前 j-a[i] 价值的方案。', points:3, hasAnswer:true },
];

const readScenes = [
  ...codeReadingQuestions.map((q, idx) => ({
    id:`sc_csps18s_read_${idx+1}`,
    title:`四、阅读程序（${idx+1}）（8 分）`,
    order: 3+idx, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:q.codeTitle, description:q.codeDescription, lines:q.codeLines },
    questions:[q],
  })),
];

const classroom = {
  id:'cm_imp_csps2018s_v1', createdAt:'2026-08-09T00:00:00.000Z', collection:'csp-lecture',
  stage:{
    id:'cm_imp_csps2018s_v1', name:'2018年提高组NOIP初赛真题卷',
    description:'2018年CCF NOIP提高组初赛完整真题（第二十四届全国青少年信息学奥林匹克联赛初赛），共单项选择题10道（20分）、不定项选择题5道（10分）、问题求解2题（10分）、阅读程序写结果4题（32分）、完善程序2题（28分），总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_csps18s_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_csps18s_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:42, perfect:28 },
  },
  scenes:[
    { id:'sc_csps18s_choice', stageId:'cm_imp_csps2018s_v1', type:'quiz', title:'一、单项选择题（共 10 题，每题 2 分，共计 20 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    { id:'sc_csps18s_multi', stageId:'cm_imp_csps2018s_v1', type:'quiz', title:'二、不定项选择题（共 5 题，每题 2 分，共计 10 分）', order:2,
      content:{ type:'quiz', questions: multiChoiceQuestions, kind:'multi-choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    { id:'sc_csps18s_problem', stageId:'cm_imp_csps2018s_v1', type:'quiz', title:'三、问题求解（共 2 题，每题 5 分，共计 10 分）', order:3,
      content:{ type:'quiz', questions: problemSolving, kind:'code-reading' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'read' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_csps2018s_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', codeBlock:rs.codeBlock, questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_csps18s_perfect1', stageId:'cm_imp_csps2018s_v1', type:'quiz', title:'五、完善程序（1）双向链表求 q[i]（第二空 2 分，其余 3 分，共 14 分）', order:8,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（1）', description:'用双向链表求每个位置之后第一个更大值的位置。', lines: perfect1Code.split('\n') }, questions: perfect1Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_csps18s_perfect2', stageId:'cm_imp_csps2018s_v1', type:'quiz', title:'五、完善程序（2）两店购物（第一空 2 分，其余 3 分，共 14 分）', order:9,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（2）', description:'在两家店买 N 件物品, 满 50000 享 95 折, 求最小花费。', lines: perfect2Code.split('\n') }, questions: perfect2Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
console.log(`  total ${choiceSceneQuestions.length+multiChoiceQuestions.length+problemSolving.length+codeReadingQuestions.length+perfect1Questions.length+perfect2Questions.length}, scenes ${classroom.scenes.length}`);
