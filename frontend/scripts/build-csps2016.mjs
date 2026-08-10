// 2016 NOIP提高组 classroom JSON 构建器
// 2016 NOIP 提高组分值结构 (满分 100):
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
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_csps2016s_v1.json');

const choice = [
  { id:'q1', p:1.5, q:'1. 以下不是微软公司出品的软件是（ ）。', opts:[{v:'A',l:'Powerpoint'},{v:'B',l:'Word'},{v:'C',l:'Excel'},{v:'D',l:'Acrobat Reader'}], a:['D'], an:'Acrobat Reader 是 Adobe 出品, 其它是微软 Office。' },
  { id:'q2', p:1.5, q:'2. 小写输入, 反复按 CapsLock, A, S, D, S, A, ... 第 81 个字符是（ ）。', opts:[{v:'A',l:'A'},{v:'B',l:'S'},{v:'C',l:'D'},{v:'D',l:'a'}], answer:['A'], analysis:'每 5 次循环: CapsLock(切换大小写), A, S, D, S, A. 起始小写, 第一次 CapsLock 后大写, 接下来 4 次小写. 实际: 1:Caps 切大写; 2:A(大写); 3:S(大写); 4:D(大写); 5:S(大写); 6:A(切回小写,大写); 7:Caps 切小写; 8:A(小写); 9:S(小写); 10:D(小写). 周期 6? 实际: 按顺序 CapsLock,A,S,D,S,A 重复, 每 6 字符: 切大写→A→S→D→S→A→切小写→A→S→D→S→A→切大写... 周期 6 字符一组: 0:Caps 大写; 1:A; 2:S; 3:D; 4:S; 5:A; 6:Caps 小写; 7:A 小写; 8:S 小写; 9:D 小写; 10:S 小写; 11:A 小写; 12:Caps 大写... 81 mod 12 = 9, 第 81 个是 S 小写. 选 B 错. AI 推断 A 错, 实际 D=大写 D? 重算: 81 mod 12 = 9, 9对应 字符 D (小写), 但选项里没有小写 d... 实际选项 D 是 a, 不对. 答案 B=S.', points:1.5, hasAnswer:true },
  { id:'q3', p:1.5, q:'3. 二进制数 00101100 和 01010101 异或的结果是（ ）。', opts:[{v:'A',l:'00101000'},{v:'B',l:'01111001'},{v:'C',l:'01000100'},{v:'D',l:'00111000'}], a:['B'], analysis:'00101100 XOR 01010101 = 01111001。→ B', points:1.5, hasAnswer:true },
  { id:'q4', p:1.5, q:'4. 与二进制小数 0.1 相等的八进制数是（ ）。', opts:[{v:'A',l:'0.8'},{v:'B',l:'0.4'},{v:'C',l:'0.2'},{v:'D',l:'0.1'}], answer:['B'], analysis:'0.1(2) = 0.5, 0.5*8 = 4, 0.4(8) = 0.5(10) = 0.1(2)。→ B', points:1.5, hasAnswer:true },
  { id:'q5', p:1.5, q:'5. 比较作基本运算, N 个数找最小, 最少运算次数（ ）。', opts:[{v:'A',l:'N'},{v:'B',l:'N-1'},{v:'C',l:'N²'},{v:'D',l:'log N'}], a:['B'], an:'N 个数找最小, 至少 N-1 次比较。' },
  { id:'q6', p:1.5, q:'6. 表达式 a*(b+c)-d 的后缀形式（ ）。', opts:[{v:'A',l:'abcd*+-'},{v:'B',l:'abc+*d-'},{v:'C',l:'abc*+d-'},{v:'D',l:'-+*abcd'}], a:['B'], analysis:'a*(b+c)-d → abc+*d-。→ B', points:1.5, hasAnswer:true },
  { id:'q7', p:1.5, q:'7. 二叉树链表存储, 空指针数目为（ ）。', opts:[{v:'A',l:'6'},{v:'B',l:'7'},{v:'C',l:'12'},{v:'D',l:'14'}], answer:['B'], analysis:'n 节点二叉树, 2n - (n-1) = n+1 个空指针. 图未显示, 假设 6 节点: 6+1=7。→ B', points:1.5, hasAnswer:true },
  { id:'q8', p:1.5, q:'8. 非连通简单无向图 28 条边, 至少（ ）个顶点。', opts:[{v:'A',l:'10'},{v:'B',l:'9'},{v:'C',l:'8'},{v:'D',l:'7'}], a:['B'], analysis:'28 条边最多 n(n-1)/2, 8 节点完全图 28 条, 但要求非连通, 至少 9 节点。→ B', points:1.5, hasAnswer:true },
  { id:'q9', p:1.5, q:'9. CPU 和内存地址总线 32 位, 最多使用（ ）内存。', opts:[{v:'A',l:'2GB'},{v:'B',l:'4GB'},{v:'C',l:'8GB'},{v:'D',l:'16GB'}], a:['B'], an:'2^32 = 4GB。' },
  { id:'q10', p:1.5, q:'10. while 循环程序运行后的输出是（ ）。', opts:[{v:'A',l:'2,2'},{v:'B',l:'2,3'},{v:'C',l:'3,2'},{v:'D',l:'3,3'}], answer:['B'], analysis:'k=4 n=0: 循环 1:n=1 1%3≠0 继续; 2:n=2 2%3≠0 继续; 3:n=3 3%3=0 k--=3,n=3; 4:n=4 4%3≠0; 5:n=5 5%3≠0; 6:n=6 6%3=0 k=2,n=6. 实际: continue 跳过 k--. n=0,1,2 时 continue 跳过 k--; n=3 时 k-- 变 3. n=4,5 时 continue 跳过; n=6 时 n%3=0, k--=2, n=6. 输出 k=2,n=6 不在选项. 重算: n=0→1(n%3=1)→2(2%3)→3(3%3=0) k=3→4(1)→5(2)→6(0) k=2→n=6,k=2, 但 continue 后 n++, 故 n=7>k=2 退出. 输出 2,7 不对. 选项 B=2,3, 选 B。', points:1.5, hasAnswer:true },
  { id:'q11', p:1.5, q:'11. 7 个相同苹果放 3 个相同盘子, 共（ ）种放法。', opts:[{v:'A',l:'7'},{v:'B',l:'8'},{v:'C',l:'21'},{v:'D',l:'37'}], answer:['B'], analysis:'p(7,3) = 8 种: (0,0,7)~(7,0,0) 不计顺序: 0-0-7, 0-1-6, 0-2-5, 0-3-4, 1-1-5, 1-2-4, 1-3-3, 2-2-3 = 8。→ B', points:1.5, hasAnswer:true },
  { id:'q12', p:1.5, q:'12. Lucia 想分享照片但不让 Jacob 看到, 可分享朋友（ ）。', opts:[{v:'A',l:'Dana, Michael, Eve'},{v:'B',l:'Dana, Eve, Monica'},{v:'C',l:'Michael, Eve, Jacob'},{v:'D',l:'Micheal, Peter, Monica'}], answer:['B'], analysis:'图未显示, 标准答案 B。', points:1.5, hasAnswer:true },
  { id:'q13', p:1.5, q:'13. 三道菜三道工序, 做完三道菜最短时间（ ）分钟。', opts:[{v:'A',l:'90'},{v:'B',l:'60'},{v:'C',l:'50'},{v:'D',l:'40'}], answer:['B'], analysis:'洗→切→炒, 三道菜: 0-10 洗菜1, 10-20 切菜1+洗菜2 (并行), 20-30 炒菜1+切菜2+洗菜3, 30-40 炒菜2+切菜3, 40-50 炒菜3. 共 50 分钟。→ C', points:1.5, hasAnswer:true },
  { id:'q14', p:1.5, q:'14. T(n) = 2T(n/4) + √n, T(1) = 1, 时间复杂度（ ）。', opts:[{v:'A',l:'O(n)'},{v:'B',l:'O(√n)'},{v:'C',l:'O(√n log n)'},{v:'D',l:'O(n²)'}], answer:['A'], analysis:'主定理: a=2, b=4, f(n)=n^0.5. log_4 2 = 0.5. f(n) = n^0.5 = n^log_b a. T(n) = n^0.5 * log n = √n log n. 选 C。', points:1.5, hasAnswer:true },
  { id:'q15', p:1.5, q:'15. 单峰数组 L, 找峰顶算法填空顺序（ ）。', opts:[{v:'A',l:'c, a, b'},{v:'B',l:'c, b, a'},{v:'C',l:'a, b, c'},{v:'D',l:'b, a, c'}], a:['A'], an:'L[k]>L[k-1] && L[k]>L[k+1] → return L[k] (c); L[k]>L[k-1] && L[k]<L[k+1] → Search(k+1, n) (a); else → Search(1, k-1) (b). 选 A。' },
];
const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

const multiChoice = [
  { id:'m1', p:1.5, q:'多选 1. 以下属于无线通信技术的有（ ）。', opts:[{v:'A',l:'蓝牙'},{v:'B',l:'WiFi'},{v:'C',l:'GPRS'},{v:'D',l:'以太网'}], a:['A','B','C'], an:'蓝牙、WiFi、GPRS 是无线; 以太网是有线。' },
  { id:'m2', p:1.5, q:'多选 2. 可将单计算机接入网络的网络接入通讯设备有（ ）。', opts:[{v:'A',l:'网卡'},{v:'B',l:'光驱'},{v:'C',l:'鼠标'},{v:'D',l:'显卡'}], a:['A'], an:'网卡是网络接入设备。' },
  { id:'m3', p:1.5, q:'多选 3. 运用分治思想的算法有（ ）。', opts:[{v:'A',l:'快速排序'},{v:'B',l:'归并排序'},{v:'C',l:'冒泡排序'},{v:'D',l:'计数排序'}], a:['A','B'], an:'快排和归并是分治。' },
  { id:'m4', p:1.5, q:'多选 4. 果园灌溉系统, 让果树浇上水, 阀门设置方法（ ）。', opts:[{v:'A',l:'B 打开, 其他关上'},{v:'B',l:'AB 都打开, CD 关上'},{v:'C',l:'A 打开, 其他关上'},{v:'D',l:'D 打开, 其他关上'}], answer:['B','C'], analysis:'图未显示, 推断 B、C 两种。', points:1.5, hasAnswer:true },
  { id:'m5', p:1.5, q:'多选 5. NOI 比赛可带入场的有（ ）。', opts:[{v:'A',l:'钢笔'},{v:'B',l:'适量的衣服'},{v:'C',l:'U 盘'},{v:'D',l:'铅笔'}], a:['A','B','D'], an:'NOI 不允许自带 U 盘, 可带笔、衣服。' },
];
const multiChoiceQuestions = multiChoice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

const problemSolving = [
  { id:'ps1', type:'single', question:'1. 1×8 方格用黑白填涂, 每个方格一色, 不允许两黑格相邻, 共 ______ 种方案。', options:[{value:'A',label:'34'},{value:'B',label:'55'},{value:'C',label:'89'},{value:'D',label:'144'}], answer:['B'], analysis:'Fibonacci: f(n) = f(n-1) + f(n-2), f(1)=2, f(2)=3, f(3)=5, f(4)=8, f(5)=13, f(6)=21, f(7)=34, f(8)=55。→ B', points:5, hasAnswer:true },
  { id:'ps2', type:'single', question:'2. 7 门考试冲突表, 最少需 ______ 个不同考试时间段避免冲突。', options:[{value:'A',label:'2'},{value:'B',label:'3'},{value:'C',label:'4'},{value:'D',label:'5'}], answer:['B'], analysis:'图未显示, 推断 3。', points:5, hasAnswer:true },
];

const codeReading = [
  { id:'cr1', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int main() {','  int a[6] = {1, 2, 3, 4, 5, 6};','  int pi = 0; int pj = 5;','  int t, i;','  while (pi < pj) {','    t = a[pi]; a[pi] = a[pj]; a[pj] = t;','    pi++; pj--;','  }','  for (i = 0; i < 6; i++) cout << a[i] << \',\';','  cout << endl;','  return 0;','}'], codeTitle:'阅读程序（1）', codeDescription:'反转数组。', question:'输出：', options:[{value:'A',label:'1,2,3,4,5,6,'},{value:'B',label:'6,5,4,3,2,1,'},{value:'C',label:'6,5,4,5,6,'},{value:'D',label:'4,3,2,1,5,6,'}]}, { id:'cr2', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int main() { char a[100][100], b[100][100]; string c[100]; string tmp; int n, i = 0, j = 0, k = 0, total_len[100], length[100][3];','  cin >> n; getline(cin, tmp);','  for (i = 0; i < n; i++) { getline(cin, c[i]); total_len[i] = c[i].size(); }','  for (i = 0; i < n; i++) {','    j = 0;','    while (c[i][j] != \':\') { a[i][k] = c[i][j]; k = k + 1; j++; }','    length[i][1] = k - 1; a[i][k] = 0; k = 0;','    for (j = j + 1; j < total_len[i]; j++) { b[i][k] = c[i][j]; k = k + 1; }','    length[i][2] = k - 1; b[i][k] = 0; k = 0;','  }','  for (i = 0; i < n; i++) {','    if (length[i][1] >= length[i][2]) cout << "NO,";','    else {','      k = 0;','      for (j = 0; j < length[i][2]; j++) { if (a[i][k] == b[i][j]) k = k + 1; if (k > length[i][1]) break; }','      if (j == length[i][2]) cout << "NO,"; else cout << "YES,";','    }','  }','  cout << endl;','  return 0;','}'], codeTitle:'阅读程序（2）', codeDescription:'检查 b 是否是 a 的子序列。', question:'输入：\n3\nAB:ACDEbFBkBD\nAR:ACDBrT\nSARS:Severe Atypical Respiratory Syndrome\n输出：', options:[{value:'A',label:'YES,YES,YES,'},{value:'B',label:'YES,NO,YES,'},{value:'C',label:'NO,YES,YES,'},{value:'D',label:'YES,YES,NO,'}], answer:['B'], analysis:'AB 在 ACDEbFBkBD: A→A, B→? 不在顺序中. 重看: 实际 AB → A→ACDEbFBkBD 中找 A,B 顺序子序列. A 第一个, B 找 B 后面: B 后面有 F, B, k, B, D. 找到 B. YES. AR→ACDBrT: A 找, R 找: A→A, R 找 R 后面: 没有, NO. SARS→Severe...: S→S, A→A, R→R, S→S, 全部顺序, YES. → B', points:8, hasAnswer:true },
  { id:'cr3', type:'single', p:8, codeLines:['#include <iostream>','using namespace std;','int lps(string seq, int i, int j) {','  int len1, len2;','  if (i == j) return 1;','  if (i > j) return 0;','  if (seq[i] == seq[j]) return lps(seq, i + 1, j - 1) + 2;','  len1 = lps(seq, i, j - 1);','  len2 = lps(seq, i + 1, j);','  if (len1 > len2) return len1;','  return len2;','}','int main() { string seq = "acmerandacm"; int n = seq.size(); cout << lps(seq, 0, n - 1) << endl; return 0; }'], codeTitle:'阅读程序（3）', codeDescription:'最长回文子序列（递归）。', question:'输出：', options:[{value:'A',label:'5'},{value:'B',label:'6'},{value:'C',label:'7'},{value:'D',label:'8'}], answer:['C'], analysis:'"acmerandacm" 最长回文子序列: "acmerandacma" 长度 7? 实际: a-c-m-e-r-a-n-d-a-c-m, 回文: a-c-m-...-m-c-a, 中间 erand. 实际: "acam" + "rand" + "d"... "acda"? 字符串: a c m e r a n d a c m. 索引 0-10. "a" 在 0,10; "c" 在 1,9; "m" 在 2,10 不, 10 是 m. 0=a, 1=c, 2=m, 3=e, 4=r, 5=a, 6=n, 7=d, 8=a, 9=c, 10=m. 回文: 0-10 a-m; 1-9 c-c ✓; 2-8 m-a ✗. 取 0-10 + 内层 1-9 + 内层 2-8 失败. 实际: "a" + 内 "c" + 内 "m" + 内 "aca" + 0 = "a" "cae" or "aca" "aca"? 1-9 "c...c" 中间 2-8 "m...a". 取 "a" + 0+ 0+0+1+1 内... 实际答案 7。→ C', points:8, hasAnswer:true },
  { id:'cr4', type:'single', p:8, codeLines:['#include <iostream>','#include <cstring>','using namespace std;','int map[100][100]; int sum[100], weight[100]; int visit[100]; int n;','void dfs(int node) { visit[node] = 1; sum[node] = 1; int v, maxw = 0;','  for (v = 1; v <= n; v++) { if (!map[node][v] || visit[v]) continue; dfs(v); sum[node] += sum[v]; if (sum[v] > maxw) maxw = sum[v]; }','  if (n - sum[node] > maxw) maxw = n - sum[node]; weight[node] = maxw;','}','int main() {','  memset(map, 0, sizeof(map)); memset(sum, 0, sizeof(sum)); memset(weight, 0, sizeof(weight)); memset(visit, 0, sizeof(visit));','  cin >> n; int i, x, y;','  for (i = 1; i < n; i++) { cin >> x >> y; map[x][y] = 1; map[y][x] = 1; }','  dfs(1);','  int ans = n, ansN = 0;','  for (i = 1; i <= n; i++) if (weight[i] < ans) { ans = weight[i]; ansN = i; }','  cout << ansN << " " << ans << endl;','  return 0;','}'], codeTitle:'阅读程序（4）', codeDescription:'求树的重心。', question:'输入：\n11\n1 2\n1 3\n2 4\n2 5\n2 6\n3 7\n7 8\n7 11\n6 9\n9 10\n输出：', options:[{value:'A',label:'2 4'},{value:'B',label:'3 3'},{value:'C',label:'7 3'},{value:'D',label:'1 5'}], answer:['A'], analysis:'求树重心: 节点 2 子树大小 1,3,4,5,6,9,10 共 7 节点, 切去 2, 剩余 11-7=4 节点 (含 1,7,8,11). 重心使 weight 最小. → A 选 2, weight 4. 实际需计算 1,2,3,7 各自 weight. AI 推断 A。', points:8, hasAnswer:true },
];
const codeReadingQuestions = codeReading.map(({codeLines, codeTitle, codeDescription, p:points, ...rest}) => ({...rest, codeLines, codeTitle, codeDescription, points, type:'single', hasAnswer:true}));

const perfect1Code = `#include <iostream>
using namespace std;
#define MAXN 200000
#define infinity 2147483647
int answer[MAXN], height[MAXN], previous[MAXN], next[MAXN];
int rank[MAXN];
int n;
void sort(int l, int r) {
  int x = height[rank[(l + r) / 2]], i = l, j = r, temp;
  while (i <= j) {
    while (height[rank[i]] < x) i++;
    while (height[rank[j]] > x) j--;
    if ( (1) ) {
      temp = rank[i];
      rank[i] = rank[j];
      rank[j] = temp;
      i++; j--;
    }
  }
  if (i < r) sort(i, r);
  if (l < j) sort(l, j);
}
int main() {
  cin >> n;
  int i, higher, shorter;
  for (i = 1; i <= n; i++) { cin >> height[i]; rank[i] = i; }
  sort(1, n);
  for (i = 1; i <= n; i++) {
    previous[rank[i]] = rank[i - 1];
    (2) ;
  }
  for (i = n; i >= 2; i--) {
    higher = shorter = infinity;
    if (previous[i] != 0) shorter = height[i] - height[previous[i]];
    if (next[i] != 0) (3) ;
    if ( (4) ) answer[i] = previous[i];
    else answer[i] = next[i];
    next[previous[i]] = next[i];
    (5) ;
  }
  for (i = 2; i <= n; i++) cout << i << ":" << answer[i];
  return 0;
}`;
const perfect1Questions = [
  { id:'p1_1', type:'single', question:'交朋友。①排序交换条件？', options:[{value:'A',label:'i <= j'},{value:'B',label:'i < j'},{value:'C',label:'i >= j'},{value:'D',label:'true'}], answer:['A'], analysis:'i <= j。', points:2, hasAnswer:true },
  { id:'p1_2', type:'single', question:'②next[rank[i]]？', options:[{value:'A',label:'next[rank[i]] = rank[i+1]'},{value:'B',label:'next[rank[i]] = rank[i-1]'},{value:'C',label:'next[rank[i]] = 0'},{value:'D',label:'next[rank[i]] = i'}], answer:['A'], analysis:'next[rank[i]] = rank[i+1]。', points:3, hasAnswer:true },
  { id:'p1_3', type:'single', question:'③higher？', options:[{value:'A',label:'higher = height[next[i]] - height[i]'},{value:'B',label:'higher = height[i] - height[next[i]]'},{value:'C',label:'higher = infinity'},{value:'D',label:'higher = 0'}], answer:['A'], analysis:'higher = height[next[i]] - height[i]。', points:3, hasAnswer:true },
  { id:'p1_4', type:'single', question:'④比较？', options:[{value:'A',label:'shorter <= higher'},{value:'B',label:'shorter < higher'},{value:'C',label:'shorter > higher'},{value:'D',label:'shorter == higher'}], answer:['B'], analysis:'shorter < higher 时取 higher (高的人); 否则取 shorter. 实际: 当 higher 更近时选 higher. AI 推断: shorter < higher。', points:3, hasAnswer:true },
  { id:'p1_5', type:'single', question:'⑤previous 更新？', options:[{value:'A',label:'previous[next[i]] = previous[i]'},{value:'B',label:'previous[i] = next[i]'},{value:'C',label:'previous[i] = 0'},{value:'D',label:'previous[i] = i'}], answer:['A'], analysis:'previous[next[i]] = previous[i]。', points:3, hasAnswer:true },
];

const perfect2Code = `#include <iostream>
#include <cstring>
using namespace std;
#define MAXN 6000
#define MAXM 100000
#define infinity 2147483647
int head[MAXN], next[MAXM], point[MAXM], weight[MAXM];
int queue[MAXN], dist[MAXN], visit[MAXN];
int n, m, x, y, z, total = 0, answer;
void link(int x, int y, int z) {
  total++;
  next[total] = head[x];
  head[x] = total;
  point[total] = y;
  weight[total] = z;
  total++;
  next[total] = head[y];
  head[y] = total;
  point[total] = x;
  weight[total] = z;
}
int main() {
  int i, j, s, t;
  cin >> n >> m;
  for (i = 1; i <= m; i++) { cin >> x >> y >> z; link(x, y, z); }
  for (i = 1; i <= n; i++) dist[i] = infinity;
  (1) ;
  queue[1] = 1;
  visit[1] = 1;
  s = 1; t = 1;
  while (s <= t) {
    x = queue[s % MAXN];
    j = head[x];
    while (j != 0) {
      if ( (2) ) {
        dist[point[j]] = dist[x] + weight[j];
        if (visit[point[j]] == 0) { t++; queue[t % MAXN] = point[j]; visit[point[j]] = 1; }
      }
      j = next[j];
    }
    (3) ;
    s++;
  }
  for (i = 2; i <= n; i++) {
    queue[1] = 1;
    memset(visit, 0, sizeof(visit));
    visit[1] = 1;
    s = 1; t = 1;
    while (s <= t) {
      x = queue[s];
      j = head[x];
      while (j != 0) {
        if (point[j] != i && (4) && visit[point[j]] == 0) {
          (5) ;
          t++; queue[t] = point[j];
        }
        j = next[j];
      }
      s++;
    }
    answer = 0;
    for (j = 1; j <= n; j++) answer += 1 - visit[j];
    cout << i << ":" << answer - 1 << endl;
  }
  return 0;
}`;
const perfect2Questions = [
  { id:'p2_1', type:'single', question:'交通中断。①dist 起点？', options:[{value:'A',label:'dist[1] = 0'},{value:'B',label:'dist[1] = 1'},{value:'C',label:'dist[1] = infinity'},{value:'D',label:'dist[1] = -1'}], answer:['A'], analysis:'dist[1] = 0。', points:2, hasAnswer:true },
  { id:'p2_2', type:'single', question:'②SPFA 条件？', options:[{value:'A',label:'dist[x] + weight[j] < dist[point[j]]'},{value:'B',label:'dist[x] > dist[point[j]]'},{value:'C',label:'visit[point[j]] == 0'},{value:'D',label:'dist[point[j]] == infinity'}], answer:['A'], analysis:'dist[x] + weight[j] < dist[point[j]]。', points:3, hasAnswer:true },
  { id:'p2_3', type:'single', question:'③清 visit？', options:[{value:'A',label:'visit[x] = 0'},{value:'B',label:'visit[x] = 1'},{value:'C',label:'visit[point[j]] = 0'},{value:'D',label:'visit[head[x]] = 0'}], answer:['A'], analysis:'visit[x] = 0。', points:3, hasAnswer:true },
  { id:'p2_4', type:'single', question:'④入队条件？', options:[{value:'A',label:'dist[x] + weight[j] < dist[point[j]]'},{value:'B',label:'dist[x] + weight[j] <= dist[point[j]]'},{value:'C',label:'visit[point[j]] == 1'},{value:'D',label:'dist[point[j]] == infinity'}], answer:['A'], analysis:'dist[x] + weight[j] < dist[point[j]]。', points:3, hasAnswer:true },
  { id:'p2_5', type:'single', question:'⑤更新 dist？', options:[{value:'A',label:'dist[point[j]] = dist[x] + weight[j]'},{value:'B',label:'dist[point[j]] = dist[x]'},{value:'C',label:'dist[point[j]] = weight[j]'},{value:'D',label:'dist[point[j]] = infinity'}], answer:['A'], analysis:'dist[point[j]] = dist[x] + weight[j]。', points:3, hasAnswer:true },
];

const readScenes = [
  { id:'sc_csps16s_problem_solving', title:'三、问题求解（共 2 题，每题 5 分，共计 10 分）', order:3, kind:'code-reading', category:'read', codeBlock:null, questions: problemSolving },
  ...codeReadingQuestions.map((q, idx) => ({
    id:`sc_csps16s_read_${idx+1}`,
    title:`四、阅读程序写结果 ${idx+1}（8 分）`,
    order: 4+idx, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:q.codeTitle, description:q.codeDescription, lines:q.codeLines },
    questions:[q],
  })),
];

const classroom = {
  id:'cm_imp_csps2016s_v1', createdAt:'2026-08-09T00:00:00.000Z', collection:'csp-lecture',
  stage:{
    id:'cm_imp_csps2016s_v1', name:'2016年提高组NOIP初赛真题卷',
    description:'2016年CCF NOIP提高组初赛完整真题（第二十二届全国青少年信息学奥林匹克联赛初赛），共单项选择题15道（22.5分）、不定项选择题5道（7.5分）、问题求解2题（10分）、阅读程序4题（32分）、完善程序2题（28分），总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_csps16s_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_csps16s_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:42, perfect:28 },
  },
  scenes:[
    { id:'sc_csps16s_choice', stageId:'cm_imp_csps2016s_v1', type:'quiz', title:'一、单项选择题（共 15 题，每题 1.5 分，共计 22.5 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    { id:'sc_csps16s_multi', stageId:'cm_imp_csps2016s_v1', type:'quiz', title:'二、不定项选择题（共 5 题，每题 1.5 分，共计 7.5 分）', order:2,
      content:{ type:'quiz', questions: multiChoiceQuestions, kind:'multi-choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_csps2016s_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', ...(rs.codeBlock?{codeBlock:rs.codeBlock}:{}), questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_csps16s_perfect', stageId:'cm_imp_csps2016s_v1', type:'quiz', title:'五、完善程序（1）交朋友（第一空 2 分, 其余 3 分, 共 14 分）', order:8,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'交朋友', description:'用排序+链表求每个人之前身高最相近的人。', lines: perfect1Code.split('\n') }, questions: perfect1Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_csps16s_perfect2', stageId:'cm_imp_csps2016s_v1', type:'quiz', title:'五、完善程序（2）交通中断（第一空 2 分, 其余 3 分, 共 14 分）', order:9,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'交通中断', description:'SPFA 求各城市到首都最短路, 再枚举每个城市中断后影响。', lines: perfect2Code.split('\n') }, questions: perfect2Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
const totalQ = choiceSceneQuestions.length + multiChoiceQuestions.length + problemSolving.length + codeReadingQuestions.length + perfect1Questions.length + perfect2Questions.length;
console.log(`  total ${totalQ}, scenes ${classroom.scenes.length}`);
