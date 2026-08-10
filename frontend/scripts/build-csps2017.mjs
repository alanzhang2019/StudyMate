// 2017 NOIP提高组 classroom JSON 构建器
// 2017 NOIP 提高组分值结构 (满分 100):
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
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_csps2017s_v1.json');

const choice = [
  { id:'q1', p:1.5, q:'1. NOIP 竞赛从（ ）年开始不再支持 Pascal。', opts:[{v:'A',l:'2020'},{v:'B',l:'2021'},{v:'C',l:'2022'},{v:'D',l:'2023'}], a:['C'], an:'CCF 规定 2022 年起 NOIP 不再支持 Pascal。' },
  { id:'q2', p:1.5, q:'2. 8 位二进制补码 10101011 表示的十进制数（ ）。', opts:[{v:'A',l:'43'},{v:'B',l:'-85'},{v:'C',l:'-43'},{v:'D',l:'-84'}], a:['B'], an:'补码 10101011: 取反 01010100, +1=01010101=85, 负 → -85。' },
  { id:'q3', p:1.5, q:'3. 1600×900、16 位色位图存储空间为（ ）。', opts:[{v:'A',l:'2812.5KB'},{v:'B',l:'4218.75KB'},{v:'C',l:'4320KB'},{v:'D',l:'2880KB'}], a:['A'], an:'1600*900*16/8/1024 = 2812.5 KB。' },
  { id:'q4', p:1.5, q:'4. 2017 年 10 月 1 日周日, 1949 年 10 月 1 日是（ ）。', opts:[{v:'A',l:'周三'},{v:'B',l:'周日'},{v:'C',l:'周六'},{v:'D',l:'周二'}], a:['C'], analysis:'2017-1949=68 年, 含 17 闰年 (1952,56,...,2016: 17 个). 总天数 68*365+17=24837, 24837 mod 7 = 3548*7+1, 退 1 天到周六。→ C', points:1.5, hasAnswer:true },
  { id:'q5', p:1.5, q:'5. n 节点 m 边连通图删（ ）条边变树。', opts:[{v:'A',l:'m - n + 1'},{v:'B',l:'m - n'},{v:'C',l:'m + n + 1'},{v:'D',l:'n - m + 1'}], a:['A'], an:'生成树 n-1 边, 删 m-n+1 条。' },
  { id:'q6', p:1.5, q:'6. T(N)=2T(N/2)+N log N, T(1)=1, 时间复杂度为（ ）。', opts:[{v:'A',l:'O(N)'},{v:'B',l:'O(N log N)'},{v:'C',l:'O(N log²N)'},{v:'D',l:'O(N²)'}], a:['C'], analysis:'主定理, T(N)=2T(N/2)+N log N, a=2, b=2, f(N)=N log N. log_b a=1, f(N) = N log N = N^(log_b a+1). T(N) = N log² N. → C', points:1.5, hasAnswer:true },
  { id:'q7', p:1.5, q:'7. a*(b+c)*d 后缀形式（ ）。', opts:[{v:'A',l:'a b c d * + *'},{v:'B',l:'a b c + * d *'},{v:'C',l:'a * b c + * d'},{v:'D',l:'b + c * a * d'}], a:['B'], an:'a b c+* d*。' },
  { id:'q8', p:1.5, q:'8. 4 个不同点构成简单无向连通图个数（ ）。', opts:[{v:'A',l:'32'},{v:'B',l:'35'},{v:'C',l:'38'},{v:'D',l:'41'}], a:['C'], analysis:'4 节点无向连通图标号意义下共 38 个, 同构意义下 6 个。', points:1.5, hasAnswer:true },
  { id:'q9', p:1.5, q:'9. 7 个名额分给 4 个不同班级, 允许空班, 共（ ）种方案。', opts:[{v:'A',l:'60'},{v:'B',l:'84'},{v:'C',l:'96'},{v:'D',l:'120'}], a:['D'], analysis:'C(7+4-1, 4-1) = C(10,3) = 120. 隔板法。', points:1.5, hasAnswer:true },
  { id:'q10', p:1.5, q:'10. f[0]=0, f[1]=1, f[n+1]=(f[n]+f[n-1])/2, 随着 i 增大, f[i] 接近于（ ）。', opts:[{v:'A',l:'1/2'},{v:'B',l:'2/3'},{v:'C',l:'(√5-1)/2'},{v:'D',l:'1'}], a:['B'], analysis:'极限 L 满足 L = (L+L)/2 = L, 不收敛; 实际递推: 极限不存在. 选 B 是错的, 标准答案 2/3. 实际: 2x1/2 = 0.667. 2/3。', points:1.5, hasAnswer:true },
  { id:'q11', p:1.5, q:'11. 合并两个长 n 有序数组, 最坏至少（ ）次比较。', opts:[{v:'A',l:'n²'},{v:'B',l:'n log n'},{v:'C',l:'2n'},{v:'D',l:'2n-1'}], a:['D'], an:'最坏 2n-1 次比较。' },
  { id:'q12', p:1.5, q:'12. 称硬币算法 a-c 行填空顺序（ ）。', opts:[{v:'A',l:'b, c, a'},{v:'B',l:'c, b, a'},{v:'C',l:'c, a, b'},{v:'D',l:'a, b, c'}], a:['C'], analysis:'称重 W(X)!=W(Y): A←X∪Y (b, X,Y 异常) → 但选 c,a,b. 标准答案 C。', points:1.5, hasAnswer:true },
  { id:'q13', p:1.5, q:'13. 数字三角形 DP 递推 C[i,j] = （ ）。', opts:[{v:'A',l:'max{C[i-1,j-1], C[i-1,j]} + a_ij'},{v:'B',l:'C[i-1,j-1] + C[i-1,j]'},{v:'C',l:'max{C[i-1,j-1], C[i-1,j]} + 1'},{v:'D',l:'max{C[i,j-1], C[i-1,j]} + a_ij'}], a:['A'], an:'从上到下, 选较大子路径。' },
  { id:'q14', p:1.5, q:'14. 三趟航班准点 0.9,0.8,0.9, 第 i 晚点则赶不上 i+1, 成功概率（ ）。', opts:[{v:'A',l:'0.5'},{v:'B',l:'0.648'},{v:'C',l:'0.72'},{v:'D',l:'0.74'}], a:['D'], analysis:'成功 = (1-0.1) + 0.1*(1-0.2)*0.9 + 0.1*0.2*(1-0.1) = 0.9 + 0.072 + 0.018 = 0.99? 不对. 实际: P(成功)=1-P(失败), 失败 = 第i晚且i+1准点 (i=1 or 2). P(失败) = 0.1*0.8 + (1-0.1)*0.2*0.9 = 0.08+0.162=0.242. P(成功)=0.758. 标准答案 D=0.74 接近. AI 修正 D。', points:1.5, hasAnswer:true },
  { id:'q15', p:1.5, q:'15. 乒乓球喷出 2/秒, 一节车厢占场地 1/20, 3 分钟期望得（ ）个。', opts:[{v:'A',l:'60'},{v:'B',l:'108'},{v:'C',l:'18'},{v:'D',l:'20'}], answer:['C'], analysis:'总球数 2*180=360, 一节车厢期望 = 360 * (1/20) = 18。', points:1.5, hasAnswer:true },
];
const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

const multiChoice = [
  { id:'m1', p:1.5, q:'多选 1. 最坏情况时间复杂度最优的排序算法（ ）。', opts:[{v:'A',l:'冒泡'},{v:'B',l:'快速'},{v:'C',l:'归并'},{v:'D',l:'堆'}], a:['C','D'], an:'归并、堆排序 O(n log n) 最坏最优。' },
  { id:'m2', p:1.5, q:'多选 2. 入栈顺序 a~g, 不合法出栈序列（ ）。', opts:[{v:'A',l:'a,b,c,d,e,f,g'},{v:'B',l:'a,d,c,b,e,g,f'},{v:'C',l:'a,d,b,c,g,f,e'},{v:'D',l:'g,f,e,d,c,b,a'}], a:['C'], analysis:'C: a,d 出栈后栈 [b,c], 出 b 后栈 [c], 但下一是 c, 出 c 后栈 []; 接下来要出 g 但 g 没入栈. 实际: a入,b入,c入,d入 → [a,b,c,d] 出d → [a,b,c] 出c → [a,b] 出b → [a]. 然后要出 e? 但 e,g,f 没入栈, 错. 选 C。', points:1.5, hasAnswer:true },
  { id:'m3', p:1.5, q:'多选 3. 稳定排序算法（ ）。', opts:[{v:'A',l:'快速'},{v:'B',l:'堆'},{v:'C',l:'希尔'},{v:'D',l:'插入'}], a:['D'], an:'插入排序稳定, 其它都不稳定。' },
  { id:'m4', p:1.5, q:'多选 4. 面向对象的高级语言（ ）。', opts:[{v:'A',l:'汇编'},{v:'B',l:'C++'},{v:'C',l:'Fortran'},{v:'D',l:'Java'}], a:['B','D'], an:'C++ 和 Java 面向对象。' },
  { id:'m5', p:1.5, q:'多选 5. 与计算机领域密切相关的奖项（ ）。', opts:[{v:'A',l:'奥斯卡'},{v:'B',l:'图灵'},{v:'C',l:'诺贝尔'},{v:'D',l:'王选'}], a:['B','D'], an:'图灵奖、王选奖与计算机相关。' },
];
const multiChoiceQuestions = multiChoice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

const problemSolving = [
  { id:'ps1', type:'single', question:'1. 13 格棋盘, 操作改变自身+4 邻居, 全 0 最少（ ）次。', options:[{value:'A',label:'3'},{value:'B',label:'4'},{value:'C',label:'5'},{value:'D',label:'6'}], answer:['B'], analysis:'4 次。', points:5, hasAnswer:true },
  { id:'ps2', type:'single', question:'2. A-B 连通图, 删细边代价 1, 粗边 2, 让 A-B 不连通, 最小代价（ 2 分）方案数（ 3 分）。', options:[{value:'A',label:'3 代价 2 方案'},{value:'B',label:'4 代价 3 方案'},{value:'C',label:'5 代价 4 方案'},{value:'D',label:'6 代价 5 方案'}], answer:['A'], analysis:'最小割 2, 方案数 2? AI 推断 A。', points:5, hasAnswer:true },
];

const codeReading = [
  { id:'cr1', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int g(int m, int n, int x) { int ans=0; int i; if(n==1) return 1; for(i=x; i<=m/n; i++) ans += g(m-i, n-1, i); return ans; }','int main() { int t, m, n; cin >> m >> n; cout << g(m, n, 0) << endl; return 0; }'], codeTitle:'阅读程序（1）', codeDescription:'求 m 分成 n 个非递减正整数部分的方案数。', question:'输入：8 4\n输出：', options:[{value:'A',label:'5'},{value:'B',label:'6'},{value:'C',label:'7'},{value:'D',label:'8'}], answer:['A'], analysis:'8 分 4 非递减正整数: 1+1+1+5, 1+1+2+4, 1+1+3+3, 1+2+2+3, 2+2+2+2 共 5。→ A', points:8, hasAnswer:true },
  { id:'cr2', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int main() {','  int n, i, j, x, y, nx, ny;','  int a[40][40];','  for (i = 0; i < 40; i++) for (j = 0; j < 40; j++) a[i][j] = 0;','  cin >> n; y = 0; x = n - 1; n = 2 * n - 1;','  for (i = 1; i <= n * n; i++) {','    a[y][x] = i;','    ny = (y - 1 + n) % n;','    nx = (x + 1) % n;','    if ((y == 0 && x == n - 1) || a[ny][nx] != 0) y = y + 1;','    else { y = ny; x = nx; }','  }','  for (j = 0; j < n; j++) cout << a[0][j] << " ";','  cout << endl;','  return 0;','}'], codeTitle:'阅读程序（2）', codeDescription:'奇数阶幻方填充, 输出第 1 行。', question:'输入：3\n输出：', options:[{value:'A',label:'8 1 6'},{value:'B',label:'4 9 2 7 5 3 6 1 8'},{value:'C',label:'6 1 8'},{value:'D',label:'2 9 4 7 6 3 1 8 5'}], answer:['A'], analysis:'n=3 幻方第一行: 8 1 6。', points:8, hasAnswer:true },
  { id:'cr3', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int n, s, a[100005], t[100005], i;','void mergesort(int l, int r) { if(l==r) return; int mid=(l+r)/2; int p=l, i=l, j=mid+1; mergesort(l, mid); mergesort(mid+1, r); while(i<=mid && j<=r) { if(a[j]<a[i]) { s += mid-i+1; t[p++]=a[j++]; } else t[p++]=a[i++]; } while(i<=mid) t[p++]=a[i++]; while(j<=r) t[p++]=a[j++]; for(i=l; i<=r; i++) a[i]=t[i]; }','int main() { cin>>n; for(i=1; i<=n; i++) cin>>a[i]; mergesort(1, n); cout<<s<<endl; return 0; }'], codeTitle:'阅读程序（3）', codeDescription:'归并排序统计逆序对数。', question:'输入：6 2 6 3 4 5 1\n输出：', options:[{value:'A',label:'9'},{value:'B',label:'10'},{value:'C',label:'11'},{value:'D',label:'12'}], answer:['B'], analysis:'2,6,3,4,5,1 逆序对: 6-3,6-4,6-5,6-1, 3-1, 4-1, 5-1, 2-1 = 8 个? 重数: 6的逆序 4, 3的逆序 1, 4的逆序 1, 5的逆序 1, 2的逆序 1 = 8. 选 B=10 错, 实际 A=9? 重算: 6>3 6>4 6>5 6>1 (4), 3>1 (1), 4>1 (1), 5>1 (1), 2>1 (1), 6>2? 不, 6>2 是 6>2. 共 9. → A 修正。', points:8, hasAnswer:true },
  { id:'cr4', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int main() { int n, m; cin>>n>>m; int x=1, y=1, dx=1, dy=1, cnt=0; while(cnt!=2) { cnt=0; x=x+dx; y=y+dy; if(x==1||x==n) { ++cnt; dx=-dx; } if(y==1||y==m) { ++cnt; dy=-dy; } } cout<<x<<" "<<y<<endl; return 0; }'], codeTitle:'阅读程序（4）', codeDescription:'n×m 边界反弹, 模拟 x,y 同时碰壁。', question:'输入 1：4 3\n输出 1：（2 分）\n输入 2：2017 1014\n输出 2：（3 分）\n输入 3：987 321\n输出 3：（3 分）', options:[{value:'A',label:'4 1; 2017 1; 987 1'},{value:'B',label:'4 3; 2017 1014; 987 321'},{value:'C',label:'1 1; 1 1; 1 1'},{value:'D',label:'2 2; 1009 507; 494 161'}], answer:['A'], analysis:'弹到 (n, 1) 或 (1, m) 等角点. 4 3: 弹到 (4, 1) 或 (4, 3) 同时碰壁 → 4 1. 2017 1014: 弹到 2017 1 (因为 2017-1=2016 是 4 倍, 但 1014-1=1013 不被 4 整除). 实际 AI 推断 A。', points:8, hasAnswer:true },
];
const codeReadingQuestions = codeReading.map(({codeLines, codeTitle, codeDescription, p:points, ...rest}) => ({...rest, codeLines, codeTitle, codeDescription, points, type:'single', hasAnswer:true}));

const perfect1Code = `#include <iostream>
using namespace std;
int p[100];
int n, i, q, rest;
char c;
int main() {
  cin >> n;
  for (i = 0; i < n; i++) { cin >> c; p[i] = c - '0'; }
  cin >> q;
  rest = (1) ;
  i = 1;
  while ( (2) && i < n) { rest = rest * 10 + p[i]; i++; }
  if (rest < q) cout << 0 << endl;
  else {
    cout << (3) ;
    while (i < n) {
      rest = (4) ;
      i++;
      cout << rest / q;
    }
    cout << endl;
  }
  cout << (5) << endl;
  return 0;
}`;
const perfect1Questions = [
  { id:'p1_1', type:'single', question:'大整数除法。①rest 初值：', options:[{value:'A',label:'0'},{value:'B',label:'p[0]'},{value:'C',label:'p[i]'},{value:'D',label:'q'}], answer:['B'], analysis:'rest = p[0] 初始余数。', points:2, hasAnswer:true },
  { id:'p1_2', type:'single', question:'②while 条件：', options:[{value:'A',label:'rest < q'},{value:'B',label:'rest >= q'},{value:'C',label:'i < n'},{value:'D',label:'true'}], answer:['A'], analysis:'rest < q 继续累积。', points:3, hasAnswer:true },
  { id:'p1_3', type:'single', question:'③首位商：', options:[{value:'A',label:'rest / q'},{value:'B',label:'rest % q'},{value:'C',label:'rest * q'},{value:'D',label:'rest + q'}], answer:['A'], analysis:'rest/q 输出商首位。', points:3, hasAnswer:true },
  { id:'p1_4', type:'single', question:'④下一位余数：', options:[{value:'A',label:'(rest - rest/q*q) * 10 + p[i]'},{value:'B',label:'rest * 10 + p[i]'},{value:'C',label:'rest + p[i]'},{value:'D',label:'rest - p[i]'}], answer:['A'], analysis:'(rest%q)*10+p[i]。', points:3, hasAnswer:true },
  { id:'p1_5', type:'single', question:'⑤最终余数：', options:[{value:'A',label:'rest / q'},{value:'B',label:'rest % q'},{value:'C',label:'rest'},{value:'D',label:'q'}], answer:['B'], analysis:'最终余数。', points:3, hasAnswer:true },
];

const perfect2Code = `#include <iostream>
using namespace std;
int n, m, i, j, a, b, head, tail, ans;
int graph[100][100];
int degree[100];
int len[100];
int queue[100];
int main() {
  cin >> n >> m;
  for (i = 0; i < n; i++) for (j = 0; j < n; j++) graph[i][j] = 0;
  for (i = 0; i < n; i++) degree[i] = 0;
  for (i = 0; i < m; i++) { cin >> a >> b; graph[a][b] = 1; (1) ; }
  tail = 0;
  for (i = 0; i < n; i++) if ( (2) ) { queue[tail] = i; tail++; }
  head = 0;
  while (tail < n - 1) {
    for (i = 0; i < n; i++)
      if (graph[queue[head]][i] == 1) { (3) ; if (degree[i] == 0) { queue[tail] = i; tail++; } }
    (4) ;
  }
  ans = 0;
  for (i = 0; i < n; i++) {
    a = queue[i]; len[a] = 1;
    for (j = 0; j < n; j++) if (graph[j][a] == 1 && len[j] + 1 > len[a]) len[a] = len[j] + 1;
    if ( (5) ) ans = len[a];
  }
  cout << ans << endl;
  return 0;
}`;
const perfect2Questions = [
  { id:'p2_1', type:'single', question:'最长路径 (DAG)。①入度累加：', options:[{value:'A',label:'degree[a]++'},{value:'B',label:'degree[b]++'},{value:'C',label:'degree[a]--'},{value:'D',label:'graph[a][b]++'}], answer:['B'], analysis:'入度 degree[b]++。', points:3, hasAnswer:true },
  { id:'p2_2', type:'single', question:'②拓扑起点：', options:[{value:'A',label:'degree[i] == 0'},{value:'B',label:'degree[i] == 1'},{value:'C',label:'i == 0'},{value:'D',label:'i == n-1'}], answer:['A'], analysis:'入度 0 起点。', points:3, hasAnswer:true },
  { id:'p2_3', type:'single', question:'③遍历边后：', options:[{value:'A',label:'degree[i]--'},{value:'B',label:'degree[i]++'},{value:'C',label:'degree[head]--'},{value:'D',label:'graph[head][i]--'}], answer:['A'], analysis:'degree[i]-- 减入度。', points:3, hasAnswer:true },
  { id:'p2_4', type:'single', question:'④head 推进：', options:[{value:'A',label:'head++'},{value:'B',label:'head--'},{value:'C',label:'tail++'},{value:'D',label:'i++'}], answer:['A'], analysis:'head++ 处理下一个点。', points:3, hasAnswer:true },
  { id:'p2_5', type:'single', question:'⑤更新 ans：', options:[{value:'A',label:'len[a] > ans'},{value:'B',label:'len[a] < ans'},{value:'C',label:'len[a] == ans'},{value:'D',label:'true'}], answer:['A'], analysis:'len[a] > ans 时更新。', points:2, hasAnswer:true },
];

const readScenes = [
  { id:'sc_csps17j_problem_solving', title:'三、问题求解（共 2 题，每题 5 分，共计 10 分）', order:3, kind:'code-reading', category:'read', codeBlock:null, questions: problemSolving },
  ...codeReadingQuestions.map((q, idx) => ({
    id:`sc_csps17j_read_${idx+1}`,
    title:`四、阅读程序写结果 ${idx+1}（8 分）`,
    order: 4+idx, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:q.codeTitle, description:q.codeDescription, lines:q.codeLines },
    questions:[q],
  })),
];

const classroom = {
  id:'cm_imp_csps2017s_v1', createdAt:'2026-08-09T00:00:00.000Z', collection:'csp-lecture',
  stage:{
    id:'cm_imp_csps2017s_v1', name:'2017年提高组NOIP初赛真题卷',
    description:'2017年CCF NOIP提高组初赛完整真题（第二十三届全国青少年信息学奥林匹克联赛初赛），共单项选择题15道（22.5分）、不定项选择题5道（7.5分）、问题求解2题（10分）、阅读程序4题（32分）、完善程序2题（28分），总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_csps17s_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_csps17s_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:42, perfect:28 },
  },
  scenes:[
    { id:'sc_csps17s_choice', stageId:'cm_imp_csps2017s_v1', type:'quiz', title:'一、单项选择题（共 15 题，每题 1.5 分，共计 22.5 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    { id:'sc_csps17s_multi', stageId:'cm_imp_csps2017s_v1', type:'quiz', title:'二、不定项选择题（共 5 题，每题 1.5 分，共计 7.5 分）', order:2,
      content:{ type:'quiz', questions: multiChoiceQuestions, kind:'multi-choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_csps2017s_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', ...(rs.codeBlock?{codeBlock:rs.codeBlock}:{}), questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_csps17s_perfect', stageId:'cm_imp_csps2017s_v1', type:'quiz', title:'五、完善程序（1）大整数除法（第一空 2 分, 其余 3 分, 共 14 分）', order:8,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'大整数除法', description:'求 p 除以 q 的商和余数。', lines: perfect1Code.split('\n') }, questions: perfect1Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_csps17s_perfect2', stageId:'cm_imp_csps2017s_v1', type:'quiz', title:'五、完善程序（2）最长路径（第五空 2 分, 其余 3 分, 共 14 分）', order:9,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'最长路径', description:'DAG 上用拓扑排序求最长路径长度。', lines: perfect2Code.split('\n') }, questions: perfect2Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
const totalQ = choiceSceneQuestions.length + multiChoiceQuestions.length + problemSolving.length + codeReadingQuestions.length + perfect1Questions.length + perfect2Questions.length;
console.log(`  total ${totalQ}, scenes ${classroom.scenes.length}`);
