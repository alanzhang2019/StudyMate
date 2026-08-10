// 2019 CSP-J1 入门级 classroom JSON 构建器
// 2019 CSP-J1 分值结构 (满分 100):
//   - 单选 15题 × 2分 = 30分
//   - 阅读程序 3题 = 40分 (含判断题 + 单选题)
//   - 完善程序 2题 = 30分 (5+5 填空, 每空 3 分)
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_cspj2019j_v1.json');

const choice = [
  { id:'q1', p:2, q:'1. 中国的国家顶级域名是（ ）。', opts:[{v:'A',l:'.cn'},{v:'B',l:'.ch'},{v:'C',l:'.chn'},{v:'D',l:'.china'}], a:['A'], an:'常识: 中国的国家顶级域名是 .cn。' },
  { id:'q2', p:2, q:'2. 二进制数 11 1011 1001 0111 和 01 0110 1110 1011 进行按位与运算的结果是（ ）。', opts:[{v:'A',l:'01 0010 1000 1011'},{v:'B',l:'01 0010 1001 0011'},{v:'C',l:'01 0010 1000 0001'},{v:'D',l:'01 0010 1000 0011'}], a:['D'], an:'按位与: 1&1=1, 1&0=0, 0&1=0, 0&0=0。逐位与得 01 0010 1000 0011。' },
  { id:'q3', p:2, q:'3. 一个 32 位整型变量占用（ ）个字节。', opts:[{v:'A',l:'32'},{v:'B',l:'128'},{v:'C',l:'4'},{v:'D',l:'8'}], a:['C'], an:'1 字节 = 8 位, 32 位整型 = 32/8 = 4 字节。' },
  { id:'q4', p:2, q:'4. 设有程序段: s=a; for(b=1; b<=c; b++) s=s-1; (a,c 已赋值, c>0) 与之等价的赋值语句是（ ）。', opts:[{v:'A',l:'s = a - c'},{v:'B',l:'s = a - b'},{v:'C',l:'s = s - c'},{v:'D',l:'s = b - c'}], a:['A'], an:'s 初值 a, 循环 c 次每次 -1, 减 c 次, 结果 s = a - c。' },
  { id:'q5', p:2, q:'5. 设有 100 个已排好序的数据元素, 采用折半查找时, 最大比较次数为（ ）。', opts:[{v:'A',l:'7'},{v:'B',l:'10'},{v:'C',l:'6'},{v:'D',l:'8'}], a:['A'], an:'最大比较次数 = ⌊log₂n⌋ + 1 = ⌊log₂100⌋ + 1 = 6 + 1 = 7。' },
  { id:'q6', p:2, q:'6. 链表不具有的特点是（ ）。', opts:[{v:'A',l:'插入删除不需要移动元素'},{v:'B',l:'不必事先估计存储空间'},{v:'C',l:'所需空间与线性表长度成正比'},{v:'D',l:'可随机访问任一元素'}], a:['D'], an:'链表访问第 i 个元素需 O(n) 时间, 不能 O(1) 随机访问, 顺序表才支持随机访问。' },
  { id:'q7', p:2, q:'7. 把 8 个同样的球放在 5 个同样的袋子里, 允许有的袋子空着不放, 共有多少种不同的分法？（ ）', opts:[{v:'A',l:'22'},{v:'B',l:'24'},{v:'C',l:'18'},{v:'D',l:'20'}], a:['C'], an:'将 8 分成不超过 5 份: 1+1+1+1+4, 1+1+1+1+4, 1+1+1+1+4, ... 1个数1种, 2个数4种, 3个数5种, 4个数5种, 5个数3种, 共 18 种。' },
  { id:'q8', p:2, q:'8. 一棵二叉树采用顺序存储结构 (根结点下标 1, 左孩子 2i, 右孩子 2i+1), 则该数组的最大下标至少为（ ）。', opts:[{v:'A',l:'6'},{v:'B',l:'10'},{v:'C',l:'15'},{v:'D',l:'12'}], a:['C'], an:'根 1, 右孩子 3, 右右孩子 7, 右右右孩子 15 (因为是右孩子, 下标 ×2+1 累乘)。最大下标 15。' },
  { id:'q9', p:2, q:'9. 100 以内最大的素数是（ ）。', opts:[{v:'A',l:'89'},{v:'B',l:'97'},{v:'C',l:'91'},{v:'D',l:'93'}], a:['B'], an:'97 是质数 (不被 2,3,5,7,11 整除, 11 > √97); 91=7×13, 93=3×31 不是。' },
  { id:'q10', p:2, q:'10. 319 和 377 的最大公约数是（ ）。', opts:[{v:'A',l:'27'},{v:'B',l:'33'},{v:'C',l:'29'},{v:'D',l:'31'}], a:['C'], an:'欧几里得: 377=1×319+58; 319=5×58+29; 58=2×29+0, gcd=29。' },
  { id:'q11', p:2, q:'11. 小胖减肥: 方案一跑 3km 消耗 300 千卡 (0.5h), 方案二跑 5km 消耗 600 千卡 (1h)。每周一-四 0.5h, 五-日 1h, 最多 21km。每周最多消耗多少千卡（ ）。', opts:[{v:'A',l:'3000'},{v:'B',l:'2500'},{v:'C',l:'2400'},{v:'D',l:'2520'}], a:['C'], an:'方案二每公里 120 千卡更多, 优先方案二: 五六日各跑 5km 共 15km (1800千卡); 还可跑 6km, 选两天跑方案一 (各3km) 共 6km (600千卡)。总 2400 千卡。' },
  { id:'q12', p:2, q:'12. 从 52 张牌 (4 种花色各 13 张) 抽 13 张, 至少（ ）张牌花色一致。', opts:[{v:'A',l:'4'},{v:'B',l:'2'},{v:'C',l:'3'},{v:'D',l:'5'}], a:['A'], an:'鸽巢原理: 4 个巢 13 只鸽子, 13=3×4+1, 至少 1 个巢有 4 只以上。' },
  { id:'q13', p:2, q:'13. 5 位数字车牌, 数字 0,1,8 颠倒不变, 6↔9 互变, 其他颠倒不构成数字。最多有多少车牌倒过来还是自己（ ）。', opts:[{v:'A',l:'60'},{v:'B',l:'125'},{v:'C',l:'75'},{v:'D',l:'100'}], a:['C'], an:'第1位(0,1,8,6,9) 5选→第5位固定; 第2位 5选→第4位固定; 第3位(0,1,8) 3选。5×5×3 = 75。' },
  { id:'q14', p:2, q:'14. 二叉树后序 DGJHEBIFCA, 中序 DBGEHJACIF, 前序为（ ）。', opts:[{v:'A',l:'ABCDEFGHIJ'},{v:'B',l:'ABDEGHJCFI'},{v:'C',l:'ABDEGJHCFI'},{v:'D',l:'ABDEGHJFIC'}], a:['B'], an:'后序末 A 根, 中序 A 分 DBGEHJ|CIF。递归建树: A→B(D, E(G, H(J))), C(F(I))。前序 ABDEGHJCFI。' },
  { id:'q15', p:2, q:'15. 以下哪个奖项是计算机科学领域的最高奖（ ）。', opts:[{v:'A',l:'图灵奖'},{v:'B',l:'鲁班奖'},{v:'C',l:'诺贝尔奖'},{v:'D',l:'普利策奖'}], a:['A'], an:'图灵奖是计算机科学最高奖。' },
];
const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

// 阅读程序 1: 字符串中位置是 n 的约数的小写字母转大写
const read1Code = `#include<cstdio>
#include<cstring>
using namespace std;
char st[100];
int main() {
    scanf("%s", st);
    int n = strlen(st);
    for (int i = 1; i <= n; ++i) {
        if (n % i == 0) {
            char c = st[i - 1];
            if (c >= 'a')
                st[i - 1] = c - 'a' + 'A';
        }
    }
    printf("%s", st);
    return 0;
}`;
const read1Q = [
  { id:'r1d1', type:'single', points:1.5, question:'1. 输入的字符串只能由小写字母或大写字母组成（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'字符串可以包含其他字符, 不限于字母。' },
  { id:'r1d2', type:'single', points:1.5, question:'2. 若将第 8 行的 i = 1 改为 i = 0, 程序运行时会发生错误（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'i=0 时 n%i==0 即 n%0, 触发除零运行时错误。' },
  { id:'r1d3', type:'single', points:1.5, question:'3. 若将第 8 行的 i <= n 改为 i * i <= n, 程序运行结果不会改变（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'改变后会漏掉 n 的大于 √n 的约数 (如 n=10 时 5 和 10), 结果不同。' },
  { id:'r1d4', type:'single', points:1.5, question:'4. 若输入的字符串全部由大写字母组成, 那么输出的字符串跟输入的字符串一样（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'代码只把小写变大写, 全大写不变。' },
  { id:'r1s1', type:'single', points:3, question:'5. 若输入的字符串长度为 18, 那么多字符位置会被改变, 最多（ ）个字符不同。', options:[{value:'A',label:'18'},{value:'B',label:'6'},{value:'C',label:'10'},{value:'D',label:'1'}], answer:['B'], analysis:'18 的约数有 1,2,3,6,9,18 共 6 个, 最多 6 个字符位置可能被改变。' },
  { id:'r1s2', type:'single', points:3, question:'6. 若输入的字符串长度为（ ）, 那么输入与输出相比至多有 36 个字符不同。', options:[{value:'A',label:'36'},{value:'B',label:'100000'},{value:'C',label:'1'},{value:'D',label:'128'}], answer:['B'], analysis:'100000 = 2^5 × 5^5, 约数个数 (5+1)(5+1) = 36。' },
];

// 阅读程序 2: 两列数字映射, 统计未连线数字
const read2Code = `#include<cstdio>
using namespace std;
int n, m;
int a[100], b[100];
int main() {
    scanf("%d%d", &n, &m);
    for (int i = 1; i <= n; ++i)
        a[i] = b[i] = 0;
    for (int i = 1; i <= m; ++i) {
        int x, y;
        scanf("%d%d", &x, &y);
        if (a[x] < y && b[y] < x) {  // 第13行
            if (a[x] > 0)
                b[a[x]] = 0;  // 第15行
            if (b[y] > 0)
                a[b[y]] = 0;
            a[x] = y;
            b[y] = x;
        }
    }
    int ans = 0;
    for (int i = 1; i <= n; ++i) {
        if (a[i] == 0)
            ++ans;
        if (b[i] == 0)
            ++ans;  // 第27行
    }
    printf("%d", ans);
    return 0;
}`;
const read2Q = [
  { id:'r2d1', type:'single', points:1.5, question:'1. 当 m>0 时, 输出的值一定小于 2n（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'两列共 2n 个数字, 连线后未连线的必少于 2n。' },
  { id:'r2d2', type:'single', points:1.5, question:'2. 执行完第 27 行的 ++ans 时, ans 一定是偶数（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'循环过程中 ans 可能为奇数, 如 n=2, 1 2 后 i=1 时 a[1]=2, b[1]=0, ans=1。' },
  { id:'r2d3', type:'single', points:1.5, question:'3. a[i] 和 b[i] 不可能同时大于 0（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'左右两列都有连线的数字, a[i] 和 b[i] 可同时 > 0。如 n=2, 输入 1 2 和 2 1, a[1]=2, b[1]=2。' },
  { id:'r2d4', type:'single', points:1.5, question:'4. 若程序执行到第 13 行时, x 总是小于 y, 那么第 15 行不会被执行（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'第 15 行执行条件是 a[x]>0, 与 x<y 无关。' },
  { id:'r2s1', type:'single', points:3, question:'5. 若 m 个 x 两两不同, 且 m 个 y 两两不同, 则输出的值为（ ）。', options:[{value:'A',label:'2n-2m'},{value:'B',label:'2n+2'},{value:'C',label:'2n-2'},{value:'D',label:'2n'}], answer:['A'], analysis:'m 对不同 x 和 y, 连线 2m 个数字, 未连线 2n-2m 个。' },
  { id:'r2s2', type:'single', points:3, question:'6. 若 m 个 x 两两不同, 且 m 个 y 都相等, 则输出的值为（ ）。', options:[{value:'A',label:'2n-2'},{value:'B',label:'2n'},{value:'C',label:'2m'},{value:'D',label:'2n-2m'}], answer:['A'], analysis:'m 个 y 都相等, 最多连一对, 未连线 2n-2 个。' },
];

// 阅读程序 3: 递归建树, 最小值为根
const read3Code = `#include <iostream>
using namespace std;
const int maxn = 10000;
int n;
int a[maxn];
int b[maxn];
int f(int l, int r, int depth) {
    if (l > r)
        return 0;
    int min = maxn, mink;
    for (int i = l; i <= r; ++i) {
        if (min > a[i]) {
            min = a[i];
            mink = i;
        }
    }
    int lres = f(l, mink - 1, depth + 1);
    int rres = f(mink + 1, r, depth + 1);
    return lres + rres + depth * b[mink];
}
int main() {
    cin >> n;
    for (int i = 0; i < n; ++i)
        cin >> a[i];
    for (int i = 0; i < n; ++i)
        cin >> b[i];
    cout << f(0, n - 1, 1) << endl;
    return 0;
}`;
const read3Q = [
  { id:'r3d1', type:'single', points:1.5, question:'1. 如果 a 数组有重复的数字, 则程序运行时会发生错误（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'有重复数字时, 取第一个最小值, 程序正常运行, 不报错。' },
  { id:'r3d2', type:'single', points:1.5, question:'2. 如果 b 数组全为 0, 则输出为 0（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'结果为 depth × b[mink] 之和, b 全 0 则结果 0。' },
  { id:'r3s1', type:'single', points:4, question:'3. 当 n=100 时, 最坏情况下, 与第 12 行的比较运算执行的次数最接近的是（ ）。', options:[{value:'A',label:'5000'},{value:'B',label:'600'},{value:'C',label:'6'},{value:'D',label:'100'}], answer:['A'], analysis:'最坏: 最小值在端点, 每次长度-1, 比较次数 = 100+99+...+1 = 5050, 最接近 5000。' },
  { id:'r3s2', type:'single', points:4, question:'4. 当 n=100 时, 最好情况下, 与第 12 行的比较运算执行的次数最接近的是（ ）。', options:[{value:'A',label:'100'},{value:'B',label:'6'},{value:'C',label:'5000'},{value:'D',label:'600'}], answer:['D'], analysis:'最好: 最小值在区间中点, 类似快排最好, 比较次数 ≈ n × log₂n = 100 × 6 = 600。' },
  { id:'r3s3', type:'single', points:5, question:'5. 当 n=10 时, 若 b[i]=i+1, 那么输出最大为（ ）。', options:[{value:'A',label:'386'},{value:'B',label:'383'},{value:'C',label:'384'},{value:'D',label:'385'}], answer:['D'], analysis:'让每层都有最大值 b, 即层 k 放最大 b 值。最大结果: 1²+2²+...+10² = 10×11×21/6 = 385。' },
  { id:'r3s4', type:'single', points:5, question:'6. 当 n=100 时, 若 b[i]=1, 那么输出最小为（ ）。', options:[{value:'A',label:'582'},{value:'B',label:'580'},{value:'C',label:'579'},{value:'D',label:'581'}], answer:['B'], analysis:'dp[i] 表示长 i 区间最小层数和, dp[100] = dp[49]+dp[50]+100。逐步递推, 最终 dp[100] = 580。' },
];

// 完善程序 1: 矩阵变幻
const perfect1Code = `#include <cstdio>
using namespace std;
int n;
const int max_size = 1 << 10;
int res[max_size][max_size];
void recursive(int x, int y, int n, int t) {
    if (n == 0) {
        res[x][y] = ①;
        return;
    }
    int step = 1 << (n - 1);
    recursive(②, n - 1, t);
    recursive(x, y + step, n - 1, t);
    recursive(x + step, y, n - 1, t);
    recursive(③, n - 1, !t);
}
int main() {
    scanf("%d", &n);
    recursive(0, 0, ④);
    int size = ⑤;
    for (int i = 0; i < size; i++) {
        for (int j = 0; j < size; j++)
            printf("%d", res[i][j]);
        puts("");
    }
    return 0;
}`;
const perfect1Q = [
  { id:'p1_1', type:'single', question:'填空(1): ①处应填（ ）。', options:[{value:'A',label:'n%2'},{value:'B',label:'0'},{value:'C',label:'t'},{value:'D',label:'1'}], answer:['C'], analysis:'n=0 时, 该位置的值是矩阵左上角值 t。', points:3, hasAnswer:true },
  { id:'p1_2', type:'single', question:'填空(2): ②处应填（ ）。', options:[{value:'A',label:'x-step, y-step'},{value:'B',label:'x, y-step'},{value:'C',label:'x-step, y'},{value:'D',label:'x, y'}], answer:['D'], analysis:'递归对应 4 个子矩阵。左上子矩阵左上角为 (x, y), 即第二参数传 (x, y)。', points:3, hasAnswer:true },
  { id:'p1_3', type:'single', question:'填空(3): ③处应填（ ）。', options:[{value:'A',label:'x-step, y-step'},{value:'B',label:'x+step, y+step'},{value:'C',label:'x-step, y'},{value:'D',label:'x, y-step'}], answer:['B'], analysis:'右下子矩阵左上角为 (x+step, y+step)。', points:3, hasAnswer:true },
  { id:'p1_4', type:'single', question:'填空(4): ④处应填（ ）。', options:[{value:'A',label:'n-1, n%2'},{value:'B',label:'n, 0'},{value:'C',label:'n, n%2'},{value:'D',label:'n-1, 0'}], answer:['B'], analysis:'递归主调用: 变换 n 次 (第三参数 n), 整个矩阵左上角为 0 (第四参数 0)。', points:3, hasAnswer:true },
  { id:'p1_5', type:'single', question:'填空(5): ⑤处应填（ ）。', options:[{value:'A',label:'1<<(n+1)'},{value:'B',label:'1<<n'},{value:'C',label:'n+1'},{value:'D',label:'1<<(n-1)'}], answer:['B'], analysis:'变换 n 次矩阵大小 2^n, 即 1<<n。', points:3, hasAnswer:true },
];

// 完善程序 2: 双关键字计数排序
const perfect2Code = `#include <cstdio>
#include <cstring>
using namespace std;
const int maxn = 10000000;
const int maxs = 10000;
int n;
unsigned a[maxn], b[maxn], res[maxn], ord[maxn];
unsigned cnt[maxs + 1];
int main() {
    scanf("%d", &n);
    for (int i = 0; i < n; ++i)
        scanf("%d%d", &a[i], &b[i]);
    memset(cnt, 0, sizeof(cnt));
    for (int i = 0; i < n; ++i)
        ①;  // 利用 cnt 数组统计数量
    for (int i = 0; i < maxs; ++i)
        cnt[i + 1] += cnt[i];
    for (int i = 0; i < n; ++i)
        ②;  // 记录初步排序结果
    memset(cnt, 0, sizeof(cnt));
    for (int i = 0; i < n; ++i)
        ③;  // 利用 cnt 数组统计数量
    for (int i = 0; i < maxs; ++i)
        cnt[i + 1] += cnt[i];
    for (int i = n - 1; i >= 0; --i)
        ④;  // 记录最终排序结果
    for (int i = 0; i < n; i++)
        printf("%d %d", ⑤);
    return 0;
}`;
const perfect2Q = [
  { id:'p2_1', type:'single', question:'填空(1): ①处应填（ ）。', options:[{value:'A',label:'++cnt[i]'},{value:'B',label:'++cnt[b[i]]'},{value:'C',label:'++cnt[a[i]*maxs+b[i]]'},{value:'D',label:'++cnt[a[i]]'}], answer:['B'], analysis:'先按第二关键字排序, 统计 b[i] 出现次数, 选 B ++cnt[b[i]]。', points:3, hasAnswer:true },
  { id:'p2_2', type:'single', question:'填空(2): ②处应填（ ）。', options:[{value:'A',label:'ord[--cnt[a[i]]] = i'},{value:'B',label:'ord[--cnt[b[i]]] = a[i]'},{value:'C',label:'ord[--cnt[a[i]]] = b[i]'},{value:'D',label:'ord[--cnt[b[i]]] = i'}], answer:['D'], analysis:'ord 存第二关键字排序索引, 按 b[i] 排, 索引为 i, 选 D。', points:3, hasAnswer:true },
  { id:'p2_3', type:'single', question:'填空(3): ③处应填（ ）。', options:[{value:'A',label:'++cnt[b[i]]'},{value:'B',label:'++cnt[a[i]*maxs+b[i]]'},{value:'C',label:'++cnt[a[i]]'},{value:'D',label:'++cnt[i]'}], answer:['C'], analysis:'再按第一关键字排序, 统计 a[i] 出现次数, 选 C ++cnt[a[i]]。', points:3, hasAnswer:true },
  { id:'p2_4', type:'single', question:'填空(4): ④处应填（ ）。', options:[{value:'A',label:'res[--cnt[a[ord[i]]]] = ord[i]'},{value:'B',label:'res[--cnt[b[ord[i]]]] = ord[i]'},{value:'C',label:'res[--cnt[b[i]]] = ord[i]'},{value:'D',label:'res[--cnt[a[i]]] = ord[i]'}], answer:['A'], analysis:'res 存双关键字排序索引, 通过 ord 间接索引, 选 A。', points:3, hasAnswer:true },
  { id:'p2_5', type:'single', question:'填空(5): ⑤处应填（ ）。', options:[{value:'A',label:'a[i], b[i]'},{value:'B',label:'a[res[i]], b[res[i]]'},{value:'C',label:'a[ord[res[i]]], b[ord[res[i]]]'},{value:'D',label:'a[res[ord[i]]], b[res[ord[i]]]'}], answer:['B'], analysis:'res 是最终索引, 输出 a[res[i]], b[res[i]]。', points:3, hasAnswer:true },
];

const readScenes = [
  { id:'sc_cspj19j_read1', title:'二、阅读程序（1）（判断题 1.5 分, 选择题 3 分, 共 12 分）', order:2, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:'阅读程序（1）字符串位置约数处小写转大写', description:'将字符串中下标 (从 1 起) 是 n 约数位置的小写字母转为大写。', lines: read1Code.split('\n') },
    questions: read1Q },
  { id:'sc_cspj19j_read2', title:'二、阅读程序（2）两列数字连线（判断题 1.5 分, 选择题 3 分, 共 12 分）', order:3, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:'阅读程序（2）映射', description:'两列各 n 个数字, 输入 m 对 (x,y), 在保证两边数字连到更大数字的条件下连线, 最终统计未连线的数字数量。', lines: read2Code.split('\n') },
    questions: read2Q },
  { id:'sc_cspj19j_read3', title:'二、阅读程序（3）递归建树（判断题 1.5 分, 选择题 4-5 分, 共 16 分）', order:4, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:'阅读程序（3）递归建树', description:'递归建树, 每次选区间最小值为根, 返回 depth × b[mink] 之和。', lines: read3Code.split('\n') },
    questions: read3Q },
];

const classroom = {
  id:'cm_imp_cspj2019j_v1', createdAt:'2026-08-09T00:00:00.000Z', collection:'csp-lecture',
  stage:{
    id:'cm_imp_cspj2019j_v1', name:'2019年普及组CSP-J初赛真题卷',
    description:'2019年CCF CSP-J1 入门级 C++ 完整真题, 共单项选择题15道(30分)、阅读程序3题(40分, 含判断题与单选题)、完善程序2题(30分, 每题5空×3分), 总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_cspj19j_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练, 熟悉历年真题考点, 讲解清晰且直击要点', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_cspj19j_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教, 擅长总结归纳易错点', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:40, perfect:30 },
  },
  scenes:[
    { id:'sc_cspj19j_choice', stageId:'cm_imp_cspj2019j_v1', type:'quiz', title:'一、单项选择题（共 15 题，每题 2 分，共计 30 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_cspj2019j_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', codeBlock:rs.codeBlock, questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_cspj19j_perfect1', stageId:'cm_imp_cspj2019j_v1', type:'quiz', title:'三、完善程序（1）矩阵变幻（每空 3 分, 共 15 分）', order:5,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（1）矩阵变幻', description:'用递归生成 2^n 阶矩阵, 数字 0/1 替换为 2×2 矩阵, 输出变换 n 次后的矩阵。', lines: perfect1Code.split('\n') }, questions: perfect1Q, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_cspj19j_perfect2', stageId:'cm_imp_cspj2019j_v1', type:'quiz', title:'三、完善程序（2）双关键字计数排序（每空 3 分, 共 15 分）', order:6,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（2）双关键字计数排序', description:'用计数排序对 n 对 10000 以内整数按双关键字从小到大排序。', lines: perfect2Code.split('\n') }, questions: perfect2Q, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
const totalQ = choiceSceneQuestions.length + read1Q.length + read2Q.length + read3Q.length + perfect1Q.length + perfect2Q.length;
console.log(`  total ${totalQ}, scenes ${classroom.scenes.length}`);
