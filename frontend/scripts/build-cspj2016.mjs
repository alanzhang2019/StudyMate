// scripts/build-cspj2016.mjs - 2016 NOIP普及组真题卷
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_cspj2016j_v1.json');

const choice = [
  { id: 'q1', points: 1.5, q: '1. 以下不是微软公司出品的软件是（ ）。', opts: [{v:'A',l:'Powerpoint'},{v:'B',l:'Word'},{v:'C',l:'Excel'},{v:'D',l:'Acrobat Reader'}], a:['D'], an:'Acrobat Reader 是 Adobe 公司产品。' },
  { id: 'q2', points: 1.5, q: '2. 如果 256 种颜色用二进制编码来表示，至少需要（ ）位。', opts: [{v:'A',l:'6'},{v:'B',l:'7'},{v:'C',l:'8'},{v:'D',l:'9'}], a:['C'], an:'2^8=256，至少 8 位。' },
  { id: 'q3', points: 1.5, q: '3. 以下不属于无线通信技术的是（ ）。', opts: [{v:'A',l:'蓝牙'},{v:'B',l:'WiFi'},{v:'C',l:'GPRS'},{v:'D',l:'以太网'}], a:['D'], an:'以太网是有线网络。' },
  { id: 'q4', points: 1.5, q: '4. 以下不是 CPU 生产厂商的是（ ）。', opts: [{v:'A',l:'Intel'},{v:'B',l:'AMD'},{v:'C',l:'Microsoft'},{v:'D',l:'IBM'}], a:['C'], an:'Microsoft 是软件公司，不生产 CPU。' },
  { id: 'q5', points: 1.5, q: '5. 以下不是存储设备的是（ ）。', opts: [{v:'A',l:'光盘'},{v:'B',l:'磁盘'},{v:'C',l:'固态硬盘'},{v:'D',l:'鼠标'}], a:['D'], an:'鼠标是输入设备。' },
  { id: 'q6', points: 1.5, q: '6. 小老鼠按 CapsLock、A、S、D 循环按键（初始小写），第 81 个输出字符是（ ）。', opts: [{v:'A',l:'A'},{v:'B',l:'S'},{v:'C',l:'D'},{v:'D',l:'a'}], a:['D'], an:'81 个键中含 21 个 CapsLock（不输出），输出 60 个字母。60 mod 6=0，第 60 个字符是 d（小写）。' },
  { id: 'q7', points: 1.5, q: '7. 二进制数 00101100 和 00010101 的和是（ ）。', opts: [{v:'A',l:'00101000'},{v:'B',l:'01000001'},{v:'C',l:'01000100'},{v:'D',l:'00111000'}], a:['B'], an:'44 + 21 = 65 = 0b01000001。' },
  { id: 'q8', points: 1.5, q: '8. 与二进制小数 0.1 相等的八进制数是（ ）。', opts: [{v:'A',l:'0.8'},{v:'B',l:'0.4'},{v:'C',l:'0.2'},{v:'D',l:'0.1'}], a:['B'], an:'0.1₂ = 1/2 = 4/8 = 0.4₈。' },
  { id: 'q9', points: 1.5, q: '9. 以下是 32 位机器和 64 位机器的区别的是（ ）。', opts: [{v:'A',l:'显示器不同'},{v:'B',l:'硬盘大小不同'},{v:'C',l:'寻址空间不同'},{v:'D',l:'输入法不同'}], a:['C'], an:'64 位机器寻址空间 2^64，远大于 32 位。' },
  { id: 'q10', points: 1.5, q: '10. 以下关于字符串的判定语句中正确的是（ ）。', opts: [{v:'A',l:'字符串是一种特殊的线性表'},{v:'B',l:'串的长度必须大于零'},{v:'C',l:'字符串不可以用数组来表示'},{v:'D',l:'空格字符组成的串就是空串'}], a:['A'], an:'字符串是特殊的线性表（字符序列），长度可为零，可用数组存储，空格串≠空串。' },
  { id: 'q11', points: 1.5, q: '11. 一棵二叉树用顺序存储，根节点下标 1，结点 i 左孩子 2i、右孩子 2i+1。则图中所有节点最大下标为（ ）。', opts: [{v:'A',l:'6'},{v:'B',l:'10'},{v:'C',l:'12'},{v:'D',l:'15'}], a:['D'], an:'完全二叉树 4 层最多 15 个节点。' },
  { id: 'q12', points: 1.5, q: '12. 程序段 s=a; for(b=1;b<=c;b++) s=s+1; 等价的赋值语句是（ ）。', opts: [{v:'A',l:'s = a + b'},{v:'B',l:'s = a + c'},{v:'C',l:'s = s + c'},{v:'D',l:'s = b + c'}], a:['B'], an:'循环 c 次，s 加 c，等价 s = a + c。' },
  { id: 'q13', points: 1.5, q: '13. 程序运行后输出（ ）。\nk=4,n=0; while(n<k){n++; if(n%3!=0) continue; k--; } cout << k << "," << n;', opts: [{v:'A',l:'2,2'},{v:'B',l:'2,3'},{v:'C',l:'3,2'},{v:'D',l:'3,3'}], a:['D'], an:'n=1,2 跳过；n=3 整除 3, k=3；n=3<k=3 假, 退出。输出 3,3。' },
  { id: 'q14', points: 1.5, q: '14. 单峰数组二分查找峰顶。代码填空顺序是（ ）。\na. Search(k+1, n)  b. Search(1, k-1)  c. return L[k]', opts: [{v:'A',l:'c, a, b'},{v:'B',l:'c, b, a'},{v:'C',l:'a, b, c'},{v:'D',l:'b, a, c'}], a:['A'], an:'峰顶 c；上升中 a；下降中 b。' },
  { id: 'q15', points: 1.5, q: '15. 简单无向图 G 有 16 条边且每个顶点度数都是 2，则 G 有（ ）个顶点。', opts: [{v:'A',l:'10'},{v:'B',l:'12'},{v:'C',l:'8'},{v:'D',l:'16'}], a:['D'], an:'顶点数 = 2×边数/2 = 16，每个顶点度 2，构成 16 个孤立环。' },
  { id: 'q16', points: 1.5, q: '16. 7 个一样的苹果，放到 3 个一样的盘子中，一共有（ ）种放法。', opts: [{v:'A',l:'7'},{v:'B',l:'8'},{v:'C',l:'21'},{v:'D',l:'37'}], a:['B'], an:'整数拆分 p(7,3)=8。' },
  { id: 'q17', points: 1.5, q: '17. 果园灌溉系统（如图），让果树浇上水的阀门设置是（ ）。', opts: [{v:'A',l:'B 打开'},{v:'B',l:'AB 都打开'},{v:'C',l:'A 打开'},{v:'D',l:'D 打开'}], a:['A'], an:'阀门 B 单独打开即可。' },
  { id: 'q18', points: 1.5, q: '18. Lucia 想分享照片给朋友但不想让 Jacob 看到，可分享给（ ）。', opts: [{v:'A',l:'Dana, Michael, Eve'},{v:'B',l:'Dana, Eve, Monica'},{v:'C',l:'Michael, Eve, Jacob'},{v:'D',l:'Michael, Peter, Monica'}], a:['A'], an:'所选朋友都不能直接或间接连接到 Jacob。' },
  { id: 'q19', points: 1.5, q: '19. 三道菜每道 30 分钟（洗切炒各 10 分钟），做三道菜最短时间（ ）分钟。', opts: [{v:'A',l:'90'},{v:'B',l:'60'},{v:'C',l:'50'},{v:'D',l:'40'}], a:['C'], an:'流水线作业 50 分钟。' },
  { id: 'q20', points: 1.5, q: '20. 参加 NOI 比赛，以下不能带入考场的是（ ）。', opts: [{v:'A',l:'钢笔'},{v:'B',l:'适量的衣服'},{v:'C',l:'U 盘'},{v:'D',l:'铅笔'}], a:['C'], an:'NOI 禁止带 U 盘等电子设备。' },
];

const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, points, id}) => ({id, type:'single', question, options: options.map(({v, l}) => ({value:v, label:l})), answer, analysis, points, hasAnswer: true}));

const problemSolvingQuestions = [
  { id:'ps1', type:'single', question:'1. 从 4×4 棋盘（不可旋转）选 2 个不在同行也不在同列的方格，共_________种方法。', options:[{value:'A',label:'12'},{value:'B',label:'24'},{value:'C',label:'30'},{value:'D',label:'36'}], answer:['D'], analysis:'C(4,2) × C(4,2) = 6×6 = 36。', points:5, hasAnswer:true },
  { id:'ps2', type:'single', question:'2. 二叉树根节点高度为 1。2016 节点二叉树最少有_________个叶子；最小高度是_________。', options:[{value:'A',label:'1 个叶子, 高度 10'},{value:'B',label:'1 个叶子, 高度 11'},{value:'C',label:'2 个叶子, 高度 10'},{value:'D',label:'2 个叶子, 高度 11'}], answer:['B'], analysis:'链状最少 1 个叶子；满二叉树 2^11-1=2047 ≥ 2016 ≥ 2^10=1024, 最小高度 11。', points:5, hasAnswer:true },
];

const codeReading = [
  { id:'cr1', type:'single', points:8, codeLines:['#include <iostream>','using namespace std;','int main() {','  int max, min, sum, count = 0;','  int tmp;','  cin >> tmp;','  if (tmp == 0) return 0;','  max = min = sum = tmp;','  count++;','  while (tmp != 0) {','    cin >> tmp;','    if (tmp != 0) {','      sum += tmp;','      count++;','      if (tmp > max) max = tmp;','      if (tmp < min) min = tmp;','    }','  }','  cout << max << "," << min << "," << sum / count << endl;','  return 0;','}'], codeTitle:'阅读程序（1）', codeDescription:'读入一串整数（0 结束），输出 max, min, avg。', question:'输入：1 2 3 4 5 6 0 7\n输出：', options:[{value:'A',label:'6,1,3'},{value:'B',label:'6,1,3.5'},{value:'C',label:'7,1,3.5'},{value:'D',label:'6,1,4'}], answer:['B'], analysis:'1-6 的 max=6, min=1, sum=21, count=6, avg=3.5。7 在 0 之后被忽略。' },
  { id:'cr2', type:'single', points:8, codeLines:['#include <iostream>','using namespace std;','int main() {','  int i = 100, x = 0, y = 0;','  while (i > 0) {','    i--;','    x = i % 8;','    if (x == 1) y++;','  }','  cout << y << endl;','  return 0;','}'], codeTitle:'阅读程序（2）', codeDescription:'统计 1~99 中 mod 8 == 1 的整数个数。', question:'输出：', options:[{value:'A',label:'11'},{value:'B',label:'12'},{value:'C',label:'13'},{value:'D',label:'14'}], answer:['C'], analysis:'i=1,9,17,25,33,41,49,57,65,73,81,89,97 共 13 个（i=99 时 99%8=3 不计）。' },
  { id:'cr3', type:'single', points:8, codeLines:['#include <iostream>','using namespace std;','int main() {','  int a[6] = {1, 2, 3, 4, 5, 6};','  int pi = 0; int pj = 5;','  int t, i;','  while (pi < pj) {','    t = a[pi]; a[pi] = a[pj]; a[pj] = t;','    pi++; pj--;','  }','  for (i = 0; i < 6; i++) cout << a[i] << ",";','  cout << endl;','  return 0;','}'], codeTitle:'阅读程序（3）', codeDescription:'将数组前后对应位置交换（反序）。', question:'输出：', options:[{value:'A',label:'1,2,3,4,5,6,'},{value:'B',label:'6,5,4,3,2,1,'},{value:'C',label:'6,5,4,5,6,1,'},{value:'D',label:'4,3,2,1,2,3,'}], answer:['B'], analysis:'完全反序输出 6,5,4,3,2,1,' },
  { id:'cr4', type:'single', points:8, codeLines:['#include <iostream>','#include <string>','using namespace std;','int main() {','  int i, length1, length2;','  string s1, s2;','  s1 = "I have a dream.";','  s2 = "I Have A Dream.";','  length1 = s1.size(); length2 = s2.size();','  for (i = 0; i < length1; i++)','    if (s1[i] >= \'a\' && s1[i] <= \'z\') s1[i] -= \'a\' - \'A\';','  for (i = 0; i < length2; i++)','    if (s2[i] >= \'a\' && s2[i] <= \'z\') s2[i] -= \'a\' - \'A\';','  if (s1 == s2) cout << "=" << endl;','  else if (s1 > s2) cout << ">" << endl;','  else cout << "<" << endl;','  return 0;','}'], codeTitle:'阅读程序（4）', codeDescription:'两个字符串都转大写后比较大小。', question:'输出：', options:[{value:'A',label:'='},{value:'B',label:'>'},{value:'C',label:'<'},{value:'D',label:'程序错误'}], answer:['A'], analysis:'都转为 "I HAVE A DREAM." 完全相等，输出 =。' },
];

const codeReadingQuestions = codeReading.map(({codeLines, codeTitle, codeDescription, ...rest}) => ({...rest, codeLines, codeTitle, codeDescription}));

const perfect1Code = `#include <iostream>
using namespace std;
int readint() {
  int num = 0;
  int negative = 0;
  char c;
  c = cin.get();
  while ((c < '0' || c > '9') && c != '-')
    c = (1) ;
  if (c == '-') negative = 1;
  else (2) ;
  c = cin.get();
  while ( (3) ) {
    (4) ;
    c = cin.get();
  }
  if (negative == 1) (5) ;
  return num;
}
int main() {
  int a, b;
  a = readint();
  b = readint();
  cout << a << endl << b << endl;
  return 0;
}`;
const perfect1Questions = [
  { id:'p1_1', type:'single', question:'完善程序（1）读入整数。填空(1)：跳过非数字字符的语句？', options:[{value:'A',label:'cin.get()'},{value:'B',label:'cin >> c'},{value:'C',label:'cin.getline(c, 1)'},{value:'D',label:'c = cin.peek()'}], answer:['A'], analysis:'cin.get() 读下一个字符。', points:2.5, hasAnswer:true },
  { id:'p1_2', type:'single', question:'填空(2)：else 分支？', options:[{value:'A',label:'num = c'},{value:'B',label:'num = c - \'0\''},{value:'C',label:'num = c + \'0\''},{value:'D',label:'num++'}], answer:['B'], analysis:'当前字符已是数字字符, num 初始化为 c - \'0\'。', points:3, hasAnswer:true },
  { id:'p1_3', type:'single', question:'填空(3)：while 循环条件？', options:[{value:'A',label:'c != \'-\''},{value:'B',label:'c >= \'0\' && c <= \'9\''},{value:'C',label:'c != EOF'},{value:'D',label:'!negative'}], answer:['B'], analysis:'读后续数字字符。', points:3, hasAnswer:true },
  { id:'p1_4', type:'single', question:'填空(4)：循环体？', options:[{value:'A',label:'num = c'},{value:'B',label:'num = num * 10 + (c - \'0\')'},{value:'C',label:'num++'},{value:'D',label:'num = num + c'}], answer:['B'], analysis:'累加每位数字。', points:3, hasAnswer:true },
  { id:'p1_5', type:'single', question:'填空(5)：负数处理？', options:[{value:'A',label:'num = -num'},{value:'B',label:'num = num - 1'},{value:'C',label:'negative = -1'},{value:'D',label:'num = num * -1'}], answer:['A'], analysis:'取负号。', points:2.5, hasAnswer:true },
];

const perfect2Code = `#include <iostream>
using namespace std;
#define MAXN 1000000
int n, B, A, M[MAXN], C[MAXN], l, r, ans, mid;
bool check(int nn) {
  int count = 0, i, j;
  i = (1) ;
  j = 1;
  while (i <= n) {
    if ( (2) ) {
      count += C[j] - M[i];
      i++; j++;
    }
  }
  return (3) ;
}
void sort(int a[], int l, int r) { ... }
int main() {
  int i;
  cin >> n >> B >> A;
  for (i = 1; i <= n; i++) cin >> M[i];
  for (i = 1; i <= B; i++) cin >> C[i];
  sort(M, 1, n); sort(C, 1, B);
  l = 0; r = n;
  while (l <= r) {
    mid = (l + r) / 2;
    if ( (4) ) { ans = mid; l = mid + 1; }
    else r = (5) ;
  }
  cout << ans << endl;
  return 0;
}`;
const perfect2Questions = [
  { id:'p2_1', type:'single', question:'完善程序（2）郊游活动（二分）。填空(1)：i 初始化？', options:[{value:'A',label:'0'},{value:'B',label:'1'},{value:'C',label:'n'},{value:'D',label:'nn'}], answer:['B'], analysis:'i 从 1 开始（数组下标）。', points:3, hasAnswer:true },
  { id:'p2_2', type:'single', question:'填空(2)：判断是否够钱租？', options:[{value:'A',label:'M[i] + A / nn >= C[j]'},{value:'B',label:'M[i] >= C[j]'},{value:'C',label:'A >= C[j]'},{value:'D',label:'M[i] + C[j] <= A'}], answer:['A'], analysis:'用 nn 共享学校经费 nn 元, 学生自带的 M[i] 加共享 nn 元够租金 C[j] 即租。', points:3, hasAnswer:true },
  { id:'p2_3', type:'single', question:'填空(3)：返回值？', options:[{value:'A',label:'count > 0'},{value:'B',label:'count <= A'},{value:'C',label:'i > n'},{value:'D',label:'true'}], answer:['B'], analysis:'总花费 count 不超过学校经费 A。', points:3, hasAnswer:true },
  { id:'p2_4', type:'single', question:'填空(4)：mid 合法？', options:[{value:'A',label:'check(mid)'},{value:'B',label:'check(mid) == true'},{value:'C',label:'mid <= A'},{value:'D',label:'B >= mid'}], answer:['A'], analysis:'check(mid) 判断 mid 个人能否租到。', points:2.5, hasAnswer:true },
  { id:'p2_5', type:'single', question:'填空(5)：r 更新？', options:[{value:'A',label:'mid'},{value:'B',label:'mid - 1'},{value:'C',label:'mid + 1'},{value:'D',label:'l'}], answer:['B'], analysis:'r 收缩到 mid-1。', points:2.5, hasAnswer:true },
];

// scenes
const readScenes = [
  { id:'sc_cspj16j_problem_solving', title:'二、问题求解（共 2 题，每题 5 分，共计 10 分）', order:2, kind:'code-reading', category:'read', codeBlock:null, questions: problemSolvingQuestions },
  ...codeReadingQuestions.map((q, idx) => ({
    id:`sc_cspj16j_read_${idx+1}`,
    title:`三、阅读程序写结果 ${idx+1}（8 分）`,
    order: 3+idx, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:q.codeTitle, description:q.codeDescription, lines:q.codeLines },
    questions:[q],
  })),
];

const classroom = {
  id:'cm_imp_cspj2016j_v1',
  createdAt:'2026-08-09T00:00:00.000Z',
  collection:'csp-lecture',
  stage:{
    id:'cm_imp_cspj2016j_v1',
    name:'2016年普及组NOIP初赛真题卷',
    description:'2016年CCF NOIP普及组初赛完整真题（第二十二届全国青少年信息学奥林匹克联赛初赛），共单项选择题20道（30分）、问题求解2题（10分）、阅读程序写结果4题（32分）、完善程序2题（28分），总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_cspj16j_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_cspj16j_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:42, perfect:28 },
  },
  scenes:[
    { id:'sc_cspj16j_choice', stageId:'cm_imp_cspj2016j_v1', type:'quiz', title:'一、单项选择题（共 20 题，每题 1.5 分，共计 30 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_cspj2016j_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', ...(rs.codeBlock?{codeBlock:rs.codeBlock}:{}), questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_cspj16j_perfect', stageId:'cm_imp_cspj2016j_v1', type:'quiz', title:'四、完善程序（1）读入整数（第一、五空 2.5 分，其余 3 分，共 14 分）', order:7,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（1）读入整数', description:'读入两个 int 范围内的整数并输出。', lines: perfect1Code.split('\n') }, questions: perfect1Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_cspj16j_perfect2', stageId:'cm_imp_cspj2016j_v1', type:'quiz', title:'四、完善程序（2）郊游活动（第四、五空 2.5 分，其余 3 分，共 14 分）', order:8,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（2）郊游活动', description:'n 名同学郊游, 二分求最多能租到自行车的人数。', lines: perfect2Code.split('\n') }, questions: perfect2Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
console.log(`  choice ${choiceSceneQuestions.length}, ps ${problemSolvingQuestions.length}, read ${codeReadingQuestions.length}, p1 ${perfect1Questions.length}, p2 ${perfect2Questions.length}`);
console.log(`  scenes ${classroom.scenes.length}, short ${classroom.scenes.flatMap(s=>s.content.questions).filter(q=>q.type!=='single').length}`);
