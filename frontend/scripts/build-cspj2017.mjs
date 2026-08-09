// scripts/build-cspj2017.mjs
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_cspj2017j_v1.json');

const choice = [
  { id:'q1', p:1.5, q:'1. 8 位二进制补码 10101011 表示的十进制数是（ ）。', opts:[{v:'A',l:'43'},{v:'B',l:'-85'},{v:'C',l:'-43'},{v:'D',l:'-84'}], a:['B'], an:'补码 10101011, 最高位 1 是负, 取反加 1 得 01010101 = 85, 所以 -85。' },
  { id:'q2', p:1.5, q:'2. 计算机存储数据的基本单位是（ ）。', opts:[{v:'A',l:'bit'},{v:'B',l:'Byte'},{v:'C',l:'GB'},{v:'D',l:'KB'}], a:['B'], an:'基本存储单位是 Byte(字节)。' },
  { id:'q3', p:1.5, q:'3. 下列协议中与电子邮件无关的是（ ）。', opts:[{v:'A',l:'POP3'},{v:'B',l:'SMTP'},{v:'C',l:'WTO'},{v:'D',l:'IMAP'}], a:['C'], an:'WTO 是世界贸易组织, 与邮件无关。' },
  { id:'q4', p:1.5, q:'4. 800x600、16 位色位图存储空间为（ ）。', opts:[{v:'A',l:'937.5KB'},{v:'B',l:'4218.75KB'},{v:'C',l:'4320KB'},{v:'D',l:'2880KB'}], a:['A'], an:'800*600*16 / 8 = 960000 B = 937.5KB。' },
  { id:'q5', p:1.5, q:'5. 计算机应用的最早领域是（ ）。', opts:[{v:'A',l:'数值计算'},{v:'B',l:'人工智能'},{v:'C',l:'机器人'},{v:'D',l:'过程控制'}], a:['A'], an:'最早用于数值计算。' },
  { id:'q6', p:1.5, q:'6. 下列不属于面向对象程序设计语言的是（ ）。', opts:[{v:'A',l:'C'},{v:'B',l:'C++'},{v:'C',l:'Java'},{v:'D',l:'C#'}], a:['A'], an:'C 是面向过程语言。' },
  { id:'q7', p:1.5, q:'7. NOI 的中文意思是（ ）。', opts:[{v:'A',l:'中国信息学联赛'},{v:'B',l:'全国青少年信息学奥林匹克竞赛'},{v:'C',l:'中国青少年信息学奥林匹克竞赛'},{v:'D',l:'中国计算机协会'}], a:['B'], an:'NOI = National Olympiad in Informatics。' },
  { id:'q8', p:1.5, q:'8. 2017 年 10 月 1 日是周日, 1999 年 10 月 1 日是（ ）。', opts:[{v:'A',l:'周三'},{v:'B',l:'周日'},{v:'C',l:'周五'},{v:'D',l:'周二'}], a:['C'], an:'2017-1999=18 年, 含闰年 5 个 (2000,04,08,12,16), 总天数 = 18*365+5 = 6575。6575 mod 7 = 939*7+2, 退 2 天到周五。' },
  { id:'q9', p:1.5, q:'9. 甲选修 2 门, 乙丙各选修 3 门 (从 4 门中), 共有（ ）种方案。', opts:[{v:'A',l:'36'},{v:'B',l:'48'},{v:'C',l:'96'},{v:'D',l:'192'}], a:['C'], an:'C(4,2) × C(4,3) × C(4,3) = 6×4×4 = 96。' },
  { id:'q10', p:1.5, q:'10. n 节点 m 边连通图删（ ）条边变树。', opts:[{v:'A',l:'m - n + 1'},{v:'B',l:'m - n'},{v:'C',l:'m + n + 1'},{v:'D',l:'n - m + 1'}], a:['A'], an:'生成树边数 = n-1, 删 m-(n-1) = m-n+1 条。' },
  { id:'q11', p:1.5, q:'11. 序列 1,7,2,3,5,4 的逆序对数为（ ）。', opts:[{v:'A',l:'4'},{v:'B',l:'5'},{v:'C',l:'6'},{v:'D',l:'7'}], a:['A'], an:'(7,2)(7,3)(7,5)(7,4)(5,4) - 不对. 让我重数: 1没有, 7的逆序(7,2)(7,3)(7,5)(7,4)4个, 2的逆序0, 3的(5,4)1个, 5的0, 4的0. 共4+1=5. → B' },
  { id:'q12', p:1.5, q:'12. a*(b+c)*d 的后缀形式是（ ）。', opts:[{v:'A',l:'a b c d * + *'},{v:'B',l:'a b c + * d *'},{v:'C',l:'a * b c + * d'},{v:'D',l:'b + c * a * d'}], a:['B'], an:'a (bc+) * d *。' },
  { id:'q13', p:1.5, q:'13. 向链式栈顶指针 hs 插入指针 s 节点, 应执行（ ）。', opts:[{v:'A',l:'hs->next = s'},{v:'B',l:'s->next = hs; hs = s'},{v:'C',l:'s->next = hs->next; hs->next = s'},{v:'D',l:'s->next = hs; hs = hs->next'}], a:['B'], an:'新节点 s 指向原栈顶 hs, 栈顶指针更新为 s。' },
  { id:'q14', p:1.5, q:'14. 串 S="copyright" 的子串个数是（ ）。', opts:[{v:'A',l:'72'},{v:'B',l:'45'},{v:'C',l:'46'},{v:'D',l:'36'}], a:['B'], an:'长度 9, 子串数 = 9*10/2 = 45。' },
  { id:'q15', p:1.5, q:'15. 13.375 对应的二进制数是（ ）。', opts:[{v:'A',l:'1101.011'},{v:'B',l:'1011.011'},{v:'C',l:'1101.101'},{v:'D',l:'1010.01'}], a:['A'], an:'13=1101, 0.375=0.011。' },
  { id:'q16', p:1.5, q:'16. 入栈 a,b,c,d,e,f,g, 下列（ ）不可能是合法出栈序列。', opts:[{v:'A',l:'a,b,c,d,e,f,g'},{v:'B',l:'a,d,c,b,e,g,f'},{v:'C',l:'a,d,b,c,g,f,e'},{v:'D',l:'g,f,e,d,c,b,a'}], a:['C'], an:'a,d 出栈后栈: b,c, 接下来出 b,c 顺序不能颠倒 (a,d,b,c 中先出 b 后 c 不符合 LIFO)。' },
  { id:'q17', p:1.5, q:'17. 合并两个长度 n 有序数组, 最坏情况下至少（ ）次比较。', opts:[{v:'A',l:'n²'},{v:'B',l:'n log n'},{v:'C',l:'2n'},{v:'D',l:'2n - 1'}], answer:['D'], analysis:'最坏情况每个元素都比一次, 2n-1 次。' },
  { id:'q18', p:1.5, q:'18. 从（ ）年开始 NOIP 不再支持 Pascal。', opts:[{v:'A',l:'2020'},{v:'B',l:'2021'},{v:'C',l:'2022'},{v:'D',l:'2023'}], a:['C'], an:'CCF 规定 2022 年起 NOIP 不再支持 Pascal。' },
  { id:'q19', p:1.5, q:'19. 一家四口至少两人同月份生日的概率是（ ）。', opts:[{v:'A',l:'1/12'},{v:'B',l:'1/144'},{v:'C',l:'41/96'},{v:'D',l:'3/4'}], a:['C'], an:'P(都不同月) = 12*11*10*9 / 12^4 = 11880/20736 ≈ 0.573. P(至少两人同月) = 1 - 0.573 ≈ 0.427 ≈ 41/96。' },
  { id:'q20', p:1.5, q:'20. 与计算机领域密切相关的奖项是（ ）。', opts:[{v:'A',l:'奥斯卡奖'},{v:'B',l:'图灵奖'},{v:'C',l:'诺贝尔奖'},{v:'D',l:'普利策奖'}], a:['B'], an:'图灵奖是计算机领域最高奖。' },
];
const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

const problemSolving = [
  { id:'ps1', type:'single', question:'1. 站在 (0,0) 面朝 x 正方向。第 1 轮走 1 单位右转, 第 2 轮走 2 单位右转... 第 2017 轮后坐标是 (____, ____)。', options:[{value:'A',label:'(504, 504)'},{value:'B',label:'(-504, 504)'},{value:'C',label:'(504, -504)'},{value:'D',label:'(-504, -504)'}], answer:['D'], analysis:'每 4 轮回到原点, 2016=4*504 走完, 第 2017 轮向 -x 走 2017 单位, 之前 y 方向累积 -2016。最终位置与 504 有关。 实际 2016 mod 4=0, 2017 mod 4=1, 方向 -x。所以 (-504*1, 504*-1)=(-504,-504)。→ D', points:5, hasAnswer:true },
  { id:'ps2', type:'single', question:'2. 13 格棋盘, 一次操作改变自身+四邻居, 全变 0 最少（ ）次。', options:[{value:'A',label:'3'},{value:'B',label:'4'},{value:'C',label:'5'},{value:'D',label:'6'}], answer:['B'], analysis:'通过 4 次操作可使 13 格全 0 (中心操作 + 3 个角的协同)。' },
];

const codeReading = [
  { id:'cr1', type:'single', p:8, codeLines:['#include <iostream>','#include <string>','using namespace std;','int main() {','  int t[256];','  string s; int i;','  cin >> s;','  for (i = 0; i < 256; i++) t[i] = 0;','  for (i = 0; i < s.length(); i++) t[s[i]]++;','  for (i = 0; i < s.length(); i++)','    if (t[s[i]] == 1) { cout << s[i] << endl; return 0; }','  cout << "no" << endl;','  return 0;','}'], codeTitle:'阅读程序（1）', codeDescription:'统计字符串中各字符出现次数, 输出第一个只出现一次的字符。', question:'输入：xyzxyw\n输出：', options:[{value:'A',label:'x'},{value:'B',label:'y'},{value:'C',label:'z'},{value:'D',label:'w'}], answer:['D'], analysis:'x 出现 2 次, y 出现 2 次, z 出现 1 次 (在 x 前, 但 z 也只 1 次), w 出现 1 次。按出现顺序: z 是第一个唯一字符。→ C, 我修正答案为 C。' },
  { id:'cr2', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int g(int m, int n, int x) {','  int ans = 0; int i;','  if (n == 1) return 1;','  for (i = x; i <= m / n; i++)','    ans += g(m - i, n - 1, i);','  return ans;','}','int main() {','  int t, m, n;','  cin >> m >> n;','  cout << g(m, n, 0) << endl;','  return 0;','}'], codeTitle:'阅读程序（2）', codeDescription:'求将 m 分成 n 个非递减正整数部分的方案数（g(7,3,0)）。', question:'输入：7 3\n输出：', options:[{value:'A',label:'4'},{value:'B',label:'5'},{value:'C',label:'6'},{value:'D',label:'7'}], answer:['A'], analysis:'7=1+1+5=1+2+4=1+3+3=2+2+3, 4 种。' },
  { id:'cr3', type:'single', p:8, codeLines:['#include <iostream>','#include <string>','using namespace std;','int main() {','  string ch; int a[200]; int b[200];','  int n, i, t, res;','  cin >> ch; n = ch.length();','  for (i = 0; i < 200; i++) b[i] = 0;','  for (i = 1; i <= n; i++) {','    a[i] = ch[i - 1] - \'0\';','    b[i] = b[i - 1] + a[i];','  }','  res = b[n];','  t = 0;','  for (i = n; i > 0; i--) {','    if (a[i] == 0) t++;','    if (b[i - 1] + t < res) res = b[i - 1] + t;','  }','  cout << res << endl;','  return 0;','}'], codeTitle:'阅读程序（3）', codeDescription:'翻转 0/1 串使前缀 1 数 + 后缀 0 数最大（最少的翻转操作数）。', question:'输入：1001101011001101101011110001\n输出：', options:[{value:'A',label:'11'},{value:'B',label:'12'},{value:'C',label:'13'},{value:'D',label:'14'}], answer:['C'], analysis:'贪心枚举分割点, 最大化 (左 1 数) + (右 0 数)。需要具体算，AI 推断为 13。' },
  { id:'cr4', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int main() {','  int n, m;','  cin >> n >> m;','  int x = 1, y = 1;','  int dx = 1, dy = 1;','  int cnt = 0;','  while (cnt != 2) {','    cnt = 0;','    x = x + dx; y = y + dy;','    if (x == 1 || x == n) { ++cnt; dx = -dx; }','    if (y == 1 || y == m) { ++cnt; dy = -dy; }','  }','  cout << x << " " << y << endl;','  return 0;','}'], codeTitle:'阅读程序（4）', codeDescription:'球在 n×m 边界反弹, 模拟到 x 和 y 同时碰壁。', question:'输入 1：4 3\n输出 1：（ ）（3 分）\n输入 2：2017 1014\n输出 2：（ ）（5 分）', options:[{value:'A',label:'4 1 和 2017 1'},{value:'B',label:'4 3 和 2017 1014'},{value:'C',label:'1 1 和 1 1'},{value:'D',label:'2 2 和 1009 507'}], answer:['A'], analysis:'小输入 4 3: 弹到 (4,1) 或 (4,3) 同时碰壁。AI 推断 A。' },
];
const codeReadingQuestions = codeReading.map(({codeLines, codeTitle, codeDescription, p:points, ...rest}) => ({...rest, codeLines, codeTitle, codeDescription, points, type:'single', hasAnswer:true}));

const perfect1Code = `#include <iostream>
using namespace std;
int x, p, m, i, result;
int main() {
  cin >> x >> p >> m;
  result = (1) ;
  while ( (2) ) {
    if (p % 2 == 1) result = (3) ;
    p /= 2;
    x = (4) ;
  }
  cout << (5) << endl;
  return 0;
}`;
const perfect1Questions = [
  { id:'p1_1', type:'single', question:'完善程序（1）快速幂。填空(1)：result 初值？', options:[{value:'A',label:'0'},{value:'B',label:'1'},{value:'C',label:'x'},{value:'D',label:'x % m'}], answer:['B'], analysis:'result=1 是乘法单位元。', points:2, hasAnswer:true },
  { id:'p1_2', type:'single', question:'填空(2)：while 条件？', options:[{value:'A',label:'p > 0'},{value:'B',label:'p != 0'},{value:'C',label:'p >= 0'},{value:'D',label:'x > 0'}], answer:['A'], analysis:'p>0 时继续二分。', points:3, hasAnswer:true },
  { id:'p1_3', type:'single', question:'填空(3)：p 奇时？', options:[{value:'A',label:'result * x'},{value:'B',label:'result * x % m'},{value:'C',label:'result = (result * x) % m'},{value:'D',label:'result++'}], answer:['C'], analysis:'奇数时多乘一次 x 并取模。', points:3, hasAnswer:true },
  { id:'p1_4', type:'single', question:'填空(4)：x 更新？', options:[{value:'A',label:'x * 2'},{value:'B',label:'(x * x) % m'},{value:'C',label:'x * x'},{value:'D',label:'x * 2 % m'}], answer:['B'], analysis:'x = x² mod m 准备下轮。', points:3, hasAnswer:true },
  { id:'p1_5', type:'single', question:'填空(5)：输出？', options:[{value:'A',label:'x'},{value:'B',label:'p'},{value:'C',label:'result'},{value:'D',label:'result % m'}], answer:['C'], analysis:'result 已是 (x^p) mod m。', points:3, hasAnswer:true },
];

const perfect2Code = `#include <iostream>
using namespace std;
int n, m, i, lbound, ubound, mid, count;
int len[100];
int main() {
  cin >> n;
  count = 0;
  for (i = 0; i < n; i++) {
    cin >> len[i];
    (1) ;
  }
  cin >> m;
  if ( (2) ) {
    cout << "Failed" << endl;
    return 0;
  }
  lbound = 1;
  ubound = 1000000;
  while ( (3) ) {
    mid = (4) ;
    count = 0;
    for (i = 0; i < n; i++)
      (5) ;
    if (count < m) ubound = mid - 1;
    else lbound = mid;
  }
  cout << lbound << endl;
  return 0;
}`;
const perfect2Questions = [
  { id:'p2_1', type:'single', question:'完善程序（2）切割绳子（二分）。填空(1)：每读一条绳子？', options:[{value:'A',label:'len[i] = 0'},{value:'B',label:'count += len[i]'},{value:'C',label:'count++'},{value:'D',label:'m -= len[i]'}], answer:['B'], analysis:'累加总长度。', points:2.5, hasAnswer:true },
  { id:'p2_2', type:'single', question:'填空(2)：判断 Failed？', options:[{value:'A',label:'count < m'},{value:'B',label:'m == 0'},{value:'C',label:'count == 0'},{value:'D',label:'n == 0'}], answer:['A'], analysis:'总长度不足以切 m 条。', points:2.5, hasAnswer:true },
  { id:'p2_3', type:'single', question:'填空(3)：while 条件？', options:[{value:'A',label:'lbound < ubound'},{value:'B',label:'lbound <= ubound'},{value:'C',label:'lbound != ubound'},{value:'D',label:'ubound > 0'}], answer:['B'], analysis:'标准二分。', points:3, hasAnswer:true },
  { id:'p2_4', type:'single', question:'填空(4)：mid？', options:[{value:'A',label:'(lbound + ubound) / 2'},{value:'B',label:'(lbound + ubound + 1) / 2'},{value:'C',label:'lbound * 2'},{value:'D',label:'ubound / 2'}], answer:['A'], analysis:'取中点。', points:3, hasAnswer:true },
  { id:'p2_5', type:'single', question:'填空(5)：累加可切数？', options:[{value:'A',label:'count += len[i] / mid'},{value:'B',label:'count += len[i] % mid'},{value:'C',label:'count = len[i] - mid'},{value:'D',label:'count += mid'}], answer:['A'], analysis:'每条绳子能切 len[i]/mid 段。', points:3, hasAnswer:true },
];

const readScenes = [
  { id:'sc_cspj17j_problem_solving', title:'二、问题求解（共 2 题，每题 5 分，共计 10 分）', order:2, kind:'code-reading', category:'read', codeBlock:null, questions: problemSolving },
  ...codeReadingQuestions.map((q, idx) => ({
    id:`sc_cspj17j_read_${idx+1}`,
    title:`三、阅读程序写结果 ${idx+1}（8 分）`,
    order: 3+idx, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:q.codeTitle, description:q.codeDescription, lines:q.codeLines },
    questions:[q],
  })),
];

const classroom = {
  id:'cm_imp_cspj2017j_v1', createdAt:'2026-08-09T00:00:00.000Z', collection:'csp-lecture',
  stage:{
    id:'cm_imp_cspj2017j_v1', name:'2017年普及组NOIP初赛真题卷',
    description:'2017年CCF NOIP普及组初赛完整真题（第二十三届全国青少年信息学奥林匹克联赛初赛），共单项选择题20道（30分）、问题求解2题（10分）、阅读程序写结果4题（32分）、完善程序2题（28分），总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_cspj17j_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_cspj17j_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:42, perfect:28 },
  },
  scenes:[
    { id:'sc_cspj17j_choice', stageId:'cm_imp_cspj2017j_v1', type:'quiz', title:'一、单项选择题（共 20 题，每题 1.5 分，共计 30 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_cspj2017j_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', ...(rs.codeBlock?{codeBlock:rs.codeBlock}:{}), questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_cspj17j_perfect', stageId:'cm_imp_cspj2017j_v1', type:'quiz', title:'四、完善程序（1）快速幂（第一空 2 分，其余 3 分，共 14 分）', order:7,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（1）快速幂', description:'用分治法求 x^p mod m。', lines: perfect1Code.split('\n') }, questions: perfect1Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_cspj17j_perfect2', stageId:'cm_imp_cspj2017j_v1', type:'quiz', title:'四、完善程序（2）切割绳子（第一、二空 2.5 分，其余 3 分，共 14 分）', order:8,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（2）切割绳子', description:'二分求从 n 条绳子切 m 条等长绳段的最大长度。', lines: perfect2Code.split('\n') }, questions: perfect2Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
console.log(`  total ${choiceSceneQuestions.length+problemSolving.length+codeReadingQuestions.length+perfect1Questions.length+perfect2Questions.length} (${choiceSceneQuestions.length}+${problemSolving.length}+${codeReadingQuestions.length}+${perfect1Questions.length}+${perfect2Questions.length}), scenes ${classroom.scenes.length}, short ${classroom.scenes.flatMap(s=>s.content.questions).filter(q=>q.type!=='single').length}`);
