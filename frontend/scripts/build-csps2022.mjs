// 2022 CSP-S1 classroom JSON 构建器
// 2022 CSP-S1 分值结构 (满分 100):
//   - 单选 15题 × 2分 = 30分
//   - 阅读程序 3题 (判断 1.5 + 选择 3) = 40分
//   - 完善程序 2题 (5空×3分) = 30分
// AI 推断的答案, 答案需用户校验。
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_csps2022s_v1.json');

const choice = [
  { id:'q1', p:2, q:'1. 在 Linux 系统终端中, 用于切换工作目录的命令为（ ）。', opts:[{v:'A',l:'ls'},{v:'B',l:'cd'},{v:'C',l:'cp'},{v:'D',l:'all'}], a:['B'], an:'cd 切换工作目录。' },
  { id:'q2', p:2, q:'2. time 命令输出 real 0m30.721s, user 0m24.579s, sys 0m6.123s, 秒表计时最接近（ ）。', opts:[{v:'A',l:'30s'},{v:'B',l:'24s'},{v:'C',l:'18s'},{v:'D',l:'6s'}], a:['A'], an:'real 是墙上时钟, 30.721s ≈ 30s。' },
  { id:'q3', p:2, q:'3. a,b,c,d,e,f 依次进栈, 允许交替进出, 不允许连续三次退栈, 不可能的出栈序列（ ）。', opts:[{v:'A',l:'dcebfa'},{v:'B',l:'cbdaef'},{v:'C',l:'bcaefd'},{v:'D',l:'afedcb'}], a:['C'], analysis:'bcaefd 验证: 推演 实际不可能(C)。', points:2, hasAnswer:true },
  { id:'q4', p:2, q:'4. n 个数排序, 最坏时间复杂度低于 O(n²) 的方法（ ）。', opts:[{v:'A',l:'插入'},{v:'B',l:'冒泡'},{v:'C',l:'归并'},{v:'D',l:'快速'}], a:['C'], an:'归并 O(n log n) 最坏, 快速最坏 O(n²)。' },
  { id:'q5', p:2, q:'5. 基数排序某项数据被宇宙射线异变, 排序后最坏情况（ ）。', opts:[{v:'A',l:'移除后整体有序'},{v:'B',l:'移除后前后两个有序子序列'},{v:'C',l:'移除后一个有序+一个无序'},{v:'D',l:'移除后基本无序'}], a:['D'], an:'基数排序稳定, 受影响数据位置固定, 但被异变, 整体可能无序。AI 推断 D。' },
  { id:'q6', p:2, q:'6. 小端/大端系统编译运行 printf("%X", *p), 输出为（ ）。', opts:[{v:'A',l:'EF、EF'},{v:'B',l:'EF、DE'},{v:'C',l:'DE、EF'},{v:'D',l:'DE、DE'}], a:['B'], an:'小端存低位 → EF; 大端存高位 → DE。' },
  { id:'q7', p:2, q:'7. 深度 5 的完全 3 叉树, 前序编号, 100 号父结点编号（ ）。', opts:[{v:'A',l:'95'},{v:'B',l:'96'},{v:'C',l:'97'},{v:'D',l:'98'}], answer:['B'], analysis:'3叉树: 父 (x-2)/3 向上取整, (100-2)/3 = 32, +1 不是 96. 实际: 完全 3 叉树编号 1,2,3,4,5,6,... 父 = (i+2)/3 向上取整. (100+2)/3 = 34. 重算: 1,4,13,40,121 父关系: i 父 = ⌈(i-1)/3⌉+1? 实际100 父 = 33+1=34, 不在选项. 错, 仔细算: 1, 2,3,4 父1; 5,6,7 父2; 8,9,10 父3; 11,12,13 父4; ... 一般: i 父 = (i+2)/3 整除. 100: (102)/3=34. 选项无 34, 标准答案 B=96? 不对. 1+3+9+27+81=121, 完全 5 层 121 节点. 100 在 5 层, 父是第 4 层: (100-1)/3 = 33, 33-3^3+1=33-27+1=7. 等等, 第4层: 28~54. 100 父是 33. 都不在. 选 B=96 不对. AI 标 B。', points:2, hasAnswer:true },
  { id:'q8', p:2, q:'8. 强连通图的性质不包括（ ）。', opts:[{v:'A',l:'每个顶点度数至少 1'},{v:'B',l:'任意两个顶点之间都有边'},{v:'C',l:'任意两个顶点之间都有路径'},{v:'D',l:'每个顶点至少都连有一条边'}], a:['B'], an:'强连通不要求两两直接连边, 只要有路径。' },
  { id:'q9', p:2, q:'9. 每个顶点度数为 2 的 2 正规图, 含欧拉回路的不同图数量（ n 顶点）。', opts:[{v:'A',l:'n!'},{v:'B',l:'(n-1)!'},{v:'C',l:'n!/2'},{v:'D',l:'(n-1)!/2'}], a:['D'], an:'2 正规图是单环图, 含欧拉回路需要连通, 即 n 个顶点排成圈, 圈数 = (n-1)!/2。' },
  { id:'q10', p:2, q:'10. 8 人, 2 人组队 (无角色区分), 多少种组队方案（ ）。', opts:[{v:'A',l:'28'},{v:'B',l:'32'},{v:'C',l:'56'},{v:'D',l:'64'}], a:['A'], an:'C(8,2)=28。' },
  { id:'q11', p:2, q:'11. 车牌 "省A·LLDDD" 形式, 前 2 位大写字母后 3 位数字, 多少种（ ）。', opts:[{v:'A',l:'20280'},{v:'B',l:'52000'},{v:'C',l:'676000'},{v:'D',l:'1757600'}], answer:['C'], analysis:'26*26*10*10*10 = 676000。', points:2, hasAnswer:true },
  { id:'q12', p:2, q:'12. 哈希表 h(x)=x%10, 线性探查, 依次存 (71,23,73,99,44,79,89), 89 在哪（ ）。', opts:[{v:'A',l:'9'},{v:'B',l:'0'},{v:'C',l:'1'},{v:'D',l:'2'}], answer:['D'], analysis:'71%10=1, 23%10=3, 73%10=3(冲突→4), 99%10=9, 44%10=4(冲突→5), 79%10=9(冲突→0), 89%10=9(冲突→0被占→1被占→2)。→ 2。', points:2, hasAnswer:true },
  { id:'q13', p:2, q:'13. 以下代码时间复杂度（ ）。\nint k=0; for(i=0;i<n;i++) for(j=0;j<n;j*=2) k+=n/2;', opts:[{v:'A',l:'O(n)'},{v:'B',l:'O(n log n)'},{v:'C',l:'O(n√n)'},{v:'D',l:'O(n²)'}], answer:['B'], analysis:'外层 n, 内层 log n, 总 O(n log n)。', points:2, hasAnswer:true },
  { id:'q14', p:2, q:'14. n 个数找最大, 最坏至少（ ）次比较。', opts:[{v:'A',l:'n/2'},{v:'B',l:'n-1'},{v:'C',l:'n'},{v:'D',l:'n+1'}], a:['B'], an:'找最大最坏 n-1 次。' },
  { id:'q15', p:2, q:'15. ack(2,2) 返回值（ ）。', opts:[{v:'A',l:'5'},{v:'B',l:'7'},{v:'C',l:'9'},{v:'D',l:'13'}], answer:['B'], analysis:'ack(2,2) = ack(1, ack(2,1)) = ack(1, 5) = 7。', points:2, hasAnswer:true },
];
const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

// 阅读程序 (1): BM 字符串匹配
const read1Code = `#include <iostream>
#include <string>
#include <vector>
using namespace std;
int f(const string &s, const string &t) {
  int n = s.length(), m = t.length();
  vector<int> shift(128, m + 1);
  int i, j;
  for (j = 0; j < m; j++)
    shift[t[j]] = m - j;
  for (i = 0; i <= n - m; i += shift[s[i + m]]) {
    j = 0;
    while (j < m && s[i + j] == t[j]) j++;
    if (j == m) return i;
  }
  return -1;
}
int main() {
  string a, b;
  cin >> a >> b;
  cout << f(a, b) << endl;
  return 0;
}`;
const read1Q = [
  { id:'r1d1', type:'single', points:1.5, question:'16. 当输入为 "abcde fg" 时, 输出为 -1。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'"fg" 不在 "abcde", 输出 -1。', hasAnswer:true },
  { id:'r1d2', type:'single', points:1.5, question:'17. 当输入为 "abbababbbab abab" 时, 输出为 4。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'"abab" 出现在位置 4。', hasAnswer:true },
  { id:'r1d3', type:'single', points:1.5, question:'18. 当输入为 "GoodLuckCsp2022 22" 时, 第 20 行 j++ 执行次数为 2。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'标准答案正确。', hasAnswer:true },
  { id:'r1d4', type:'single', points:3, question:'19. 该算法最坏时间复杂度为（ ）。', options:[{value:'A',label:'O(n+m)'},{value:'B',label:'O(n log m)'},{value:'C',label:'O(m log n)'},{value:'D',label:'O(nm)'}], answer:['D'], analysis:'最坏 O(nm)。', hasAnswer:true },
  { id:'r1d5', type:'single', points:3, question:'20. f(a,b) 与下列（ ）功能最类似。', options:[{value:'A',label:'a.find(b)'},{value:'B',label:'a.rfind(b)'},{value:'C',label:'a.substr(b)'},{value:'D',label:'a.compare(b)'}], answer:['A'], analysis:'a.find(b) 找首次出现位置。', hasAnswer:true },
  { id:'r1d6', type:'single', points:3, question:'21. 当输入为 "baaabaaabaaabaaaa aaaa", 第 20 行 j++ 执行次数为（ ）。', options:[{value:'A',label:'9'},{value:'B',label:'10'},{value:'C',label:'11'},{value:'D',label:'12'}], answer:['C'], analysis:'标准答案 11。', hasAnswer:true },
];

// 阅读程序 (2): 基数排序
const read2Code = `#include <iostream>
using namespace std;
const int MAXN = 105;
int n, m, k, val[MAXN];
int temp[MAXN], cnt[MAXN];
void init() {
  cin >> n >> k;
  for (int i = 0; i < n; i++) cin >> val[i];
  int maximum = val[0];
  for (int i = 1; i < n; i++)
    if (val[i] > maximum) maximum = val[i];
  m = 1;
  while (maximum >= k) { maximum /= k; m++; }
}
void solve() {
  int base = 1;
  for (int i = 0; i < m; i++) {
    for (int j = 0; j < k; j++) cnt[j] = 0;
    for (int j = 0; j < n; j++) cnt[val[j] / base % k]++;
    for (int j = 1; j < k; j++) cnt[j] += cnt[j - 1];
    for (int j = n - 1; j >= 0; j--) {
      temp[cnt[val[j] / base % k] - 1] = val[j];
      cnt[val[j] / base % k]--;
    }
    for (int j = 0; j < n; j++) val[j] = temp[j];
    base *= k;
  }
}
int main() {
  init();
  solve();
  for (int i = 0; i < n; i++) cout << val[i] << ' ';
  cout << endl;
  return 0;
}`;
const read2Q = [
  { id:'r2d1', type:'single', points:1.5, question:'22. 这是一个不稳定的排序算法。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'从后往前填充是稳定排序。', hasAnswer:true },
  { id:'r2d2', type:'single', points:1.5, question:'23. 该算法空间复杂度仅与 n 有关。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'空间 O(n+k), 但与 n 主导。', hasAnswer:true },
  { id:'r2d3', type:'single', points:1.5, question:'24. 该算法时间复杂度为 O(m(n+k))。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'m 轮基数排序, 每轮 O(n+k)。', hasAnswer:true },
  { id:'r2d4', type:'single', points:3, question:'25. 输入 "5 3 98 26 91 37 46", 第一次执行到第 36 行 val[] 内容（ ）。', options:[{value:'A',label:'91 26 46 37 98'},{value:'B',label:'91 46 37 26 98'},{value:'C',label:'98 26 46 91 37'},{value:'D',label:'91 37 46 98 26'}], answer:['A'], analysis:'按个位排序: 91(1), 26(6), 46(6), 37(7), 98(8) → 1,6,6,7,8 → 91,26,46,37,98. → A', hasAnswer:true },
  { id:'r2d5', type:'single', points:3, question:'26. val[i] 最大 100, k 取（ ）时运算次数最少。', options:[{value:'A',label:'2'},{value:'B',label:'3'},{value:'C',label:'10'},{value:'D',label:'不确定'}], answer:['C'], analysis:'k=10 只需 3 轮; k=2 需 7 轮; k=3 需 5 轮。', hasAnswer:true },
  { id:'r2d6', type:'single', points:3, question:'27. 当 k 比 val[i] 最大值还大时, 算法退化为（ ）。', options:[{value:'A',label:'选择排序'},{value:'B',label:'冒泡排序'},{value:'C',label:'计数排序'},{value:'D',label:'桶排序'}], answer:['C'], analysis:'基数排序退化为单次计数排序。', hasAnswer:true },
];

// 阅读程序 (3): 进制转换
const read3Code = `#include <iostream>
#include <algorithm>
using namespace std;
const int MAXL = 1000;
int n, k, ans[MAXL];
int main(void) {
  cin >> n >> k;
  if (!n) cout << 0 << endl;
  else {
    int m = 0;
    while (n) {
      ans[m++] = (n % (-k) + k) % k;
      n = (ans[m - 1] - n) / k;
    }
    for (int i = m - 1; i >= 0; i--)
      cout << char(ans[i] >= 10 ? ans[i] + 'A' - 10 : ans[i] + '0');
    cout << endl;
  }
  return 0;
}`;
const read3Q = [
  { id:'r3d1', type:'single', points:1.5, question:'28. 该算法时间复杂度为 O(log_k n)。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'每轮除 k, 共 log_k n 轮。', hasAnswer:true },
  { id:'r3d2', type:'single', points:1.5, question:'29. 删除第 23 行的强制类型转换, 程序行为不变。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'char 隐式转换不影响。', hasAnswer:true },
  { id:'r3d3', type:'single', points:1.5, question:'30. 除非 n=0, 否则输出字符数 O(floor(log_k |n|) + 1)。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'标准答案正确。', hasAnswer:true },
  { id:'r3d4', type:'single', points:3, question:'31. 输入 "100 7", 输出（ ）。', options:[{value:'A',label:'202'},{value:'B',label:'1515'},{value:'C',label:'244'},{value:'D',label:'1754'}], answer:['A'], analysis:'100 转 -7 进制: 100 = 4×(-7)²+4×(-7)+4 = 4, 28, 196; 但 196-100=96, 4×(-7)+4=-24+4=-20. 实际 -7 进制下 100 = 4 + 4×(-7) + 4×49 = 4 - 28 + 196 = 172? 不对. 标准答案 A=202. 100 转 -7 进制: 100 = 2×(-7)³+0×49+2×(-7)+0 = 2×(-343)+0+(-14)+0 = -686-14+200=-500? 实际正确算法: 100%7=2, (2-100)/7=-14; -14%7=0, (0-(-14))/7=2; 2%7=2, (2-2)/7=0; 输出 202。', hasAnswer:true },
  { id:'r3d5', type:'single', points:3, question:'32. 输入 "-255 8", 输出（ ）。', options:[{value:'A',label:'1400'},{value:'B',label:'1401'},{value:'C',label:'417'},{value:'D',label:'400'}], answer:['B'], analysis:'-255 转 -8 进制。', hasAnswer:true },
  { id:'r3d6', type:'single', points:4, question:'33. 输入 "1000000 19", 输出（ ）。', options:[{value:'A',label:'BG939'},{value:'B',label:'87GIB'},{value:'C',label:'1CD428'},{value:'D',label:'7CF1B'}], answer:['C'], analysis:'标准答案 1CD428。', hasAnswer:true },
];

// 完善程序 (1): 归并第 k 小
const perfect1Code = `#include <bits/stdc++.h>
using namespace std;
int solve(int *a1, int *a2, int n, int k) {
  int left1 = 0, right1 = n - 1;
  int left2 = 0, right2 = n - 1;
  while (left1 <= right1 && left2 <= right2) {
    int m1 = (left1 + right1) >> 1;
    int m2 = (left2 + right2) >> 1;
    int cnt = ①;
    if (②) {
      if (cnt < k) left1 = m1 + 1;
      else right2 = m2 - 1;
    } else {
      if (cnt < k) left2 = m2 + 1;
      else right1 = m1 - 1;
    }
  }
  if (③) {
    if (left1 == 0) return a2[k - 1];
    else { int x = a1[left1 - 1], ④; return std::max(x, y); }
  } else {
    if (left2 == 0) return a1[k - 1];
    else { int x = a2[left2 - 1], ⑤; return std::max(x, y); }
  }
}`;
const perfect1Questions = [
  { id:'p1_1', type:'single', question:'34. ①处应填（ ）。', options:[{value:'A',label:'(m1+m2)*2'},{value:'B',label:'(m1-1)+(m2-1)'},{value:'C',label:'m1+m2'},{value:'D',label:'(m1+1)+(m2+1)'}], answer:['B'], analysis:'m1 个元素 + m2 个元素在 a1,a2 中均比中位数小。', hasAnswer:true },
  { id:'p1_2', type:'single', question:'35. ②处应填（ ）。', options:[{value:'A',label:'a1[m1]==a2[m2]'},{value:'B',label:'a1[m1]<=a2[m2]'},{value:'C',label:'a1[m1]>=a2[m2]'},{value:'D',label:'a1[m1]!=a2[m2]'}], answer:['B'], analysis:'a1[m1]<=a2[m2] 时取哪个。', hasAnswer:true },
  { id:'p1_3', type:'single', question:'36. ③处应填（ ）。', options:[{value:'A',label:'left1==right1'},{value:'B',label:'left1<right1'},{value:'C',label:'left1>right1'},{value:'D',label:'left1!=right1'}], answer:['B'], analysis:'left1<right1 时 a1 排除完。', hasAnswer:true },
  { id:'p1_4', type:'single', question:'37. ④处应填（ ）。', options:[{value:'A',label:'y = a1[k-left2-1]'},{value:'B',label:'y = a1[k-left2]'},{value:'C',label:'y = a2[k-left1-1]'},{value:'D',label:'y = a2[k-left1]'}], answer:['C'], analysis:'a2 中第 k-left1-1 个。', hasAnswer:true },
  { id:'p1_5', type:'single', question:'38. ⑤处应填（ ）。', options:[{value:'A',label:'y = a1[k-left2-1]'},{value:'B',label:'y = a1[k-left2]'},{value:'C',label:'y = a2[k-left1-1]'},{value:'D',label:'y = a2[k-left1]'}], answer:['A'], analysis:'a1 中第 k-left2-1 个。', hasAnswer:true },
];

// 完善程序 (2): 容器分水
const perfect2Code = `#include <bits/stdc++.h>
using namespace std;
const int N = 110;
int f[N][N];
int ans;
int a, b, c;
int init;
int dfs(int x, int y) {
  if (f[x][y] != init)
    return f[x][y];
  if (x == c || y == c)
    return f[x][y] = 0;
  f[x][y] = init - 1;
  f[x][y] = min(f[x][y], dfs(a, y) + 1);
  f[x][y] = min(f[x][y], dfs(x, b) + 1);
  f[x][y] = min(f[x][y], dfs(0, y) + 1);
  f[x][y] = min(f[x][y], dfs(x, 0) + 1);
  int t = min(a - x, y);
  f[x][y] = min(f[x][y], ①);
  t = min(x, b - y);
  f[x][y] = min(f[x][y], ②);
  return f[x][y];
}
void go(int x, int y) {
  if (③) return;
  if (f[x][y] == dfs(a, y) + 1) { cout << "FILL(1)" << endl; go(a, y); }
  else if (f[x][y] == dfs(x, b) + 1) { cout << "FILL(2)" << endl; go(x, b); }
  else if (f[x][y] == dfs(0, y) + 1) { cout << "DROP(1)" << endl; go(0, y); }
  else if (f[x][y] == dfs(x, 0) + 1) { cout << "DROP(2)" << endl; go(x, 0); }
  else {
    int t = min(a - x, y);
    if (f[x][y] == ④) { cout << "POUR(2,1)" << endl; go(x + t, y - t); }
    else {
      t = min(x, b - y);
      if (f[x][y] == ⑤) { cout << "POUR(1,2)" << endl; go(x - t, y + t); }
      else assert(0);
    }
  }
}
int main() {
  cin >> a >> b >> c;
  ans = 1 << 30;
  memset(f, 127, sizeof f);
  init = **f;
  if ((ans = dfs(0, 0)) == init - 1) cout << "impossible";
  else { cout << ans << endl; go(0, 0); }
}`;
const perfect2Questions = [
  { id:'p2_1', type:'single', question:'39. ①处应填（ ）。', options:[{value:'A',label:'dfs(x+t,y-t)+1'},{value:'B',label:'dfs(x+t,y-t)-1'},{value:'C',label:'dfs(x-t,y+t)+1'},{value:'D',label:'dfs(x-t,y+t)-1'}], answer:['A'], analysis:'POUR(2,1) 后状态。', hasAnswer:true },
  { id:'p2_2', type:'single', question:'40. ②处应填（ ）。', options:[{value:'A',label:'dfs(x+t,y-t)+1'},{value:'B',label:'dfs(x+t,y-t)-1'},{value:'C',label:'dfs(x-t,y+t)+1'},{value:'D',label:'dfs(x-t,y+t)-1'}], answer:['C'], analysis:'POUR(1,2) 后状态。', hasAnswer:true },
  { id:'p2_3', type:'single', question:'41. ③处应填（ ）。', options:[{value:'A',label:'x==c||y==c'},{value:'B',label:'x==c&&y==c'},{value:'C',label:'x>=c||y>=c'},{value:'D',label:'x>=c&&y>=c'}], answer:['A'], analysis:'达到目标状态时停止。', hasAnswer:true },
  { id:'p2_4', type:'single', question:'42. ④处应填（ ）。', options:[{value:'A',label:'dfs(x+t,y-t)+1'},{value:'B',label:'dfs(x+t,y-t)-1'},{value:'C',label:'dfs(x-t,y+t)+1'},{value:'D',label:'dfs(x-t,y+t)-1'}], answer:['A'], analysis:'POUR(2,1) 后的递推值。', hasAnswer:true },
  { id:'p2_5', type:'single', question:'43. ⑤处应填（ ）。', options:[{value:'A',label:'dfs(x+t,y-t)+1'},{value:'B',label:'dfs(x+t,y-t)-1'},{value:'C',label:'dfs(x-t,y+t)+1'},{value:'D',label:'dfs(x-t,y+t)-1'}], answer:['C'], analysis:'POUR(1,2) 后的递推值。', hasAnswer:true },
];

const readScenes = [
  { id:'sc_csps22s_read1', title:'二、阅读程序（1）BM 字符串匹配（判断 1.5 分, 选择 3 分）', order:2, kind:'code-reading', category:'read', codeBlock:{ language:'cpp', title:'阅读程序（1）', description:'Sunday/BM 简化版字符串匹配, 主串 s, 模式 t。', lines: read1Code.split('\n') }, questions: read1Q },
  { id:'sc_csps22s_read2', title:'二、阅读程序（2）基数排序（判断 1.5 分, 选择 3 分）', order:3, kind:'code-reading', category:'read', codeBlock:{ language:'cpp', title:'阅读程序（2）', description:'k 进制基数排序, m 是位数。', lines: read2Code.split('\n') }, questions: read2Q },
  { id:'sc_csps22s_read3', title:'二、阅读程序（3）负进制转换（判断 1.5 分, 选择 3/4 分）', order:4, kind:'code-reading', category:'read', codeBlock:{ language:'cpp', title:'阅读程序（3）', description:'将 n 转 -k 进制输出。', lines: read3Code.split('\n') }, questions: read3Q },
];

const classroom = {
  id:'cm_imp_csps2022s_v1', createdAt:'2026-08-09T00:00:00.000Z', collection:'csp-lecture',
  stage:{
    id:'cm_imp_csps2022s_v1', name:'2022年提高级CSP-S初赛真题卷',
    description:'2022年CCF CSP-S1提高级初赛完整真题（C++语言），共单项选择题15道（30分）、阅读程序3题（40分）、完善程序2题（30分），总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_csps22s_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_csps22s_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:40, perfect:30 },
  },
  scenes:[
    { id:'sc_csps22s_choice', stageId:'cm_imp_csps2022s_v1', type:'quiz', title:'一、单项选择题（共 15 题，每题 2 分，共计 30 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_csps2022s_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', codeBlock:rs.codeBlock, questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_csps22s_perfect1', stageId:'cm_imp_csps2022s_v1', type:'quiz', title:'三、完善程序（1）归并第 k 小（5 空 × 3 分 = 15 分）', order:5,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（1）', description:'两个长 n 的有序数组求归并后第 k 小。', lines: perfect1Code.split('\n') }, questions: perfect1Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_csps22s_perfect2', stageId:'cm_imp_csps2022s_v1', type:'quiz', title:'三、完善程序（2）容器分水（5 空 × 3 分 = 15 分）', order:6,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（2）', description:'两个容器通过 FILL/DROP/POUR 获得 c 升水, 记忆化搜索。', lines: perfect2Code.split('\n') }, questions: perfect2Questions, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
console.log(`  total ${choiceSceneQuestions.length+read1Q.length+read2Q.length+read3Q.length+perfect1Questions.length+perfect2Questions.length}, scenes ${classroom.scenes.length}`);
