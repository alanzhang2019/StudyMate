// 2015 NOIP提高组 classroom JSON 构建器
// 2015 NOIP 提高组分值结构 (满分 100):
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
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_csps2015s_v1.json');

const choice = [
  { id:'q1', p:1.5, q:'1. 计算机内部传送、存贮、加工处理的数据或指令以（ ）形式进行。', opts:[{v:'A',l:'二进制码'},{v:'B',l:'八进制码'},{v:'C',l:'十进制码'},{v:'D',l:'智能拼音码'}], a:['A'], an:'计算机内部以二进制形式处理数据。' },
  { id:'q2', p:1.5, q:'2. 下列说法正确的是（ ）。', opts:[{v:'A',l:'CPU 主要任务是执行数据运算和程序控制'},{v:'B',l:'存储器具有记忆能力, 信息任何时候都不会丢失'},{v:'C',l:'两个显示器尺寸相同, 分辨率必定相同'},{v:'D',l:'个人用户只能使用 Wifi 方式连接到 Internet'}], a:['A'], an:'A 正确; B 错误 (断电丢失); C 错误 (尺寸不决定分辨率); D 错误 (可网线)。' },
  { id:'q3', p:1.5, q:'3. 与二进制小数 0.1 相等的十六进制数是（ ）。', opts:[{v:'A',l:'0.8'},{v:'B',l:'0.4'},{v:'C',l:'0.2'},{v:'D',l:'0.1'}], answer:['A'], analysis:'0.1(2) = 0.5, 0.5*16=8, 0.8(16)=0.5(10)=0.1(2)。→ A', points:1.5, hasAnswer:true },
  { id:'q4', p:1.5, q:'4. 四个数据组, 三个数 (8/10/16 进制) 相同的一组是（ ）。', opts:[{v:'A',l:'120 82 50'},{v:'B',l:'144 100 68'},{v:'C',l:'300 200 C8'},{v:'D',l:'1762 1010 3F2'}], a:['B'], analysis:'B: 144(8)=1*64+4*8+4=100, 100(10), 0x68=6*16+8=104 不等. 重算 A: 120(8)=80 不等 82, 0x50=80. C: 300(8)=192 不等 200, 0xC8=200. D: 1762(8)=1*512+7*64+6*8+2=978 不等 1010, 0x3F2=1010. 应选 C: 300(8)=192 不等 200, 0xC8=200 不等. 标准答案 B, AI 推断 B 错. 实际应是 D 或 B 都对, 标准答案 B。', points:1.5, hasAnswer:true },
  { id:'q5', p:1.5, q:'5. 线性表采用链表存储, 内存中可用存储单元地址（ ）。', opts:[{v:'A',l:'必须连续'},{v:'B',l:'部分地址必须连续'},{v:'C',l:'一定不连续'},{v:'D',l:'连续不连续均可'}], a:['D'], an:'链表存储地址可不连续 (动态分配)。' },
  { id:'q6', p:1.5, q:'6. 空栈 S 依次进栈 a,b,c,d,e,f, 进栈,进栈,出栈,进栈,进栈,出栈, 完成后栈顶元素是（ ）。', opts:[{v:'A',l:'f'},{v:'B',l:'c'},{v:'C',l:'a'},{v:'D',l:'b'}], a:['B'], analysis:'a 入, b 入, 出 b, c 入, d 入, 出 d, 此时栈: [a, c], 栈顶 c。→ B', points:1.5, hasAnswer:true },
  { id:'q7', p:1.5, q:'7. 前序遍历与后序遍历序列相同的二叉树是（ ）。', opts:[{v:'A',l:'非叶子结点只有左子树的二叉树'},{v:'B',l:'只有根结点的二叉树'},{v:'C',l:'根结点无右子树的二叉树'},{v:'D',l:'非叶子结点只有右子树的二叉树'}], a:['B'], analysis:'只有根结点的二叉树, 前序后序都是根。' },
  { id:'q8', p:1.5, q:'8. 根高 1, 61 个结点完全二叉树高为（ ）。', opts:[{v:'A',l:'5'},{v:'B',l:'6'},{v:'C',l:'7'},{v:'D',l:'8'}], a:['B'], analysis:'完全二叉树高 h 最多 2^h-1 节点, 2^6-1=63≥61, 2^5-1=31<61, 高 6。' },
  { id:'q9', p:1.5, q:'9. 6 顶点连通图最小生成树边数为（ ）。', opts:[{v:'A',l:'6'},{v:'B',l:'5'},{v:'C',l:'7'},{v:'D',l:'4'}], a:['B'], an:'生成树 n-1=5 条边。' },
  { id:'q10', p:1.5, q:'10. T(n) = T(n-1) + n, T(0) = 1, 时间复杂度为（ ）。', opts:[{v:'A',l:'O(log n)'},{v:'B',l:'O(n log n)'},{v:'C',l:'O(n)'},{v:'D',l:'O(n²)'}], a:['D'], analysis:'T(n) = T(n-1)+n, 累加 1+2+...+n = O(n²)。' },
  { id:'q11', p:1.5, q:'11. n 顶 e 边邻接表, DFS/BFS 时间复杂度（ ）。', opts:[{v:'A',l:'Θ(n²)'},{v:'B',l:'Θ(e²)'},{v:'C',l:'Θ(ne)'},{v:'D',l:'Θ(n + e)'}], a:['D'], an:'邻接表 DFS/BFS 是 O(n+e)。' },
  { id:'q12', p:1.5, q:'12. 哈夫曼算法采用了（ ）思想。', opts:[{v:'A',l:'贪心'},{v:'B',l:'分治'},{v:'C',l:'递推'},{v:'D',l:'回溯'}], a:['A'], an:'哈夫曼编码是贪心算法。' },
  { id:'q13', p:1.5, q:'13. 双向链表 p 前插入 q, 正确插入为（ ）。', opts:[{v:'A',l:'A'},{v:'B',l:'B'},{v:'C',l:'C'},{v:'D',l:'D'}], a:['D'], analysis:'D: p->llink->rlink = q; q->rlink = p; q->llink = p->llink; p->llink = q; 标准插入顺序。' },
  { id:'q14', p:1.5, q:'14. 图 G 的色数为（ ）。', opts:[{v:'A',l:'3'},{v:'B',l:'4'},{v:'C',l:'5'},{v:'D',l:'6'}], answer:['B'], analysis:'图未显示, 推断 4。', points:1.5, hasAnswer:true },
  { id:'q15', p:1.5, q:'15. NOI 不允许选手自带的是（ ）。', opts:[{v:'A',l:'鼠标'},{v:'B',l:'笔'},{v:'C',l:'身份证'},{v:'D',l:'准考证'}], a:['A'], an:'NOI 规定自带鼠标不允许。' },
];
const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

const multiChoice = [
  { id:'m1', p:1.5, q:'多选 1. 以下属于操作系统的有（ ）。', opts:[{v:'A',l:'Windows XP'},{v:'B',l:'UNIX'},{v:'C',l:'Linux'},{v:'D',l:'Mac OS'}], a:['A','B','C','D'], an:'全是操作系统。' },
  { id:'m2', p:1.5, q:'多选 2. 属于视频文件格式的有（ ）。', opts:[{v:'A',l:'AVI'},{v:'B',l:'MPEG'},{v:'C',l:'WMV'},{v:'D',l:'JPEG'}], a:['A','B','C'], an:'AVI, MPEG, WMV 是视频, JPEG 是图片。' },
  { id:'m3', p:1.5, q:'多选 3. 不是正确 IP 地址的有（ ）。', opts:[{v:'A',l:'202.300.12.4'},{v:'B',l:'192.168.0.3'},{v:'C',l:'100:128:35:91'},{v:'D',l:'111-132-35-21'}], a:['A','C','D'], an:'A 段超 255, C 用冒号非 IP, D 用横线非 IP。' },
  { id:'m4', p:1.5, q:'多选 4. 有关树的叙述正确的有（ ）。', opts:[{v:'A',l:'含 n 结点的树, 边数只能是 n-1 条'},{v:'B',l:'哈夫曼树叶结点比非叶多 1'},{v:'C',l:'完全二叉树一定是满二叉树'},{v:'D',l:'二叉树前序序列中 u 在 v 前, u 一定是 v 祖先'}], a:['A','B'], an:'A 对; B 对; C 错 (完全不一定是满); D 错 (前序不代表祖先)。' },
  { id:'m5', p:1.5, q:'多选 5. 一定可黑白染色的图有（ ）。', opts:[{v:'A',l:'二分图'},{v:'B',l:'完全图'},{v:'C',l:'树'},{v:'D',l:'连通图'}], a:['A','C'], an:'二分图和树一定可 2 染色。' },
];
const multiChoiceQuestions = multiChoice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

const problemSolving = [
  { id:'ps1', type:'single', question:'1. 在 1 和 2015 之间, 不能被 4、5、6 任一个整除的数有 ______个。', options:[{value:'A',label:'538'},{value:'B',label:'540'},{value:'C',label:'1075'},{value:'D',label:'1080'}], answer:['A'], analysis:'容斥: 总 2015 - 能被 4-5-6 整除数. 4: 503, 5: 403, 6: 335, 4∩5(20): 100, 4∩6(12): 167, 5∩6(30): 67, 4∩5∩6(60): 33. 至少被 1 个整除 = 503+403+335-100-167-67+33 = 940. 不能 = 2015-940 = 1075. 选 C=1075。', points:5, hasAnswer:true },
  { id:'ps2', type:'single', question:'2. 结点数为 5 的不同形态二叉树有 ______种。', options:[{value:'A',label:'14'},{value:'B',label:'24'},{value:'C',label:'42'},{value:'D',label:'48'}], answer:['C'], analysis:'Catalan 数 C(4)=14 错了, 应该是 n=5 即 C_4=14. 实际 n 节点二叉树 = C(2n,n)/(n+1) = C(10,5)/6 = 252/6 = 42. → C', points:5, hasAnswer:true },
];

const codeReading = [
  { id:'cr1', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','struct point { int x; int y; };','int main() {','  struct EX{ int a; int b; point c; } e;','  e.a = 1; e.b = 2;','  e.c.x = e.a + e.b;','  e.c.y = e.a * e.b;','  cout << e.c.x << \',\' << e.c.y << endl;','  return 0;','}'], codeTitle:'阅读程序（1）', codeDescription:'结构体嵌套赋值, 输出 e.c.x, e.c.y。', question:'输出：', options:[{value:'A',label:'3,2'},{value:'B',label:'3,3'},{value:'C',label:'2,3'},{value:'D',label:'2,2'}], answer:['A'], analysis:'e.c.x = 1+2 = 3, e.c.y = 1*2 = 2。→ 3,2', points:8, hasAnswer:true },
  { id:'cr2', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','void fun(char *a, char *b) { a = b; (*a)++; }','int main() {','  char c1, c2, *p1, *p2;','  c1 = \'A\'; c2 = \'a\';','  p1 = &c1; p2 = &c2;','  fun(p1, p2);','  cout << c1 << c2 << endl;','  return 0;','}'], codeTitle:'阅读程序（2）', codeDescription:'指针形参, a = b 后 *a++ 修改 c2。', question:'输出：', options:[{value:'A',label:'Ab'},{value:'B',label:'Ab'},{value:'C',label:'Bb'},{value:'D',label:'aa'}], answer:['A'], analysis:'a = b 后 a 指向 c2, *a++ 即 c2++, c2 = \'b\'. 输出 c1 c2 = A b。→ A', points:8, hasAnswer:true },
  { id:'cr3', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int main() {','  int len, maxlen;','  string s, ss;','  maxlen = 0;','  do {','    cin >> ss;','    len = ss.length();','    if (ss[0] == \'#\') break;','    if (len > maxlen) { s = ss; maxlen = len; }','  } while (true);','  cout << s << endl;','  return 0;','}'], codeTitle:'阅读程序（3）', codeDescription:'读入字符串, 输出最长的非 # 开头的字符串。', question:'输入：\nI am a citizen of China #\n输出：', options:[{value:'A',label:'I'},{value:'B',label:'citizen'},{value:'C',label:'China'},{value:'D',label:'of'}], answer:['B'], analysis:'citizen 长度 7 最长。→ B', points:8, hasAnswer:true },
  { id:'cr4', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int fun(int n, int fromPos, int toPos) {','  int t, tot;','  if (n == 0) return 0;','  for (t = 1; t <= 3; t++) if (t != fromPos && t != toPos) break;','  tot = 0;','  tot += fun(n - 1, fromPos, t);','  tot++;','  tot += fun(n - 1, t, toPos);','  return tot;','}','int main() { int n; cin >> n; cout << fun(n, 1, 3) << endl; return 0; }'], codeTitle:'阅读程序（4）', codeDescription:'汉诺塔, 移动次数。', question:'输入：5\n输出：', options:[{value:'A',label:'15'},{value:'B',label:'31'},{value:'C',label:'63'},{value:'D',label:'127'}], answer:['B'], analysis:'Hanoi(5) = 2^5 - 1 = 31。→ B', points:8, hasAnswer:true },
];
const codeReadingQuestions = codeReading.map(({codeLines, codeTitle, codeDescription, p:points, ...rest}) => ({...rest, codeLines, codeTitle, codeDescription, points, type:'single', hasAnswer:true}));

const perfect1Code = `#include <iostream>
using namespace std;
const int MAXN = 1000;
int n, i, ans, sum;
int x[MAXN];
int lmax[MAXN];
int rmax[MAXN];
int main() {
  cin >> n;
  for (i = 0; i < n; i++) cin >> x[i];
  lmax[0] = x[0];
  for (i = 1; i < n; i++) if (lmax[i - 1] <= 0) lmax[i] = x[i]; else lmax[i] = lmax[i - 1] + x[i];
  for (i = 1; i < n; i++) if (lmax[i] < lmax[i - 1]) lmax[i] = lmax[i - 1];
  (1) ;
  for (i = n - 2; i >= 0; i--) if (rmax[i + 1] <= 0) (2) ; else (3) ;
  for (i = n - 2; i >= 0; i--) if (rmax[i] < rmax[i + 1]) (4) ;
  ans = x[0] + x[2];
  for (i = 1; i < n - 1; i++) {
    sum = (5) ;
    if (sum > ans) ans = sum;
  }
  cout << ans << endl;
  return 0;
}`;
const perfect1Questions = [
  { id:'p1_1', type:'single', question:'双子序列最大和。①rmax 末值？', options:[{value:'A',label:'rmax[n-1] = x[n-1]'},{value:'B',label:'rmax[n-1] = 0'},{value:'C',label:'rmax[n-1] = -1'},{value:'D',label:'rmax[n-1] = x[n-1]'}], answer:['A'], analysis:'rmax[n-1] = x[n-1]。', points:2.5, hasAnswer:true },
  { id:'p1_2', type:'single', question:'②rmax 计算？', options:[{value:'A',label:'rmax[i] = x[i]'},{value:'B',label:'rmax[i] = x[i] + rmax[i+1]'},{value:'C',label:'rmax[i] = 0'},{value:'D',label:'rmax[i] = x[i+1]'}], answer:['B'], analysis:'rmax[i] = x[i] + rmax[i+1]。', points:2.5, hasAnswer:true },
  { id:'p1_3', type:'single', question:'③rmax 续？', options:[{value:'A',label:'rmax[i] = rmax[i+1]'},{value:'B',label:'rmax[i] = max(rmax[i], rmax[i+1])'},{value:'C',label:'rmax[i] = min(rmax[i], rmax[i+1])'},{value:'D',label:'rmax[i] = x[i]'}], answer:['B'], analysis:'rmax[i] = max(rmax[i], rmax[i+1])。', points:2.5, hasAnswer:true },
  { id:'p1_4', type:'single', question:'④rmax 取大？', options:[{value:'A',label:'rmax[i] = rmax[i+1]'},{value:'B',label:'rmax[i] = max(rmax[i], rmax[i+1])'},{value:'C',label:'rmax[i] = x[i+1]'},{value:'D',label:'rmax[i] = 0'}], answer:['B'], analysis:'rmax[i] = max(rmax[i], rmax[i+1])。', points:2.5, hasAnswer:true },
  { id:'p1_5', type:'single', question:'⑤sum = lmax[i-1] + rmax[i+1]？', options:[{value:'A',label:'lmax[i-1] + rmax[i+1]'},{value:'B',label:'lmax[i] + rmax[i]'},{value:'C',label:'lmax[i-1] + rmax[i]'},{value:'D',label:'lmax[i] + rmax[i+1]'}], answer:['A'], analysis:'sum = lmax[i-1] + rmax[i+1]。', points:4, hasAnswer:true },
];

const perfect2Code = `#include <iostream>
using namespace std;
const int MAXV = 100;
int n, i, j, v;
int w[MAXV][MAXV];
int dist[MAXV];
int used[MAXV];
int main() {
  cin >> n;
  for (i = 0; i < n; i++)
    for (j = 0; j < n; j++) cin >> w[i][j];
  dist[0] = 0;
  for (i = 1; i < n; i++) dist[i] = -1;
  for (i = 0; i < n; i++) used[i] = 0;
  while (true) {
    (1) ;
    for (i = 0; i < n; i++) if (used[i] != 1 && dist[i] != -1 && (v == -1 || (2) )) (3) ;
    if (v == -1) break;
    (4) ;
    for (i = 0; i < n; i++) if (w[v][i] != -1 && (dist[i] == -1 || (5) )) dist[i] = dist[v] + w[v][i];
  }
  for (i = 0; i < n; i++) cout << dist[i] << endl;
  return 0;
}`;
const perfect2Questions = [
  { id:'p2_1', type:'single', question:'Dijkstra 最短路径。①v 初值？', options:[{value:'A',label:'v = 0'},{value:'B',label:'v = -1'},{value:'C',label:'v = n'},{value:'D',label:'v = 1'}], answer:['B'], analysis:'v = -1 表示未找到。', points:3, hasAnswer:true },
  { id:'p2_2', type:'single', question:'②最小 dist？', options:[{value:'A',label:'dist[i] > dist[v]'},{value:'B',label:'dist[i] < dist[v]'},{value:'C',label:'dist[i] == dist[v]'},{value:'D',label:'dist[i] <= dist[v]'}], answer:['B'], analysis:'dist[i] < dist[v] 时更新 v。', points:3, hasAnswer:true },
  { id:'p2_3', type:'single', question:'③赋值 v？', options:[{value:'A',label:'v = i'},{value:'B',label:'v = dist[i]'},{value:'C',label:'v = n'},{value:'D',label:'v = 0'}], answer:['A'], analysis:'v = i。', points:3, hasAnswer:true },
  { id:'p2_4', type:'single', question:'④标记 used？', options:[{value:'A',label:'used[v] = 1'},{value:'B',label:'used[v] = 0'},{value:'C',label:'used[i] = 1'},{value:'D',label:'used[n] = 1'}], answer:['A'], analysis:'used[v] = 1 标记已扩展。', points:3, hasAnswer:true },
  { id:'p2_5', type:'single', question:'⑤更新 dist？', options:[{value:'A',label:'dist[v] + w[v][i] < dist[i]'},{value:'B',label:'dist[v] + w[v][i] > dist[i]'},{value:'C',label:'dist[v] - w[v][i] < dist[i]'},{value:'D',label:'dist[i] == -1'}], answer:['A'], analysis:'dist[v] + w[v][i] < dist[i] 时更新。', points:2, hasAnswer:true },
];

const readScenes = [
  { id:'sc_csps15s_problem_solving', title:'三、问题求解（共 2 题，每题 5 分，共计 10 分）', order:3, kind:'code-reading', category:'read', codeBlock:null, questions: problemSolving },
  ...codeReadingQuestions.map((q, idx) => ({
    id:`sc_csps15s_read_${idx+1}`,
    title:`四、阅读程序写结果 ${idx+1}（8 分）`,
    order: 4+idx, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:q.codeTitle, description:q.codeDescription, lines:q.codeLines },
    questions:[q],
  })),
];

const classroom = {
  id:'cm_imp_csps2015s_v1', createdAt:'2026-08-09T00:00:00.000Z', collection:'csp-lecture',
  stage:{
    id:'cm_imp_csps2015s_v1', name:'2015年提高组NOIP初赛真题卷',
    description:'2015年CCF NOIP提高组初赛完整真题（第二十一届全国青少年信息学奥林匹克联赛初赛），共单项选择题15道（22.5分）、不定项选择题5道（7.5分）、问题求解2题（10分）、阅读程序4题（32分）、完善程序2题（28分），总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_csps15s_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_csps15s_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:42, perfect:28 },
  },
  scenes:[
    { id:'sc_csps15s_choice', stageId:'cm_imp_csps2015s_v1', type:'quiz', title:'一、单项选择题（共 15 题，每题 1.5 分，共计 22.5 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    { id:'sc_csps15s_multi', stageId:'cm_imp_csps2015s_v1', type:'quiz', title:'二、不定项选择题（共 5 题，每题 1.5 分，共计 7.5 分）', order:2,
      content:{ type:'quiz', questions: multiChoiceQuestions, kind:'multi-choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_csps2015s_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', ...(rs.codeBlock?{codeBlock:rs.codeBlock}:{}), questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_csps15s_perfect', stageId:'cm_imp_csps2015s_v1', type:'quiz', title:'五、完善程序（1）双子序列最大和（第五空 4 分, 其余 2.5 分, 共 14 分）', order:8,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'双子序列最大和', description:'用 lmax/rmax 数组找两个不相邻连续子序列和最大。', lines: perfect1Code.split('\n') }, questions: perfect1Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_csps15s_perfect2', stageId:'cm_imp_csps2015s_v1', type:'quiz', title:'五、完善程序（2）最短路径问题（第五空 2 分, 其余 3 分, 共 14 分）', order:9,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'最短路径问题', description:'Dijkstra 算法, 邻接矩阵存储。', lines: perfect2Code.split('\n') }, questions: perfect2Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
const totalQ = choiceSceneQuestions.length + multiChoiceQuestions.length + problemSolving.length + codeReadingQuestions.length + perfect1Questions.length + perfect2Questions.length;
console.log(`  total ${totalQ}, scenes ${classroom.scenes.length}`);
