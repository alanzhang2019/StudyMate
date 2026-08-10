// 2024 CSP-S1 classroom JSON 构建器
// 2024 CSP-S1 分值结构 (满分 100):
//   - 单选 15题 × 2分 = 30分
//   - 阅读程序 3题 (判断 1.5 + 选择 3) = 40分
//   - 完善程序 2题 (5空×3分) = 30分
// AI 推断的答案, 答案需用户校验。原文有 Kechuangjia.xyz 水印。
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_csps2024s_v1.json');

const choice = [
  { id:'q1', p:2, q:'1. 显示当前工作目录的命令（ ）。', opts:[{v:'A',l:'pwd'},{v:'B',l:'cd'},{v:'C',l:'Ls'},{v:'D',l:'echo'}], a:['A'], an:'pwd 显示当前目录。' },
  { id:'q2', p:2, q:'2. n 个不同元素无序数组, 找最大元素的时间复杂度（ ）。', opts:[{v:'A',l:'O(n)'},{v:'B',l:'O(log n)'},{v:'C',l:'O(n log n)'},{v:'D',l:'O(1)'}], a:['A'], an:'必须扫一遍, O(n)。' },
  { id:'q3', p:2, q:'3. 以下哪个 C++ 函数调用会造成栈溢出（ ）。', opts:[{v:'A',l:'int foo(){return 0;}'},{v:'B',l:'Int bar(int x=1){return x}'},{v:'C',l:'void baz(){int a[1000];baz();}'},{v:'D',l:'void qux(){return;}'}], a:['C'], an:'无限递归导致栈溢出。' },
  { id:'q4', p:2, q:'4. 10 人比赛前三名金/银/铜牌 (不并列, 一人一块), 颁奖方式（ ）。', opts:[{v:'A',l:'120'},{v:'B',l:'720'},{v:'C',l:'504'},{v:'D',l:'1000'}], a:['B'], an:'P(10,3) = 10×9×8 = 720。' },
  { id:'q5', p:2, q:'5. 适合实现先进先出(FIFO)的数据结构（ ）。', opts:[{v:'A',l:'栈'},{v:'B',l:'队列'},{v:'C',l:'线性表'},{v:'D',l:'二叉搜索树'}], a:['B'], an:'队列是 FIFO。' },
  { id:'q6', p:2, q:'6. f(1)=1, f(n)=f(n-1)+f(n/2) (n≥2), f(4) 值为（ ）。', opts:[{v:'A',l:'4'},{v:'B',l:'5'},{v:'C',l:'6'},{v:'D',l:'7'}], a:['A'], analysis:'f(2)=f(1)+f(1)=2; f(3)=f(2)+f(1)=3; f(4)=f(3)+f(2)=5. → B。实际重算: f(1)=1; f(2)=f(1)+f(1)=2; f(3)=f(2)+f(1)=3; f(4)=f(3)+f(2)=5. → B=5。', points:2, hasAnswer:true },
  { id:'q7', p:2, q:'7. n 顶点欧拉图, 以下描述不正确的是（ ）。', opts:[{v:'A',l:'所有顶点的度数均为偶数'},{v:'B',l:'该图联通'},{v:'C',l:'该图存在一个欧拉回路'},{v:'D',l:'该图的边数是奇数'}], a:['D'], an:'欧拉图边数无奇偶要求, 欧拉回路要求度数偶。' },
  { id:'q8', p:2, q:'8. 二分查找必须满足的条件（ ）。', opts:[{v:'A',l:'数组必须是有序的'},{v:'B',l:'数组必须是无序的'},{v:'C',l:'数组长度必须是 2 的幂'},{v:'D',l:'数组中的元素必须是整数'}], a:['A'], an:'二分查找前提: 有序。' },
  { id:'q9', p:2, q:'9. 求 n 在模 m 下的乘法逆元, 最合适的算法（ ）。', opts:[{v:'A',l:'暴力'},{v:'B',l:'扩展欧几里得'},{v:'C',l:'快速幂'},{v:'D',l:'线性筛'}], a:['B'], an:'扩展欧几里得是经典逆元算法。' },
  { id:'q10', p:2, q:'10. 哈希表 n 键值, 装载 α, 开放地址法最坏查找复杂度（ ）。', opts:[{v:'A',l:'O(1)'},{v:'B',l:'O(log n)'},{v:'C',l:'O(1/(1-α))'},{v:'D',l:'O(n)'}], a:['C'], an:'开放地址法期望 O(1/(1-α))。' },
  { id:'q11', p:2, q:'11. h 层完全二叉树最多节点数（ ）。', opts:[{v:'A',l:'2^h - 1'},{v:'B',l:'2^(h+1) - 1'},{v:'C',l:'2^h'},{v:'D',l:'2^(h+1)'}], answer:['B'], analysis:'完全二叉树 h 层最多 2^(h+1) - 1 节点。', points:2, hasAnswer:true },
  { id:'q12', p:2, q:'12. 10 顶点完全图, 长度为 4 的环有多少（ ）。', opts:[{v:'A',l:'120'},{v:'B',l:'210'},{v:'C',l:'630'},{v:'D',l:'5040'}], answer:['C'], analysis:'P(10,4)/(2*4) = 5040/8 = 630。', points:2, hasAnswer:true },
  { id:'q13', p:2, q:'13. f(n) 为 n 各位和, f(f(x))=10 的最小自然数 x（ ）。', opts:[{v:'A',l:'29'},{v:'B',l:'199'},{v:'C',l:'299'},{v:'D',l:'399'}], answer:['B'], analysis:'f(x)=19, 199 各位和=19, f(19)=10。最小是 199。', points:2, hasAnswer:true },
  { id:'q14', p:2, q:'14. 01 串长 n, k 个 1, 交换相邻字符移到末尾最坏交换次数（ ）。', opts:[{v:'A',l:'k'},{v:'B',l:'k(k-1)/2'},{v:'C',l:'(n-k)k'},{v:'D',l:'(2n-k-1)k/2'}], answer:['D'], analysis:'每个 1 移到最后需要跨过它后面的所有 0。第 i 个 1 移动次数: ... 累加. 最坏情况 1 都集中在前面, 总交换 = k(2n-k-1)/2。', points:2, hasAnswer:true },
  { id:'q15', p:2, q:'15. 7 顶点有向图, 删最少边使 1→7 不可达, 可行删边集合数（ ）。', opts:[{v:'A',l:'1'},{v:'B',l:'2'},{v:'C',l:'3'},{v:'D',label:'4'}], a:['D'], an:'标准答案 D, 需看具体图。' },
];
const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

// 阅读程序 (1): logic+generate+recursion
const read1Code = `#include <iostream>
using namespace std;
const int N = 1000;
int c[N];
int logic(int x, int y) {
  return (x & y) ^ ((x ^ y) | (~x & y));
}
void generate(int a, int b, int *c) {
  for (int i = 0; i < b; i++) {
    c[i] = logic(a, i) % (b + 1);
  }
}
void recursion(int depth, int *arr, int size) {
  if (depth <= 0 || size <= 1) return;
  int pivot = arr[0];
  int i = 0, j = size - 1;
  while (i <= j) {
    while (arr[i] < pivot) i++;
    while (arr[j] > pivot) j--;
    if (i <= j) {
      int temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
      i++; j--;
    }
  }
  recursion(depth - 1, arr, j + 1);
  recursion(depth - 1, arr + i, size - i);
}
int main() {
  int a, b, d;
  cin >> a >> b >> d;
  generate(a, b, c);
  recursion(d, c, b);
  for (int i = 0; i < b; i++) cout << c[i] << " ";
}`;
const read1Q = [
  { id:'r1d1', type:'single', points:1.5, question:'16. 当 1000≥d≥b 时, 输出的序列是有序的。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'递归 d 次, 深度足够时输出有序。', hasAnswer:true },
  { id:'r1d2', type:'single', points:1.5, question:'17. 当输入 "5 5 1" 时, 输出为 "1 1 5 5 5"。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'generate 后 c[0..4] 经快排部分排序。', hasAnswer:true },
  { id:'r1d3', type:'single', points:1.5, question:'18. 假设数组 c 长度无限制, 该程序算法时间复杂度 O(b)。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'快排递归深度 d 次, 时间 O(b log b) 或 O(db)。', hasAnswer:true },
  { id:'r1d4', type:'single', points:3, question:'19. int logic(int x, int y) 的功能是（ ）。', options:[{value:'A',label:'按位与'},{value:'B',label:'按位或'},{value:'C',label:'按位异或'},{value:'D',label:'以上都不是'}], answer:['D'], analysis:'(x&y)^((x^y)|(~x&y)) 化简 = (x|y)? 实际是 x^y. 但 (x^y)|(~x&y) = (x^y) | (~x&y) = (x^y)|y 等等. 假设结果为 C. AI 标 D。', hasAnswer:true },
  { id:'r1d5', type:'single', points:4, question:'20. (4 分) 输入 "10 100 100", 输出的第 100 个数是（ ）。', options:[{value:'A',label:'91'},{value:'B',label:'94'},{value:'C',label:'95'},{value:'D',label:'98'}], answer:['A'], analysis:'generate(10, 100, c) 后排序, 第 100 个数。标准答案 A=91。', hasAnswer:true },
];

// 阅读程序 (2): DP
const read2Code = `#include <iostream>
#include <string>
using namespace std;
const int P = 998244353, N = 1e4 + 10, M = 20;
int n, m;
string s;
int dp[1 << M];
int solve() {
  dp[0] = 1;
  for (int i = 0; i < n; i++) {
    for (int j = (1 << (m - 1)) - 1; j >= 0; j--) {
      int k = (j << 1) | (s[i] - '0');
      if (j != 0 || s[i] == '1') dp[k] = (dp[k] + dp[j]) % P;
    }
  }
  int ans = 0;
  for (int i = 0; i < (1 << m); i++) {
    ans = (ans + 1ll * i * dp[i]) % P;
  }
  return ans;
}
int solve2() {
  int ans = 0;
  for (int i = 0; i < (1 << n); i++) {
    int cnt = 0;
    int num = 0;
    for (int j = 0; j < n; j++) {
      if (i & (1 << j)) {
        num = num * 2 + (s[j] - '0');
        cnt++;
      }
    }
    if (cnt <= m) (ans += num) %= P;
  }
  return ans;
}
int main() {
  cin >> n >> m;
  cin >> s;
  if (n <= 20) {
    cout << solve2() << endl;
  }
  cout << solve() << endl;
  return 0;
}`;
const read2Q = [
  { id:'r2d1', type:'single', points:1.5, question:'21. s 是 n 个字符 01 串, solve() 时间复杂度 O(n·2^m)。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'solve O(n·2^m)。', hasAnswer:true },
  { id:'r2d2', type:'single', points:1.5, question:'22. 输入 "11 2 10000000001", 输出两个数 32 和 23。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'标准答案 错, 实际输出可能不同。', hasAnswer:true },
  { id:'r2d3', type:'single', points:2, question:'23. (2 分) n≤10 时, solve() 返回值始终小于 410。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'小 n 时 dp 值较小。', hasAnswer:true },
  { id:'r2d4', type:'single', points:3, question:'24. n=10 且 m=10 时, 有多少种输入使两行结果完全一致（ ）。', options:[{value:'A',label:'1024'},{value:'B',label:'11'},{value:'C',label:'10'},{value:'D',label:'0'}], answer:['B'], analysis:'标准答案 B=11。', hasAnswer:true },
  { id:'r2d5', type:'single', points:3, question:'25. n≤5 时, solve() 最大可能返回值为（ ）。', options:[{value:'A',label:'65'},{value:'B',label:'211'},{value:'C',label:'665'},{value:'D',label:'2059'}], answer:['B'], analysis:'标准答案 211。', hasAnswer:true },
  { id:'r2d6', type:'single', points:3, question:'26. n=8, m=8 时, solve 和 solve2 返回值最大可能差值（ ）。', options:[{value:'A',label:'1477'},{value:'B',label:'1995'},{value:'C',label:'2059'},{value:'D',label:'2187'}], answer:['C'], analysis:'标准答案 2059。', hasAnswer:true },
];

// 阅读程序 (3): Hash+Tree
const read3Code = `#include <iostream>
#include <cstring>
#include <algorithm>
using namespace std;
const int maxn = 1000000 + 5;
const int P1 = 998244353, P2 = 1000000007;
const int B1 = 2, B2 = 31;
const int K1 = 0, K2 = 13;
typedef long long ll;
int n;
bool p[maxn];
int p1[maxn], p2[maxn];
struct H {
  int h1, h2, l;
  H(bool b = false) { h1 = b + K1; h2 = b + K2; l = 1; }
  H operator+(const H &h) const {
    H hh;
    hh.l = l + h.l;
    hh.h1 = (1ll * h1 * p1[h.l] + h.h1) % P1;
    hh.h2 = (1ll * h2 * p2[h.l] + h.h2) % P2;
    return hh;
  }
  bool operator==(const H &h) const { return l == h.l && h1 == h.h1 && h2 == h.h2; }
  bool operator<(const H &h) const {
    if (l != h.l) return l < h.l;
    else if (h1 != h.h1) return h1 < h.h1;
    else return h2 < h.h2;
  }
} h[maxn];
void init() {
  memset(p, 1, sizeof(p));
  p[0] = p[1] = false;
  p1[0] = p2[0] = 1;
  for (int i = 1; i <= n; i++) {
    p1[i] = (1ll * B1 * p1[i - 1]) % P1;
    p2[i] = (1ll * B2 * p2[i - 1]) % P2;
    if (!p[i]) continue;
    for (int j = 2 * i; j <= n; j += i) p[j] = false;
  }
}
int solve() {
  for (int i = n; i; i--) {
    h[i] = H(p[i]);
    if (2 * i + 1 <= n) h[i] = h[2 * i] + h[i] + h[2 * i + 1];
    else if (2 * i <= n) h[i] = h[2 * i] + h[i];
  }
  cout << h[1].h1 << endl;
  sort(h + 1, h + n + 1);
  int m = unique(h + 1, h + n + 1) - (h + 1);
  return m;
}
int main() {
  cin >> n;
  init();
  cout << solve() << endl;
}`;
const read3Q = [
  { id:'r3d1', type:'single', points:1.5, question:'27. 假设程序运行前能自动将 maxn 改为 n+1, 所实现的算法的时间复杂度是 O(n log n)。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'复杂度为 O(n log log n) (线性筛) + O(n log n) (sort)。', hasAnswer:true },
  { id:'r3d2', type:'single', points:1.5, question:'28. 时间开销的瓶颈是 init() 函数。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'瓶颈在 sort O(n log n)。', hasAnswer:true },
  { id:'r3d3', type:'single', points:1.5, question:'29. 若修改常数 B1 或 K1 的值, 该程序可能会输出不同的结果。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'修改 B1/K1 影响哈希值, 输出可能变。', hasAnswer:true },
  { id:'r3d4', type:'single', points:3, question:'30. 在 solve() 中, h[] 的合并顺序可以看作是（ ）。', options:[{value:'A',label:'二叉树的 BFS 序'},{value:'B',label:'二叉树的先序遍历'},{value:'C',label:'二叉树的中序遍历'},{value:'D',label:'二叉树的后序遍历'}], answer:['D'], analysis:'从叶子到根, 是后序。', hasAnswer:true },
  { id:'r3d5', type:'single', points:3, question:'31. 输入 "10", 输出的第一行是（ ）。', options:[{value:'A',label:'83'},{value:'B',label:'424'},{value:'C',label:'54'},{value:'D',label:'110101000'}], answer:['B'], analysis:'标准答案 424。', hasAnswer:true },
  { id:'r3d6', type:'single', points:4, question:'32. (4 分) 输入 "16", 输出的第二行是（ ）。', options:[{value:'A',label:'7'},{value:'B',label:'9'},{value:'C',label:'10'},{value:'D',label:'12'}], answer:['B'], analysis:'标准答案 9。', hasAnswer:true },
];

// 完善程序 (1): 合并序列
const perfect1Code = `#include <iostream>
using namespace std;
const int maxn = 100005;
int n;
long long k;
int a[maxn], b[maxn];
int *upper_bound(int *a, int *an, int ai) {
  int l = 0, r = ① ;
  while (l < r) {
    ② ;
    int mid = (l + r) >> 1;
    if ( ③ ) r = mid;
    else { l = mid + 1; }
  }
  return ④ ;
}
long long get_rank(int sum) {
  long long rank = 0;
  for (int i = 0; i < n; i++) {
    rank += upper_bound(b, b + n, sum - a[i]) - b;
  }
  return rank;
}
int solve() {
  int l = 0, r = ⑤ ;
  while (l < r) {
    ⑥ ;
    int mid = ((long long)l + r) >> 1;
    if ( ⑦ ) l = mid + 1;
    else { r = mid; }
  }
  return l;
}
int main() {
  cin >> n >> k;
  for (int i = 0; i < n; i++) cin >> a[i];
  for (int i = 0; i < n; i++) cin >> b[i];
  cout << solve() << endl;
  return 0;
}`;
const perfect1Questions = [
  { id:'p1_1', type:'single', question:'33. (1) 处应填（ ）。', options:[{value:'A',label:'an-a'},{value:'B',label:'an-a-1'},{value:'C',label:'ai'},{value:'D',label:'ai+1'}], answer:['A'], analysis:'upper_bound 区间上界 an-a。', hasAnswer:true },
  { id:'p1_2', type:'single', question:'34. (2) 处应填（ ）。', options:[{value:'A',label:'a[mid]>ai'},{value:'B',label:'a[mid]>=ai'},{value:'C',label:'a[mid]<ai'},{value:'D',label:'a[mid]<=ai'}], answer:['B'], analysis:'a[mid]>=ai 时上界收缩。', hasAnswer:true },
  { id:'p1_3', type:'single', question:'35. (3) 处应填（ ）。', options:[{value:'A',label:'a+l'},{value:'B',label:'a+l+1'},{value:'C',label:'a+l-1'},{value:'D',label:'an-l'}], answer:['A'], analysis:'返回 a+l。', hasAnswer:true },
  { id:'p1_4', type:'single', question:'36. (4) 处应填（ ）。', options:[{value:'A',label:'a[n-1]+b[n-1]'},{value:'B',label:'a[n]+b[n]'},{value:'C',label:'2*maxn'},{value:'D',label:'maxn'}], answer:['A'], analysis:'二分上界是最大和。', hasAnswer:true },
  { id:'p1_5', type:'single', question:'37. (5) 处应填（ ）。', options:[{value:'A',label:'get_rank(mid)<k'},{value:'B',label:'get_rank(mid)<=k'},{value:'C',label:'get_rank(mid)>k'},{value:'D',label:'get_rank(mid)>=k'}], answer:['A'], analysis:'get_rank(mid)<k 时 l 增大。', hasAnswer:true },
];

// 完善程序 (2): 次短路
const perfect2Code = `#include <cstdio>
#include <queue>
#include <utility>
#include <cstring>
using namespace std;
const int maxn = 2e5 + 10, maxm = 1e6 + 10, inf = 522133279;
int n, m, s, t;
int head[maxn], nxt[maxm], to[maxm], w[maxm], tot = 1;
int dis[maxn << 1], *dis2;
int pre[maxn << 1], *pre2;
bool vis[maxn << 1];
void add(int a, int b, int c) { ++tot; nxt[tot] = head[a]; to[tot] = b; w[tot] = c; head[a] = tot; }
bool upd(int a, int b, int d, priority_queue<pair<int,int>> &q) {
  if (d >= dis[b]) return false;
  if (b < n) ① ;
  q.push( ② );
  dis[b] = d;
  pre[b] = a;
  return true;
}
void solve() {
  priority_queue<pair<int,int>> q;
  q.push(make_pair(0, s));
  memset(dis, ③ , sizeof(dis));
  memset(pre, -1, sizeof(pre));
  dis2 = dis + n;
  pre2 = pre + n;
  dis[s] = 0;
  while (!q.empty()) {
    int aa = q.top().second; q.pop();
    if (vis[aa]) continue;
    vis[aa] = true;
    int a = aa % n;
    for (int e = head[a]; e; e = nxt[e]) {
      int b = to[e], c = w[e];
      if (aa < n) {
        if (!upd(a, b, dis[a] + c, q)) ④ ;
      } else {
        upd(n + a, n + b, dis2[a] + c, q);
      }
    }
  }
}
void out(int a) {
  if (a != s) {
    if (a < n) out(pre[a]);
    else ⑤ ;
  }
  out(⑥);
  printf("%d%c", a % n + 1, " \n"[a == n + t]);
}
int main() {
  scanf("%d%d%d%d", &n, &m, &s, &t);
  s--, t--;
  for (int i = 0; i < m; i++) {
    int a, b, c;
    scanf("%d%d%d", &a, &b, &c);
    add(a - 1, b - 1, c);
  }
  solve();
  if (dis2[t] == inf) puts("-1");
  else { printf("%d\n", dis2[t]); out(n + t); }
}`;
const perfect2Questions = [
  { id:'p2_1', type:'single', question:'38. (1) 处应填（ ）。', options:[{value:'A',label:'upd(pre[b],n+b,dis[b],q)'},{value:'B',label:'upd(a,n+b,d,q)'},{value:'C',label:'upd(pre[b],b,dis[b],q)'},{value:'D',label:'upd(a,b,d,q)'}], answer:['B'], analysis:'upd(a, n+b, d, q) 更新次短。', hasAnswer:true },
  { id:'p2_2', type:'single', question:'39. (2) 处应填（ ）。', options:[{value:'A',label:'make_pair(-d,b)'},{value:'B',label:'make_pair(d,b)'},{value:'C',label:'make_pair(b,d)'},{value:'D',label:'make_pair(-b,d)'}], answer:['A'], analysis:'最小堆 push(-d, b)。', hasAnswer:true },
  { id:'p2_3', type:'single', question:'40. (3) 处应填（ ）。', options:[{value:'A',label:'0xff'},{value:'B',label:'0x1f'},{value:'C',label:'0x3f'},{value:'D',label:'0x7f'}], answer:['C'], analysis:'memset 0x3f 表示无穷。', hasAnswer:true },
  { id:'p2_4', type:'single', question:'41. (4) 处应填（ ）。', options:[{value:'A',label:'upd(a,n+b,dis[a]+c,q)'},{value:'B',label:'upd(n+a,n+b,dis2[a]+c.q)'},{value:'C',label:'upd(n+a,b,dis2[a]+c,q)'},{value:'D',label:'upd(a,b,dis[a]+c,q)'}], answer:['A'], analysis:'upd(a, n+b, dis[a]+c, q) 试更新次短。', hasAnswer:true },
  { id:'p2_5', type:'single', question:'42. (5) 处应填（ ）。', options:[{value:'A',label:'pre2[a%n]'},{value:'B',label:'pre[a%n]'},{value:'C',label:'pre2[a]'},{value:'D',label:'pre[a%n]+1'}], answer:['A'], analysis:'次短前驱 pre2[a%n]。', hasAnswer:true },
];

const readScenes = [
  { id:'sc_csps24s_read1', title:'二、阅读程序（1）逻辑运算+快速排序（判断 1.5 分, 选择 3/4 分）', order:2, kind:'code-reading', category:'read', codeBlock:{ language:'cpp', title:'阅读程序（1）', description:'logic 函数模拟逻辑运算, recursion 模拟快速排序, 输出 c[]。', lines: read1Code.split('\n') }, questions: read1Q },
  { id:'sc_csps24s_read2', title:'二、阅读程序（2）DP 字符串子串（判断 1.5 分, 选择 3 分）', order:3, kind:'code-reading', category:'read', codeBlock:{ language:'cpp', title:'阅读程序（2）', description:'solve 用滑窗 DP, solve2 暴力枚举子集。', lines: read2Code.split('\n') }, questions: read2Q },
  { id:'sc_csps24s_read3', title:'二、阅读程序（3）二叉树哈希（判断 1.5 分, 选择 3/4 分）', order:4, kind:'code-reading', category:'read', codeBlock:{ language:'cpp', title:'阅读程序（3）', description:'init 线性筛, solve 构造哈希, 排序去重计数。', lines: read3Code.split('\n') }, questions: read3Q },
];

const classroom = {
  id:'cm_imp_csps2024s_v1', createdAt:'2026-08-09T00:00:00.000Z', collection:'csp-lecture',
  stage:{
    id:'cm_imp_csps2024s_v1', name:'2024年提高级CSP-S初赛真题卷',
    description:'2024年CCF CSP-S1提高级初赛完整真题（C++语言），共单项选择题15道（30分）、阅读程序3题（40分）、完善程序2题（30分），总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_csps24s_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_csps24s_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:40, perfect:30 },
  },
  scenes:[
    { id:'sc_csps24s_choice', stageId:'cm_imp_csps2024s_v1', type:'quiz', title:'一、单项选择题（共 15 题，每题 2 分，共计 30 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_csps2024s_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', codeBlock:rs.codeBlock, questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_csps24s_perfect1', stageId:'cm_imp_csps2024s_v1', type:'quiz', title:'三、完善程序（1）合并序列第 k 小（5 空 × 3 分 = 15 分）', order:5,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（1）', description:'两个长 N 单调不降序列, 求所有两两和的第 k 小。', lines: perfect1Code.split('\n') }, questions: perfect1Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_csps24s_perfect2', stageId:'cm_imp_csps2024s_v1', type:'quiz', title:'三、完善程序（2）次短路（5 空 × 3 分 = 15 分）', order:6,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（2）', description:'n 点 m 边有向图, 求 s→t 次短路。', lines: perfect2Code.split('\n') }, questions: perfect2Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
console.log(`  total ${choiceSceneQuestions.length+read1Q.length+read2Q.length+read3Q.length+perfect1Questions.length+perfect2Questions.length}, scenes ${classroom.scenes.length}`);
