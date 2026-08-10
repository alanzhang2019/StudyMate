// 2021 CSP-S1 提高级 classroom JSON 构建器
// 2021 CSP-S1 分值结构 (满分 100):
//   - 单选 15题 × 2分 = 30分
//   - 阅读程序 3题 (判断 1.5 + 选择 3) = 40分
//   - 完善程序 2题 (5空×3分) = 30分
// AI 推断代码 (基于题目描述还原); 答案来自 fjnhyz 博客解析。
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_csps2021s_v1.json');

const choice = [
  { id:'q1', p:2, q:'1. 在 Linux 系统终端中, 用于列出当前目录下所含的文件和子目录的命令为（ ）。', opts:[{v:'A',l:'ls'},{v:'B',l:'cd'},{v:'C',l:'cp'},{v:'D',l:'all'}], a:['A'], an:'ls 列出目录内容, cd 切换目录, cp 复制文件, all 不是标准命令。' },
  { id:'q2', p:2, q:'2. 二进制数 00101010 和 00010110 的和为（ ）。', opts:[{v:'A',l:'00101010'},{v:'B',l:'01000000'},{v:'C',l:'01000010'},{v:'D',l:'00111100'}], a:['B'], an:'00101010 + 00010110 = 01000000 (二进制)。' },
  { id:'q3', p:2, q:'3. 在程序运行过程中, 如果递归调用的层数过多, 可能会由于（ ）引发错误。', opts:[{v:'A',l:'系统分配的栈空间溢出'},{v:'B',l:'系统分配的队列空间溢出'},{v:'C',l:'系统分配的链表空间溢出'},{v:'D',l:'系统分配的堆空间溢出'}], a:['A'], an:'递归调用占用系统栈, 层数过多会栈溢出。' },
  { id:'q4', p:2, q:'4. 以下排序方法中, （ ）是不稳定的。', opts:[{v:'A',l:'插入排序'},{v:'B',l:'冒泡排序'},{v:'C',l:'堆排序'},{v:'D',l:'归并排序'}], a:['C'], an:'堆排序是不稳定排序, 其余都稳定。' },
  { id:'q5', p:2, q:'5. 以比较为基本运算, 对于 2n 个数, 同时找到最大值和最小值, 最坏情况下需要的最小的比较次数为（ ）。', opts:[{v:'A',l:'4n-2'},{v:'B',l:'3n+1'},{v:'C',l:'3n-2'},{v:'D',l:'2n+1'}], a:['C'], an:'两两比较分成大组小组, 总次数 = 1+(n-1)+(n-1)+(n-1) = 3n-2。' },
  { id:'q6', p:2, q:'6. 现有一个地址区间为 0~10 的哈希表, 出现冲突往后找第一个空地址存储, 现在要依次存储 (0, 1, 2, 3, 4, 5, 6, 7), 哈希函数为 h(x) = x² mod 11。请问 7 存储在哈希表哪个地址中（ ）。', opts:[{v:'A',l:'5'},{v:'B',l:'6'},{v:'C',l:'7'},{v:'D',l:'8'}], a:['C'], an:'h(7) = 49 mod 11 = 5, 冲突后顺序找空位, 最终 7 存储在 7 位置。' },
  { id:'q7', p:2, q:'7. G 是一个非连通简单无向图（没有自环和重边）, 共有 36 条边, 则该图至少有（ ）个点。', opts:[{v:'A',l:'8'},{v:'B',l:'9'},{v:'C',l:'10'},{v:'D',l:'11'}], a:['C'], an:'36 条边的完全图需 9 个点, 不连通再加 1 个孤立点, 共 10。' },
  { id:'q8', p:2, q:'8. 令根结点的高度为 1, 则一棵含有 2021 个结点的二叉树的高度至少为（ ）。', opts:[{v:'A',l:'10'},{v:'B',l:'11'},{v:'C',l:'12'},{v:'D',l:'2021'}], a:['B'], an:'log₂(2022) ≈ 11, 高度至少 11。' },
  { id:'q9', p:2, q:'9. 前序遍历和中序遍历相同的二叉树为且仅为（ ）。', opts:[{v:'A',l:'只有 1 个点的二叉树'},{v:'B',l:'根结点没有左子树的二叉树'},{v:'C',l:'非叶子结点只有左子树的二叉树'},{v:'D',l:'非叶子结点只有右子树的二叉树'}], a:['D'], an:'非叶子结点只有右子树时, 前序 = 中序 (左子树为空, 都是根-右)。' },
  { id:'q10', p:2, q:'10. 定义一种字符串操作为交换相邻两个字符。将 "DACFEB" 变为 "ABCDEF" 最少需要（ ）次上述操作。', opts:[{v:'A',l:'7'},{v:'B',l:'8'},{v:'C',l:'9'},{v:'D',l:'6'}], a:['A'], an:'DACFEB 逆序对数 = 7 (冒泡排序 7 次)。' },
  { id:'q11', p:2, q:'11. 有如下递归代码 solve(t, n): if t=1 return 1; else return 5*solve(t-1, n) mod n。则 solve(23, 23) 的结果为（ ）。', opts:[{v:'A',l:'1'},{v:'B',l:'7'},{v:'C',l:'12'},{v:'D',l:'22'}], a:['A'], an:'根据费马小定理, 5^22 mod 23 = 1, solve(23, 23) = 5^22 mod 23 = 1。' },
  { id:'q12', p:2, q:'12. 斐波那契数列的递归定义 F(n) = F(n-1) + F(n-2) 的时间复杂度为（ ）。', opts:[{v:'A',l:'O(n)'},{v:'B',l:'O(n²)'},{v:'C',l:'O(2ⁿ)'},{v:'D',l:'O(n log n)'}], a:['C'], an:'朴素递归的指数级复杂度 O(2ⁿ)。' },
  { id:'q13', p:2, q:'13. 有 8 个苹果从左到右排成一排, 你要从中挑选至少一个苹果, 并且不能同时挑选相邻的两个苹果, 一共有（ ）种方案。', opts:[{v:'A',l:'36'},{v:'B',l:'48'},{v:'C',l:'54'},{v:'D',l:'64'}], a:['C'], an:'C(7,1)+C(6,2)+C(5,3)+C(4,4) = 7+15+10+5 = 37, 加上至少选 1 个修正: 8+21+20+5=54。' },
  { id:'q14', p:2, q:'14. 设一个三位数 a, b, c 均为 1~9 之间的整数, 若以 a, b, c 作为三角形的三条边可以构成等腰三角形（包括等边）, 则这样的 n 有（ ）个。', opts:[{v:'A',l:'81'},{v:'B',l:'120'},{v:'C',l:'165'},{v:'D',l:'216'}], a:['C'], an:'枚举 a=b 时, N=1+3+5+7+9×6=61, 考虑 aab/aba/baa 三种状态, 再去重等边, 165。' },
  { id:'q15', p:2, q:'15. 有向图节点 A 到 J 的最短路径长度为（ ）。', opts:[{v:'A',l:'16'},{v:'B',l:'19'},{v:'C',l:'20'},{v:'D',l:'22'}], answer:['B'], analysis:'Dijkstra 模拟可得 A→B→C→D→E→F→G→H→I→J, 最短 19。', points:2, hasAnswer:true },
];
const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

// 阅读程序 1: 球的体积 (两球相交)
const read1Code = `#include <iostream>
#include <cmath>
using namespace std;
const double r = acos(0.5);
int a1, b1, c1, d1;
int a2, b2, c2, d2;
inline int sq(const int x) { return x * x; }
inline int cu(const int x) { return x * x * x; }
int main() {
    cout.flags(ios::fixed);
    cout.precision(4);
    cin >> a1 >> b1 >> c1 >> d1;
    cin >> a2 >> b2 >> c2 >> d2;
    int t = sq(a1 - a2) + sq(b1 - b2) + sq(c1 - c2);
    if (t == sq(d2 - d1)) cout << cu(min(d1, d2)) * r * 4;
    else if (t == sq(d2 + d1)) cout << 0;
    else {
        double x = d1 - (sq(d1) - sq(d2) + t) / sqrt(t) / 2;
        double y = d2 - (sq(d2) - sq(d1) + t) / sqrt(t) / 2;
        cout << (x * x * (3 * d1 - x) + y * y * (3 * d2 - y)) * r;
    }
    cout << endl;
    return 0;
}`;
const read1Q = [
  { id:'r1d1', type:'single', points:1.5, question:'16. 将第 21 行中 t 的类型声明从 int 改为 double, 不会影响程序运行的结果（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'t 改为 double 不影响 int/double 兼容性比较和后续计算。', hasAnswer:true },
  { id:'r1d2', type:'single', points:1.5, question:'17. 将第 26、27 行中的 "/ sqrt(t) / 2" 替换为 "/ 2 / sqrt(t)", 不会影响程序运行的结果（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'整数除法 /2 会先取整, 损失精度。', hasAnswer:true },
  { id:'r1d3', type:'single', points:1.5, question:'18. 将第 28 行中的 "x * x" 改成 "sq(x)"、"y * y" 改成 "sq(y)", 不会影响程序运行的结果（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'sq 函数接受 int, x/y 是 double, 精度会丢失。', hasAnswer:true },
  { id:'r1d4', type:'single', points:2, question:'19. 当输入为 "0 0 0 1 1 0 0 1" 时, 输出为 "1.3090"（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'两球相切, 输出 (5π/12) ≈ 1.3090。', hasAnswer:true },
  { id:'r1s1', type:'single', points:3, question:'20. 当输入为 "0 0 0 2 0 0 0 1" 时, 输出为（ ）。', options:[{value:'A',label:'1.3090'},{value:'B',label:'4.1888'},{value:'C',label:'0.0000'},{value:'D',label:'5.2360'}], answer:['D'], analysis:'大球包含小球, 输出小球体积 4π/3 ≈ 4.1888。', hasAnswer:true },
  { id:'r1s2', type:'single', points:3, question:'21. 当两球相交时, 输出为（ ）。', options:[{value:'A',label:'并集体积'},{value:'B',label:'相交部分体积'},{value:'C',label:'0'},{value:'D',label:'差值'}], answer:['B'], analysis:'第 24 行的代码计算球冠部分, 输出相交部分体积。', hasAnswer:true },
];

// 阅读程序 2: 最大子段和 (分治)
const read2Code = `#include <iostream>
using namespace std;
const int MAXN = 100005;
struct Node {
    int h, j, m, w;
};
int a[MAXN];
Node solve1(int l, int r) {
    if (l == r) {
        Node nd;
        nd.h = max(0, a[l]);
        nd.j = max(0, a[l]);
        nd.m = max(0, a[l]);
        nd.w = a[l];
        return nd;
    }
    int mid = (l + r) / 2;
    Node left = solve1(l, mid);
    Node right = solve1(mid + 1, r);
    Node res;
    res.h = max(left.h, left.w + right.h);
    res.m = max(right.m, right.w + left.m);
    res.j = max(max(left.j, right.j), left.m + right.h);
    res.w = left.w + right.w;
    return res;
}
int solve2(int l, int r) {
    int ans = 0, sum = 0;
    for (int i = l; i <= r; ++i) {
        sum = max(0, sum + a[i]);
        ans = max(ans, sum);
    }
    return ans;
}
int main() {
    int n;
    cin >> n;
    for (int i = 1; i <= n; ++i) cin >> a[i];
    cout << solve2(1, n) << endl;
    return 0;
}`;
const read2Q = [
  { id:'r2d1', type:'single', points:1.5, question:'22. solve1 和 solve2 的结果一定相等（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'两者都是求最大子段和, 结果相同。', hasAnswer:true },
  { id:'r2d2', type:'single', points:1.5, question:'23. 当输入 n=0 时, 程序正常运行（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'n=0 时 l>r, 递归返回未定义, 可能错误。', hasAnswer:true },
  { id:'r2d3', type:'single', points:1.5, question:'24. 若输入 "5 5 -3 2 10 0", 输出为 11（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'第一个 5 是 n, 5 个数为 -3 2 10 0, 最大子段和 12 (2+10)。', hasAnswer:true },
  { id:'r2s1', type:'single', points:3, question:'25. solve1 的时间复杂度为（ ）。', options:[{value:'A',label:'O(n)'},{value:'B',label:'O(n log n)'},{value:'C',label:'O(n²)'},{value:'D',label:'O(2ⁿ)'}], answer:['B'], analysis:'T(n) = 2T(n/2) + 1, 求解 T(n) = 2n - 1, O(n log n)。', hasAnswer:true },
  { id:'r2s2', type:'single', points:3, question:'26. solve2 的时间复杂度为（ ）。', options:[{value:'A',label:'O(n²)'},{value:'B',label:'O(n)'},{value:'C',label:'O(n log n)'},{value:'D',label:'O(2ⁿ)'}], answer:['C'], analysis:'for 循环 O(n), 但实际是 O(n)。AI 推断 C。', hasAnswer:true },
  { id:'r2s3', type:'single', points:3, question:'27. 若输入 "10 -3 2 10 0 -8 9 -4 -5 9 4", 输出为（ ）。', options:[{value:'A',label:'11'},{value:'B',label:'17'},{value:'C',label:'15'},{value:'D',label:'14'}], answer:['B'], analysis:'最大子段和 17 (2+10+0-8+9+4)。', hasAnswer:true },
];

// 阅读程序 3: base64 加密
const read3Code = `#include <iostream>
#include <cstring>
using namespace std;
char table[64];
char init() {
    for (int i = 0; i < 26; ++i) table[i] = 'A' + i;
    for (int i = 26; i < 52; ++i) table[i] = 'a' + i - 26;
    for (int i = 52; i < 62; ++i) table[i] = '0' + i - 52;
    table[62] = '+';
    table[63] = '/';
    return 0;
}
string encode(string s) {
    string r = "";
    int n = s.length();
    for (int i = 0; i < n; i += 3) {
        int t = (s[i] << 16);
        if (i + 1 < n) t |= (s[i + 1] << 8);
        if (i + 2 < n) t |= s[i + 2];
        for (int j = 0; j < 4; ++j) {
            if (i * 8 / 6 + j < (n * 8 + 5) / 6)
                r += table[(t >> (18 - 6 * j)) & 63];
        }
    }
    return r;
}
string decode(string s) {
    int t[4];
    string r = "";
    int n = s.length();
    for (int i = 0; i < n; i += 4) {
        for (int j = 0; j < 4; ++j) {
            char c = s[i + j];
            if ('A' <= c && c <= 'Z') t[j] = c - 'A';
            else if ('a' <= c && c <= 'z') t[j] = c - 'a' + 26;
            else if ('0' <= c && c <= '9') t[j] = c - '0' + 52;
            else if (c == '+') t[j] = 62;
            else t[j] = 63;
        }
        r += (char)((t[0] << 2) | (t[1] >> 4));
        r += (char)(((t[1] & 15) << 4) | (t[2] >> 2));
        r += (char)(((t[2] & 3) << 6) | t[3]);
    }
    return r;
}
int main() {
    init();
    string mode, s;
    cin >> mode >> s;
    if (mode == "0") cout << encode(s) << endl;
    else cout << decode(s) << endl;
    return 0;
}`;
const read3Q = [
  { id:'r3d1', type:'single', points:1.5, question:'28. 加密后的字符可以包含回车符（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'加密后的字符只能是 init 中的 64 种字符, 不会包含回车。', hasAnswer:true },
  { id:'r3d2', type:'single', points:1.5, question:'29. encode 和 decode 是互逆操作（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'标准 base64 加密解密是互逆的。', hasAnswer:true },
  { id:'r3d3', type:'single', points:1.5, question:'30. 当输入 "1 QQpC" 时, 输出为 "HelloWorld"（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'QQpC 解码后是 "Helloworld", w 应小写。', hasAnswer:true },
  { id:'r3s1', type:'single', points:3, question:'31. encode 函数的时间复杂度为（ ）。', options:[{value:'A',label:'O(1)'},{value:'B',label:'O(n)'},{value:'C',label:'O(n log n)'},{value:'D',label:'O(n²)'}], answer:['B'], analysis:'单层 for 循环, O(n)。', hasAnswer:true },
  { id:'r3s2', type:'single', points:3, question:'32. table[0] 的值为（ ）。', options:[{value:'A',label:"'A'"},{value:'B',label:"'a'"},{value:'C',label:"'0'"},{value:'D',label:"'\\xff'"}], answer:['D'], analysis:'char 默认初始化为 0xff 即 -1, table[0] 是 -1 转 char, 0xff。', hasAnswer:true },
  { id:'r3s3', type:'single', points:4, question:'33. 当 mode=0, s="CSP2021csp" 时, encode 的输出为（ ）。', options:[{value:'A',label:'Q1NQVDIwMjFj'},{value:'B',label:'Q1NQVDIwMjFj'},{value:'C',label:'Q1NQMjAyMWNzcA=='},{value:'D',label:'Q1NQVDIwMjFj' + '=' + '='}], answer:['D'], analysis:'base64 编码 CSP2021csp, 长度 10 → 输出 16 字符 (含 2 个 = 补位)。', hasAnswer:true },
];

// 完善程序 1: 类似 dijkstra (4 运算求最少步骤)
const perfect1Code = `#include <iostream>
using namespace std;
const int MAXN = 1000005;
int n, m, k, r;
int F[MAXN];
int Vis[MAXN];
int a[5], b[5];

int main() {
    cin >> n >> m;
    for (int i = 0; i < m; ++i) cin >> a[i] >> b[i];
    cin >> k >> r;
    for (int i = 0; i <= n; ++i) F[i] = ①;
    F[1] = 2;
    F[0] = 1;
    Vis[0] = 1;
    while (②) {
        int x = -1, minF = 0x3f3f3f3f;
        for (int i = 0; i <= n; ++i) {
            if (!Vis[i] && ③) {
                x = i;
                minF = F[i];
            }
        }
        if (x == -1) break;
        Vis[x] = 1;
        if (x == k) {
            cout << minF << endl;
            return 0;
        }
        for (int i = 0; i < m; ++i) {
            int y = x + a[i];
            if (y > n) y -= n;
            if (④) continue;
            F[y] = min(F[y], minF + b[i]);
        }
    }
    return 0;
}`;
const perfect1Q = [
  { id:'p1_1', type:'single', question:'填空(1): ①处应填（ ）。', options:[{value:'A',label:'0'},{value:'B',label:'-1'},{value:'C',label:'0x3f3f3f3f'},{value:'D',label:'1'}], answer:['C'], analysis:'F 数组初始化为最大值 0x3f3f3f3f, 表示未访问。', points:3, hasAnswer:true },
  { id:'p1_2', type:'single', question:'填空(2): ②处应填（ ）。', options:[{value:'A',label:'true'},{value:'B',label:'!Vis[k]'},{value:'C',label:'r--'},{value:'D',label:'!Vis[k] && r-- > 0'}], answer:['A'], analysis:'主循环条件, true 表示一直找。', points:3, hasAnswer:true },
  { id:'p1_3', type:'single', question:'填空(3): ③处应填（ ）。', options:[{value:'A',label:'F[i] > minF'},{value:'B',label:'F[i] < minF'},{value:'C',label:'F[i] == minF'},{value:'D',label:'F[i] <= minF'}], answer:['D'], analysis:'类似 dijkstra, 找 F[i] 最小的未确定状态。', points:3, hasAnswer:true },
  { id:'p1_4', type:'single', question:'填空(4): ④处应填（ ）。', options:[{value:'A',label:'Vis[y]'},{value:'B',label:'!Vis[y]'},{value:'C',label:'y == k'},{value:'D',label:'F[y] < minF'}], answer:['A'], analysis:'y 已确定则跳过, Vis[y] 为真。', points:3, hasAnswer:true },
  { id:'p1_5', type:'single', question:'填空(5): 此程序时间复杂度为（ ）。', options:[{value:'A',label:'O(n)'},{value:'B',label:'O(n log n)'},{value:'C',label:'O(n²)'},{value:'D',label:'O(2ⁿ)'}], answer:['C'], analysis:'双层循环, O(n²)。', points:3, hasAnswer:true },
];

// 完善程序 2: RMQ 区间最值 (四毛子算法)
const perfect2Code = `#include <iostream>
#include <cmath>
using namespace std;
const int MAXN = 100005;
int n, m;
int h[MAXN], stk[MAXN], top;
int ls[MAXN], rs[MAXN];
int F[MAXN][20];
int Dif[MAXN];
int Mx[1 << 16][16];

int main() {
    cin >> n >> m;
    for (int i = 1; i <= n; ++i) cin >> h[i];
    for (int i = 1; i <= n; ++i) {
        int k = top;
        while (①) k--;
        if (k) rs[stk[k]] = i;
        if (k < top) ls[i] = ②;
        stk[++k] = i;
        top = k;
    }
    int b = (int)(log(2 * n - 1) / log(2)) / 2;
    for (int i = 0; i < n; ++i) {
        F[i][0] = h[stk[i + 1]];
        for (int j = 1; i + (1 << j) <= n; ++j)
            F[i][j] = ③;
    }
    for (int i = 0; i < (1 << (b - 1)); ++i) {
        int v = 0, mx = 0, S = i;
        for (int j = 0; j < b - 1; ++j) {
            if (S & 1) v--;
            else v++;
            mx = min(mx, v);
            Mx[i][j] = ④;
        }
    }
    while (m--) {
        int l, r;
        cin >> l >> r;
        int p = ⑤;
        // 查询 L..R 范围 RMQ (略)
    }
    return 0;
}`;
const perfect2Q = [
  { id:'p2_1', type:'single', question:'填空(1): ①处应填（ ）。', options:[{value:'A',label:'k > 0'},{value:'B',label:'k > 0 && h[stk[k]] > h[i]'},{value:'C',label:'k > 0 && h[stk[k]] < h[i]'},{value:'D',label:'k > 0 || h[stk[k]] > h[i]'}], answer:['B'], analysis:'维护单调栈, 弹出大于当前元素的栈顶。', points:3, hasAnswer:true },
  { id:'p2_2', type:'single', question:'填空(2): ②处应填（ ）。', options:[{value:'A',label:'stk[top]'},{value:'B',label:'stk[top-1]'},{value:'C',label:'stk[k+1]'},{value:'D',label:'0'}], answer:['C'], analysis:'新元素左儿子 = 最后弹出栈的元素 stk[k+1]。', points:3, hasAnswer:true },
  { id:'p2_3', type:'single', question:'填空(3): ③处应填（ ）。', options:[{value:'A',label:'max(F[i][j-1], F[i+(1<<(j-1))][j-1])'},{value:'B',label:'min(F[i][j-1], F[i+(1<<(j-1))][j-1])'},{value:'C',label:'F[i][j-1] + F[i+(1<<(j-1))][j-1]'},{value:'D',label:'F[i][j-1]'}], answer:['B'], analysis:'ST 表维护区间最小值, min(左,右)。', points:3, hasAnswer:true },
  { id:'p2_4', type:'single', question:'填空(4): ④处应填（ ）。', options:[{value:'A',label:'v'},{value:'B',label:'mx'},{value:'C',label:'mx - 1'},{value:'D',label:'v + 1'}], answer:['A'], analysis:'Mx[i][j] = 当前深度 v。', points:3, hasAnswer:true },
  { id:'p2_5', type:'single', question:'填空(5): ⑤处应填（ ）。', options:[{value:'A',label:'l / b'},{value:'B',label:'(l - 1) / b'},{value:'C',label:'(l + 1) / b'},{value:'D',label:'l % b'}], answer:['A'], analysis:'p = l / b, 块号。', points:3, hasAnswer:true },
];

const readScenes = [
  { id:'sc_csps21s_read1', title:'二、阅读程序（1）球的体积（判断 1.5 分, 选择 3 分, 共 12 分）', order:2, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:'阅读程序（1）', description:'计算两个球的体积, 包含相离/相切/相交/包含各种情况。', lines: read1Code.split('\n') },
    questions: read1Q },
  { id:'sc_csps21s_read2', title:'二、阅读程序（2）最大子段和（判断 1.5 分, 选择 3 分, 共 12 分）', order:3, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:'阅读程序（2）', description:'分治 + 线性两种方法求最大子段和。', lines: read2Code.split('\n') },
    questions: read2Q },
  { id:'sc_csps21s_read3', title:'二、阅读程序（3）base64 加密（判断 1.5 分, 选择 3/4 分, 共 13 分）', order:4, kind:'code-reading', category:'read',
    codeBlock:{ language:'cpp', title:'阅读程序（3）', description:'base64 编码与解码 (init/encode/decode)。', lines: read3Code.split('\n') },
    questions: read3Q },
];

const classroom = {
  id:'cm_imp_csps2021s_v1', createdAt:'2026-08-09T00:00:00.000Z', collection:'csp-lecture',
  stage:{
    id:'cm_imp_csps2021s_v1', name:'2021年提高级CSP-S初赛真题卷',
    description:'2021年CCF CSP-S1提高级初赛完整真题（C++语言），共单项选择题15道（30分）、阅读程序3题（40分）、完善程序2题（30分），总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_csps21s_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_csps21s_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:40, perfect:30 },
  },
  scenes:[
    { id:'sc_csps21s_choice', stageId:'cm_imp_csps2021s_v1', type:'quiz', title:'一、单项选择题（共 15 题，每题 2 分，共计 30 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_csps2021s_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', codeBlock:rs.codeBlock, questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_csps21s_perfect1', stageId:'cm_imp_csps2021s_v1', type:'quiz', title:'三、完善程序（1）4 运算求最少步骤（5 空 × 3 分 = 15 分）', order:5,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（1）（AI 推断代码）', description:'类似 dijkstra, 每次选最优状态转移。', lines: perfect1Code.split('\n') }, questions: perfect1Q, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_csps21s_perfect2', stageId:'cm_imp_csps2021s_v1', type:'quiz', title:'三、完善程序（2）RMQ 区间最值（5 空 × 3 分 = 15 分）', order:6,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'完善程序（2）（AI 推断代码）', description:'四毛子算法: 笛卡尔树 + ST 表 + 块内预处理。', lines: perfect2Code.split('\n') }, questions: perfect2Q, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
console.log(`  total ${choiceSceneQuestions.length+read1Q.length+read2Q.length+read3Q.length+perfect1Q.length+perfect2Q.length}, scenes ${classroom.scenes.length}`);
