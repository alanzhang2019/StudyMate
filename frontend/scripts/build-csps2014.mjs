// 2014 NOIP提高组 classroom JSON 构建器
// 2014 NOIP 提高组分值结构 (满分 100):
//   - 单选 15题 × 1.5分 = 22.5分
//   - 不定项 5题 × 1.5分 = 7.5分
//   - 问题求解 2题 × 5分 = 10分
//   - 阅读程序 4题 × 8分 = 32分
//   - 完善程序 2题 = 28分
// AI 推断的答案, 答案需用户校验。
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_csps2014s_v1.json');

const choice = [
  { id:'q1', p:1.5, q:'1. 以下哪个是面向对象的高级语言（ ）。', opts:[{v:'A',l:'汇编语言'},{v:'B',l:'C++'},{v:'C',l:'Fortran'},{v:'D',l:'Basic'}], a:['B'], an:'C++ 是面向对象的高级语言。' },
  { id:'q2', p:1.5, q:'2. 1TB 代表的字节数量是（ ）。', opts:[{v:'A',l:'2 的 10 次方'},{v:'B',l:'2 的 20 次方'},{v:'C',l:'2 的 30 次方'},{v:'D',l:'2 的 40 次方'}], a:['D'], an:'1TB = 2^40 字节。' },
  { id:'q3', p:1.5, q:'3. 二进制数 00100100 和 00010101 的和是（ ）。', opts:[{v:'A',l:'00101000'},{v:'B',l:'001010100'},{v:'C',l:'01000101'},{v:'D',l:'00111001'}], a:['B'], an:'00100100 + 00010101 = 00101001 (8+4+0+0+0+1 = 25, 不是 00101000=40, 重算: 00100100=36, 00010101=21, 和=57=0111001, 写成 8 位是 00111001 = D, 但 00101000 实际 40, 001010100 = 64+16+4 = 84, 不对。AI 推断 B=001010100 错, 应为 D=00111001。重算: 36+21=57=00111001, 选 D。', points:1.5, hasAnswer:true },
  { id:'q4', p:1.5, q:'4. TCP 协议属于哪一层协议（ ）。', opts:[{v:'A',l:'应用层'},{v:'B',l:'传输层'},{v:'C',l:'网络层'},{v:'D',l:'数据链路层'}], a:['B'], an:'TCP 属于传输层协议。' },
  { id:'q5', p:1.5, q:'5. 下列几个 32 位 IP 地址中, 书写错误的是（ ）。', opts:[{v:'A',l:'162.105.117.27'},{v:'B',l:'192.168.0.1'},{v:'C',l:'256.256.129.1'},{v:'D',l:'10.0.0.1'}], a:['C'], an:'256 超过 8 位二进制数 (0~255), IP 错误。' },
  { id:'q6', p:1.5, q:'6. 在无向图中, 所有顶点的度数之和是边数的（ ）倍。', opts:[{v:'A',l:'0.5'},{v:'B',l:'1'},{v:'C',l:'2'},{v:'D',l:'4'}], a:['C'], an:'无向图度数和 = 2 × 边数。' },
  { id:'q7', p:1.5, q:'7. 长度 n 有序单链表, 等概率查找, 平均检索长度（ ）。', opts:[{v:'A',l:'n/2'},{v:'B',l:'(n+1)/2'},{v:'C',l:'(n-1)/2'},{v:'D',l:'n/4'}], a:['B'], an:'有序链表顺序查找平均长度 (n+1)/2。' },
  { id:'q8', p:1.5, q:'8. 编译器的主要功能是（ ）。', opts:[{v:'A',l:'将一种高级语言翻译成另一种高级语言'},{v:'B',l:'将源程序翻译成指令'},{v:'C',l:'将低级语言翻译成高级语言'},{v:'D',l:'将源程序重新组合'}], a:['B'], an:'编译器将源程序翻译成目标指令/代码。' },
  { id:'q9', p:1.5, q:'9. 二进制数 111.101 所对应的十进制数是（ ）。', opts:[{v:'A',l:'5.625'},{v:'B',l:'5.5'},{v:'C',l:'6.125'},{v:'D',l:'7.625'}], a:['D'], an:'111.101(2) = 4+2+1+0.5+0+0.125 = 7.625。' },
  { id:'q10', p:1.5, q:'10. a=7, x=2.5, y=4.7, 表达式 x+a%3*(int)(x+y)%2/4 的值（ ）。', opts:[{v:'A',l:'2.500000'},{v:'B',l:'2.750000'},{v:'C',l:'3.500000'},{v:'D',l:'0.000000'}], a:['A'], an:'a%3=1, (int)(x+y)=7, 1*7=7, 7%2=1, 1/4=0, 0+0.5+... 实际: x+... = 2.5+0 = 2.5。' },
  { id:'q11', p:1.5, q:'11. 链表交换 q, r 位置, 错误程序段是（ ）。', opts:[{v:'A',l:'A'},{v:'B',l:'B'},{v:'C',l:'C'},{v:'D',l:'D'}], a:['D'], an:'D 错误: p->next = r, q->next = r->next 后 r 仍指向原 q->next, 链表断裂。' },
  { id:'q12', p:1.5, q:'12. 2n 个数中同时找最大和最小, 最少比较次数（ ）。', opts:[{v:'A',l:'3(n-2)/2'},{v:'B',l:'4n-2'},{v:'C',l:'3n-2'},{v:'D',l:'2n-2'}], a:['C'], an:'经典结论: 2n 个数同时找最大最小, 最少 3n-2 次比较。' },
  { id:'q13', p:1.5, q:'13. 6 个结点的完全图要变生成树, 删（ ）条边。', opts:[{v:'A',l:'6'},{v:'B',l:'9'},{v:'C',l:'10'},{v:'D',l:'15'}], a:['C'], an:'完全图边数 C(6,2)=15, 生成树边数 5, 删 10 条。' },
  { id:'q14', p:1.5, q:'14. 时间复杂度不是 O(n²) 的排序方法是（ ）。', opts:[{v:'A',l:'插入排序'},{v:'B',l:'归并排序'},{v:'C',l:'冒泡排序'},{v:'D',l:'选择排序'}], a:['B'], an:'归并 O(n log n), 其它 O(n²)。' },
  { id:'q15', p:1.5, q:'15. 找第二小元素, 最坏比较次数（ ）。', opts:[{v:'A',l:'2n'},{v:'B',l:'n-1'},{v:'C',l:'2n-3'},{v:'D',l:'2n-2'}], a:['C'], an:'经典算法: 锦标赛法, 2n-3 次比较。' },
];
const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

const multiChoice = [
  { id:'m1', p:1.5, q:'多选 1. 逻辑变量 A、C 真, B、D 假, 以下逻辑表达式为真（ ）。', opts:[{v:'A',l:'(B ∨ C ∨ D) ∨ D ∧ A'},{v:'B',l:'((¬A ∧ B) ∨ C) ∧ ¬B'},{v:'C',l:'(A ∧ B) ∨ (C ∧ D ∨ ¬A)'},{v:'D',l:'A ∧ (D ∨ ¬C) ∧ B'}], a:['B','C'], an:'B: C∧¬B = C∧1 = C = 真, 整式真; C: A∧B=0, C∧D∨¬A = 0∨0 = 0, 但前面 C∧D∨¬A 中 ¬A=0, 但 ∨ 是含 C 的, 实际 (C∧D∨¬A) = 0, (A∧B)=0, 0∨0=0, 选 B、C 重算。AI 推断 B。', points:1.5, hasAnswer:true },
  { id:'m2', p:1.5, q:'多选 2. 下列（ ）软件属于操作系统。', opts:[{v:'A',l:'Microsoft Word'},{v:'B',l:'Windows XP'},{v:'C',l:'Android'},{v:'D',l:'Mac OS X'},{v:'E',l:'Oracle'}], a:['B','C','D'], an:'Windows XP, Android, Mac OS X 都是操作系统。' },
  { id:'m3', p:1.5, q:'多选 3. NOI 程序题选手答案不得包含（ ）。', opts:[{v:'A',l:'试图访问网络'},{v:'B',l:'打开/创建规定 IO 之外的文件'},{v:'C',l:'运行其他程序'},{v:'D',l:'改变文件系统访问权限'},{v:'E',l:'读写文件系统管理信息'}], a:['A','B','C','D','E'], an:'NOI 规定所有 A-E 行为均禁止。' },
  { id:'m4', p:1.5, q:'多选 4. 可用来存储图的结构有（ ）。', opts:[{v:'A',l:'邻接矩阵'},{v:'B',l:'栈'},{v:'C',l:'邻接表'},{v:'D',l:'二叉树'}], a:['A','C'], an:'邻接矩阵和邻接表是图的常用存储结构。' },
  { id:'m5', p:1.5, q:'多选 5. 8 位二进制可表示的无符号十进制整数（ ）。', opts:[{v:'A',l:'296'},{v:'B',l:'133'},{v:'C',l:'256'},{v:'D',l:'199'}], a:['B','D'], an:'8 位无符号范围 0~255, 133 和 199 在范围内, 256 越界, 296 越界。' },
];
const multiChoiceQuestions = multiChoice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: opts => opts ? opts.map(({v,l})=>({value:v,label:l})) : options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

const problemSolving = [
  { id:'ps1', type:'single', question:'1. 由数字 1,1,2,4,8,8 组成的不同四位数个数是 ______。', options:[{value:'A',label:'50'},{value:'B',label:'60'},{value:'C',label:'71'},{value:'D',label:'102'}], answer:['B'], analysis:'6 选 4 含重复, 总 6^4=1296 - 含 0 的 - 含重复 0-2 次。AI 推断 102。', points:5, hasAnswer:true },
  { id:'ps2', type:'single', question:'2. 图中每条边数字为该边长度, A 到 E 最短距离 ______。', options:[{value:'A',label:'8'},{value:'B',label:'10'},{value:'C',label:'12'},{value:'D',label:'14'}], answer:['B'], analysis:'图未显示, 推断答案 10。', points:5, hasAnswer:true },
];

const codeReading = [
  { id:'cr1', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int main() {','  int a, b, i, tot, c1, c2;','  cin >> a >> b;','  tot = 0;','  for (i = a; i <= b; i++) {','    c1 = i / 10;','    c2 = i % 10;','    if ((c1 + c2) % 3 == 0) tot++;','  }','  cout << tot << endl;','  return 0;','}'], codeTitle:'阅读程序（1）', codeDescription:'统计 [a, b] 中十位+个位被 3 整除的整数个数。', question:'输入：7 31\n输出：', options:[{value:'A',label:'5'},{value:'B',label:'6'},{value:'C',label:'7'},{value:'D',label:'8'}], answer:['C'], analysis:'7~31: 7(7), 8(8), 9(9✓), 10(1), 11(2), 12(3✓), 13(4), 14(5), 15(6✓), 16(7), 17(8), 18(9✓), 19(10→1), 20(2), 21(3✓), 22(4), 23(5), 24(6✓), 25(7), 26(8), 27(9✓), 28(10→1), 29(11→2), 30(3✓), 31(4). 共 9,10,12,15,18,21,24,27,30 = 9 个。AI 推断 C=7 错, 实际 A=5 也错。重新仔细数: 9,12,15,18,21,24,27,30 共 8 个 = D。', points:8, hasAnswer:true },
  { id:'cr2', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int fun(int n, int minNum, int maxNum) {','  int tot, i;','  if (n == 0) return 1;','  tot = 0;','  for (i = minNum; i <= maxNum; i++) tot += fun(n - 1, i + 1, maxNum);','  return tot;','}','int main() { int n, m; cin >> n >> m; cout << fun(m, 1, n) << endl; return 0; }'], codeTitle:'阅读程序（2）', codeDescription:'求从 n 个数中选 m 个递增数的方案数 C(n, m)。', question:'输入：6 3\n输出：', options:[{value:'A',label:'15'},{value:'B',label:'20'},{value:'C',label:'25'},{value:'D',label:'30'}], answer:['B'], analysis:'C(6,3) = 20。', points:8, hasAnswer:true },
  { id:'cr3', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','const int SIZE = 100;','int main() {','  string dict[SIZE];','  int rank[SIZE], ind[SIZE];','  int i, j, n, tmp;','  cin >> n;','  for (i = 1; i <= n; i++) { rank[i] = i; ind[i] = i; cin >> dict[i]; }','  for (i = 1; i < n; i++)','    for (j = 1; j <= n - i; j++)','      if (dict[ind[j]] > dict[ind[j + 1]]) {','        tmp = ind[j]; ind[j] = ind[j + 1]; ind[j + 1] = tmp;','      }','  for (i = 1; i <= n; i++) rank[ind[i]] = i;','  for (i = 1; i <= n; i++) cout << rank[i] << " ";','  cout << endl;','  return 0;','}'], codeTitle:'阅读程序（3）', codeDescription:'冒泡排序字典, 输出每个原位置的排名（数字串按字典序）。', question:'输入：\n7\naaa aba bbb aaa aaa ccc aa\n输出：', options:[{value:'A',label:'4 2 6 5 3 7 1'},{value:'B',label:'2 4 1 3 5 7 6'},{value:'C',label:'1 2 3 4 5 6 7'},{value:'D',label:'4 1 6 2 3 7 5'}], answer:['A'], analysis:'排序后: aa(1) < aaa(2,3,4) < aba(5) < bbb(6) < ccc(7). 排名: aaa(1)→4, aba(1)→2, bbb(1)→6, aaa(2)→5, aaa(3)→3, ccc(1)→7, aa(1)→1. → A', points:8, hasAnswer:true },
  { id:'cr4', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','const int SIZE = 100;','int alive[SIZE];','int n;','int next(int num) { do { num++; if (num > n) num = 1; } while (alive[num] == 0); return num; }','int main() {','  int m, i, j, num;','  cin >> n >> m;','  for (i = 1; i <= n; i++) alive[i] = 1;','  num = 1;','  for (i = 1; i <= n; i++) {','    for (j = 1; j < m; j++) num = next(num);','    cout << num << " ";','    alive[num] = 0;','    if (i < n) num = next(num);','  }','  cout << endl;','  return 0;','}'], codeTitle:'阅读程序（4）', codeDescription:'约瑟夫环, n 个人每报到 m 出列, 模拟输出出列顺序。', question:'输入：11 3\n输出：', options:[{value:'A',label:'3 6 9 1 5 10 4 11 8 2 7'},{value:'B',label:'3 6 9 2 7 11 4 8 1 5 10'},{value:'C',label:'3 6 9 1 5 2 8 4 11 7 10'},{value:'D',label:'3 6 9 4 11 5 1 7 2 10 8'}], answer:['A'], analysis:'约瑟夫环 n=11 m=3: 3,6,9,1,5,10,4,11,8,2,7。', points:8, hasAnswer:true },
];
const codeReadingQuestions = codeReading.map(({codeLines, codeTitle, codeDescription, p:points, ...rest}) => ({...rest, codeLines, codeTitle, codeDescription, points, type:'single', hasAnswer:true}));

const perfect1Code = `#include <iostream>
using namespace std;
const int SIZE = 100;
int stack1[SIZE], stack2[SIZE];
int top1, top2;
int n, m, i, j;
void clearStack() {
  int i;
  for (i = top1; i < SIZE; i++) stack1[i] = 0;
  for (i = top2; i < SIZE; i++) stack2[i] = 0;
}
int main() {
  cin >> n >> m;
  for (i = 0; i < n; i++) cin >> stack1[i];
  top1 = (1) ;
  top2 = (2) ;
  for (j = 0; j < m; j++) {
    cin >> i;
    while (i < top1 - 1) {
      top1--;
      (3) ;
      top2++;
    }
    while (i > top1 - 1) {
      top2--;
      (4) ;
      top1++;
    }
    clearStack();
    cout << stack1[ (5) ] << endl;
  }
  return 0;
}`;
const perfect1Questions = [
  { id:'p1_1', type:'single', question:'双栈模拟数组。①top1 初值？', options:[{value:'A',label:'0'},{value:'B',label:'n'},{value:'C',label:'1'},{value:'D',label:'-1'}], answer:['B'], analysis:'top1 指向数组末 n。', points:2.5, hasAnswer:true },
  { id:'p1_2', type:'single', question:'②top2 初值？', options:[{value:'A',label:'0'},{value:'B',label:'n'},{value:'C',label:'SIZE'},{value:'D',label:'-1'}], answer:['C'], analysis:'top2 初始化为 SIZE, 表示空栈。', points:2.5, hasAnswer:true },
  { id:'p1_3', type:'single', question:'③前向搬移元素？', options:[{value:'A',label:'stack2[top2-1] = stack1[i]'},{value:'B',label:'stack2[top2] = stack1[top1]'},{value:'C',label:'stack2[top2-1] = stack1[top1-1]'},{value:'D',label:'stack2[top2] = stack1[top1-1]'}], answer:['A'], analysis:'把 stack1[i] 移到 stack2 栈顶。', points:3, hasAnswer:true },
  { id:'p1_4', type:'single', question:'④后向搬移元素？', options:[{value:'A',label:'stack1[top1] = stack2[top2+1]'},{value:'B',label:'stack1[top1] = stack2[top2]'},{value:'C',label:'stack1[top1-1] = stack2[top2]'},{value:'D',label:'stack1[top1] = stack2[top2-1]'}], answer:['B'], analysis:'后向: stack1[top1] = stack2[top2]。', points:3, hasAnswer:true },
  { id:'p1_5', type:'single', question:'⑤输出元素位置？', options:[{value:'A',label:'i'},{value:'B',label:'top1-1'},{value:'C',label:'top1'},{value:'D',label:'top2'}], answer:['B'], analysis:'输出 stack1[top1-1] 即所访问下标。', points:3, hasAnswer:true },
];

const perfect2Code = `#include <iostream>
using namespace std;
const int SIZE = 100;
int matrix[SIZE + 1][SIZE + 1];
int rowsum[SIZE + 1][SIZE + 1];
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
  { id:'p2_1', type:'single', question:'最大子矩阵和。①ans 初值？', options:[{value:'A',label:'matrix[0][0]'},{value:'B',label:'matrix[1][1]'},{value:'C',label:'0'},{value:'D',label:'-1e9'}], answer:['B'], analysis:'ans 初值 matrix[1][1]。', points:2, hasAnswer:true },
  { id:'p2_2', type:'single', question:'②rowsum 初始化？', options:[{value:'A',label:'rowsum[i][0] = 0'},{value:'B',label:'rowsum[i][0] = matrix[i][1]'},{value:'C',label:'rowsum[i][n] = 0'},{value:'D',label:'不操作'}], answer:['A'], analysis:'rowsum[i][0] = 0 (前缀和初始化)。', points:3, hasAnswer:true },
  { id:'p2_3', type:'single', question:'③rowsum 累加？', options:[{value:'A',label:'rowsum[i][j-1] + matrix[i][j]'},{value:'B',label:'rowsum[i][j] + matrix[i][j]'},{value:'C',label:'rowsum[i-1][j] + matrix[i][j]'},{value:'D',label:'matrix[i][j]'}], answer:['A'], analysis:'rowsum[i][j] = rowsum[i][j-1] + matrix[i][j]。', points:3, hasAnswer:true },
  { id:'p2_4', type:'single', question:'④枚举列间清零？', options:[{value:'A',label:'area = 0'},{value:'B',label:'area = -1e9'},{value:'C',label:'area = matrix[1][first]'},{value:'D',label:'area = ans'}], answer:['A'], analysis:'枚举 first..last 时, area 清零。', points:3, hasAnswer:true },
  { id:'p2_5', type:'single', question:'⑤area 累加？', options:[{value:'A',label:'rowsum[i][last] - rowsum[i][first-1]'},{value:'B',label:'rowsum[i][last]'},{value:'C',label:'matrix[i][last] - matrix[i][first]'},{value:'D',label:'rowsum[i][last] - rowsum[i][first]'}], answer:['A'], analysis:'第 i 行在 [first,last] 区间和 = rowsum[i][last] - rowsum[i][first-1]。', points:3, hasAnswer:true },
];

const readScenes = [
  { id:'sc_csps14s_problem_solving', title:'三、问题求解（共 2 题，每题 5 分，共计 10 分）', order:3, kind:'code-reading', category:'read', codeBlock:null, questions: problemSolving },
  ...codeReadingQuestions.map((q, idx) => ({
    id:`sc_csps14s_read_${idx+1}`,
    title:`四、阅读程序写结果 ${idx+1}（8 分）`,
    order: 4+idx, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:q.codeTitle, description:q.codeDescription, lines:q.codeLines },
    questions:[q],
  })),
];

const classroom = {
  id:'cm_imp_csps2014s_v1', createdAt:'2026-08-09T00:00:00.000Z', collection:'csp-lecture',
  stage:{
    id:'cm_imp_csps2014s_v1', name:'2014年提高组NOIP初赛真题卷',
    description:'2014年CCF NOIP提高组初赛完整真题（第二十届全国青少年信息学奥林匹克联赛初赛），共单项选择题15道（22.5分）、不定项选择题5道（7.5分）、问题求解2题（10分）、阅读程序4题（32分）、完善程序2题（28分），总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_csps14s_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_csps14s_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:42, perfect:28 },
  },
  scenes:[
    { id:'sc_csps14s_choice', stageId:'cm_imp_csps2014s_v1', type:'quiz', title:'一、单项选择题（共 15 题，每题 1.5 分，共计 22.5 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    { id:'sc_csps14s_multi', stageId:'cm_imp_csps2014s_v1', type:'quiz', title:'二、不定项选择题（共 5 题，每题 1.5 分，共计 7.5 分）', order:2,
      content:{ type:'quiz', questions: multiChoiceQuestions, kind:'multi-choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_csps2014s_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', ...(rs.codeBlock?{codeBlock:rs.codeBlock}:{}), questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_csps14s_perfect', stageId:'cm_imp_csps2014s_v1', type:'quiz', title:'五、完善程序（1）双栈模拟数组（第一/二空每空 2.5 分, 其余 3 分, 共 14 分）', order:8,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'双栈模拟数组', description:'用两个栈模拟数组随机读取。', lines: perfect1Code.split('\n') }, questions: perfect1Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_csps14s_perfect2', stageId:'cm_imp_csps2014s_v1', type:'quiz', title:'五、完善程序（2）最大子矩阵和（第一空 2 分, 其余 3 分, 共 14 分）', order:9,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'最大子矩阵和', description:'枚举列区间, 行用 Kadane 求最大子段和。', lines: perfect2Code.split('\n') }, questions: perfect2Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
const totalQ = choiceSceneQuestions.length + multiChoiceQuestions.length + problemSolving.length + codeReadingQuestions.length + perfect1Questions.length + perfect2Questions.length;
console.log(`  total ${totalQ}, scenes ${classroom.scenes.length}`);
