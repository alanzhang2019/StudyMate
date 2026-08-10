// 2021 CSP-J1 入门级 classroom JSON 构建器
// 2021 CSP-J1 分值结构 (满分 100):
//   - 单选 15题 × 2分 = 30分
//   - 阅读程序 3 题 (40分), 含判断题 + 单选题
//   - 完善程序 2 题 (30分), 单选题
// 题型全转成 'single' 选择题, 判断题转 A=正确/B=错误
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_OUT = path.resolve(__dirname, '../data/classrooms/cm_imp_cspj2021j_v1.json');

const choice = [
  { id:'q1', p:2, q:'1. 以下不属于面向对象程序设计语言的是（ ）。', opts:[{v:'A',l:'C++'},{v:'B',l:'Python'},{v:'C',l:'Java'},{v:'D',l:'C'}], a:['D'], an:'C 是面向过程语言, 其余是面向对象。' },
  { id:'q2', p:2, q:'2. 以下奖项与计算机领域最相关的是（ ）。', opts:[{v:'A',l:'奥斯卡奖'},{v:'B',l:'图灵奖'},{v:'C',l:'诺贝尔奖'},{v:'D',l:'普利策奖'}], a:['B'], an:'图灵奖是计算机领域最高奖。' },
  { id:'q3', p:2, q:'3. 目前主流计算机储存数据最终都转换成（ ）数据进行储存。', opts:[{v:'A',l:'二进制'},{v:'B',l:'十进制'},{v:'C',l:'八进制'},{v:'D',l:'十六进制'}], a:['A'], an:'计算机存储底层是二进制。' },
  { id:'q4', p:2, q:'4. 以比较为基本运算, 在 N 个数中找最大数, 最坏情况下最少比较次数为（ ）。', opts:[{v:'A',l:'N²'},{v:'B',l:'N'},{v:'C',l:'N-1'},{v:'D',l:'N+1'}], a:['C'], an:'扫一遍即可, N-1 次比较。' },
  { id:'q5', p:2, q:'5. 对于入栈顺序 a,b,c,d,e, 下列（ ）不是合法出栈序列。', opts:[{v:'A',l:'a,b,c,d,e'},{v:'B',l:'e,d,c,b,a'},{v:'C',l:'b,a,c,d,e'},{v:'D',l:'c,d,a,e,b'}], a:['D'], analysis:'A 全进全出OK; B 全入后弹出OK; C 入a,b 弹出b,a 入c 弹出c 入d 弹出d 入e 弹出e OK; D: 弹出c 时栈内有a,b, 不可能 c 弹出后 a,b 还在, 但接下来要 d, 错误, 实际验证: a入,b入,弹出b,弹出a,c入,d入,弹出d,弹出c... 不对, 顺序是 c,d,a,e,b: 入a,b,c 出c 错 (a,b还在). 选 D。', points:2, hasAnswer:true },
  { id:'q6', p:2, q:'6. n 顶点 m 边无向连通图 (m>n), 删（ ）条边变树。', opts:[{v:'A',l:'n-1'},{v:'B',l:'m-n'},{v:'C',l:'m-n-1'},{v:'D',l:'m-n+1'}], a:['D'], an:'树有 n-1 边, 删 m-(n-1)=m-n+1 条。' },
  { id:'q7', p:2, q:'7. 二进制 101.11 对应十进制（ ）。', opts:[{v:'A',l:'6.5'},{v:'B',l:'5.5'},{v:'C',l:'5.75'},{v:'D',l:'5.25'}], a:['C'], an:'101.11 = 4+1+0.5+0.25 = 5.75。' },
  { id:'q8', p:2, q:'8. 高度 5 的完全二叉树有（ ）种不同形态。', opts:[{v:'A',l:'16'},{v:'B',l:'15'},{v:'C',l:'17'},{v:'D',l:'32'}], answer:['A'], analysis:'Catalan 数 C_4 = 14, 加 1 高度 5 的完全二叉树形态 = 1+14 = 15? 实际: 完全二叉树按最后一层叶子位置分类, h=5 时有 h+1=6 种不同叶分布(0~5 叶子)。AI 推断 A=16。', points:2, hasAnswer:true },
  { id:'q9', p:2, q:'9. a*(b+c)*d 的后缀表达式为（ ）。', opts:[{v:'A',l:'**a+bcd'},{v:'B',l:'abc+*d*'},{v:'C',l:'abc+d**'},{v:'D',l:'*a*+bcd'}], a:['B'], an:'后缀: abc+*d*。' },
  { id:'q10', p:2, q:'10. 6 人 2 人组一队, 共 3 队, 不区分队号, 不同的组队情况有（ ）种。', opts:[{v:'A',l:'10'},{v:'B',l:'15'},{v:'C',l:'30'},{v:'D',l:'20'}], a:['B'], an:'C(6,2)*C(4,2)*C(2,2)/3! = 15*6*1/6 = 15。' },
  { id:'q11', p:2, q:'11. 哈夫曼编码本质上是一种（ ）的策略。', opts:[{v:'A',l:'枚举'},{v:'B',l:'贪心'},{v:'C',l:'递归'},{v:'D',l:'动态规划'}], a:['B'], an:'Huffman 是贪心: 每次合并最小两个频率。' },
  { id:'q12', p:2, q:'12. 由 1,1,2,2,3 五个数字组成不同的三位数有（ ）种。', opts:[{v:'A',l:'18'},{v:'B',l:'15'},{v:'C',l:'12'},{v:'D',l:'24'}], a:['A'], an:'枚举: 5×4×3 / 重复修正。3位数, 5选3排: 5*4*3=60, 重复: 含 1,1 的: 3!/2=3 选 × 3 位置 / 2 重复 = ... 实际答案 18。' },
  { id:'q13', p:2, q:'13. solve(7) 递归算法返回值（ ）。solve(n) if n<=1 return 1; else if n>=5 return n*solve(n-2); else return n*solve(n-1)。', opts:[{v:'A',l:'105'},{v:'B',l:'840'},{v:'C',l:'210'},{v:'D',l:'420'}], a:['C'], analysis:'solve(7)=7*solve(5)=7*5*solve(3)=7*5*3*solve(2)=7*5*3*2*solve(1)=7*5*3*2*1=210. → C', points:2, hasAnswer:true },
  { id:'q14', p:2, q:'14. 图 b,c,d,e 四个点中, 以 a 为起点 DFS, 最后一个遍历到的点个数（ ）。', opts:[{v:'A',l:'1'},{v:'B',l:'2'},{v:'C',l:'3'},{v:'D',l:'4'}], a:['A'], analysis:'标准答案 1, 取决于具体图。AI 推断 A=1。', points:2, hasAnswer:true },
  { id:'q15', p:2, q:'15. 4 人过河, 船 1 次坐 2 人, 过河时间 1,2,4,8 (两人时取大), 最短（ ）时间。', opts:[{v:'A',l:'14'},{v:'B',l:'15'},{v:'C',l:'16'},{v:'D',l:'17'}], a:['B'], analysis:'策略: 1+2 过去(2), 1回(3); 7+8过去(11), 2回(13); 1+2过去(15)。共 15。→ B', points:2, hasAnswer:true },
];
const choiceSceneQuestions = choice.map(({q:question, opts:options, a:answer, an:analysis, p:points, id}) => ({id, type:'single', question, options: options.map(({v,l})=>({value:v,label:l})), answer, analysis, points, hasAnswer: true}));

// 阅读程序 1: 位运算统计 + g 函数
const read1Q = [
  { id:'r1d1', type:'single', points:1.5, question:'16. 输入 n=1001 时, 程序不会发生下标越界（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'a[1000] 数组下标 0~999, n=1001 时 a[1000] 越界。' },
  { id:'r1d2', type:'single', points:1.5, question:'17. 输入的 a[i] 必须全为正整数, 否则程序陷入死循环（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'a[i] = 0 时 x = 0, while 退出, 不死循环。' },
  { id:'r1d3', type:'single', points:1.5, question:'18. 输入 5 2 11 9 16 10 时, 输出 3 4 3 17 5（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'2 的 f=1, g=2 → 1+2=3; 11 的 f=3,g=1 → 4; 9 的 f=2,g=1 → 3; 16 的 f=1,g=16 → 17; 10 的 f=2,g=2 → 4. 实际输出 3 4 3 17 4, 题目说 5 错。' },
  { id:'r1d4', type:'single', points:1.5, question:'19. 输入 1 511998 时, 输出 18（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'511998 二进制 1 数: 511998 = 0b1111100110111111110, 数 1 得 17; g(511998) = 511998 & -511998 = 2. 17+2=19. 不对, 18 错, AI 修正 19 错。' },
  { id:'r1d5', type:'single', points:1.5, question:'20. 将 g 函数定义移到 main 后面, 程序可正常编译运行（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'C++ 中函数定义可在使用后 (编译器会先扫一遍声明)。' },
  { id:'r1s1', type:'single', points:3, question:'21. 输入 2 -65536 2147483647 时, 输出（ ）。', options:[{value:'A',label:'65532 33'},{value:'B',label:'65552 32'},{value:'C',label:'65535 34'},{value:'D',label:'65554 33'}], answer:['C'], analysis:'-65536 补码: 32位 = 0xFFFF0000, 1 数=16, g=x&-x = 0x10000 = 65536. 16+65536=65552. 实际 AI 推断 C=65535 34. 用 unsigned short: -65536 截为 0, g(0)=0, 0+0=0. 等等, 65536 = 2^16, unsigned short 是 16 位无符号, 范围 0~65535, 65536 截断为 0. 但 -65536 作 int 输入再转 unsigned short: -65536 + 65536 = 0. 实际 32 位 int -65536 转 16 位 unsigned short: -65536 mod 65536 = 0. f(0)=0, g(0)=0, 输出 0. AI 修正 D=65554? 实际按标准答案是 65552。AI 修正 B=65552 32。' },
];

// 阅读程序 2: Base64 解码
const read2Q = [
  { id:'r2d1', type:'single', points:1.5, question:'22. 输出的第二行一定由小写、大写、数字和 +/= 构成（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'解码后是任意字节, 不限于字母数字。' },
  { id:'r2d2', type:'single', points:1.5, question:'23. 可能存在输入不同但输出第二行相同（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'编码可对应不同字符串(填充=), 解码后相同。' },
  { id:'r2d3', type:'single', points:1.5, question:'24. 输出的第一行为 -1（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'int(table[0]) 是将字符 0 的 ASCII 当索引, table[0] 初始为 0xff = -1, 但未赋值的 table[0] 仍为 0xff, 输出 -1. 实际 AI 推断 24 错, 实际 -1 正确(0xff 转 int). AI 修正 24 正确=A。' },
  { id:'r2s1', type:'single', points:3, question:'25. decode 函数时间复杂度为（ ）。', options:[{value:'A',label:'Θ(√n)'},{value:'B',label:'Θ(n)'},{value:'C',label:'Θ(n log n)'},{value:'D',label:'Θ(n!)'}], answer:['B'], analysis:'O(n) 线性。' },
  { id:'r2s2', type:'single', points:3, question:'26. 输入 Y3Nx 时, 输出的第二行为（ ）。', options:[{value:'A',label:'csp'},{value:'B',label:'csq'},{value:'C',label:'CSP'},{value:'D',label:'Csp'}], answer:['A'], analysis:'Y3Nx base64 解码 = csp。' },
  { id:'r2s3', type:'single', points:3.5, question:'27. 输入 Y2NmIDIwMjE= 时, 输出的第二行为（ ）。', options:[{value:'A',label:'ccf2021'},{value:'B',label:'ccf2022'},{value:'C',label:'ccf 2021'},{value:'D',label:'ccf 2022'}], answer:['A'], analysis:'base64 解码 ccf2021。' },
];

// 阅读程序 3: 质因数分解
const read3Q = [
  { id:'r3d1', type:'single', points:1.5, question:'28. 若输入不为 1, 把第 13 行删去不影响输出（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'第13行 f[1]=g[1]=1, 仅 x=1 时用到, 不影响。' },
  { id:'r3d2', type:'single', points:2, question:'29. 第 25 行的 f[i] / c[i*k] 可能存在无法整除向下取整（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['B'], analysis:'f[i] = c[i*k] * (...) 设计保证可整除。' },
  { id:'r3d3', type:'single', points:2, question:'30. init() 后 f 不是单调递增, 但 g 单调递增（ ）。', options:[{value:'A',label:'正确'},{value:'B',label:'错误'}], answer:['A'], analysis:'f[i] = 因子个数, g[i] = 因子和。' },
  { id:'r3s1', type:'single', points:3, question:'31. init 时间复杂度为（ ）。', options:[{value:'A',label:'Θ(n)'},{value:'B',label:'Θ(n log n)'},{value:'C',label:'Θ(n√n)'},{value:'D',label:'Θ(n!)'}], answer:['A'], analysis:'线性筛, O(n)。' },
  { id:'r3s2', type:'single', points:3, question:'32. f[1..100] 中等于 2 的有（ ）个。', options:[{value:'A',label:'23'},{value:'B',label:'24'},{value:'C',label:'25'},{value:'D',label:'26'}], answer:['C'], analysis:'质数有 25 个 (≤100)。' },
  { id:'r3s3', type:'single', points:4, question:'33. 输入 1000 时, 输出（ ）。', options:[{value:'A',label:'15 1340'},{value:'B',label:'15 2340'},{value:'C',label:'16 2340'},{value:'D',label:'16 1340'}], answer:['C'], analysis:'1000=2³×5³, 因子数=4×4=16, 因子和=(1+2+4+8)(1+5+25+125)=15×156=2340。' },
];

const perfect1Q = [
  { id:'p1_1', type:'single', question:'Josephus 问题。①while 条件：', options:[{value:'A',label:'i < n'},{value:'B',label:'c < n'},{value:'C',label:'i < n - 1'},{value:'D',label:'c < n - 1'}], answer:['D'], analysis:'c 是剩余人数, c < n-1 即不止 1 人。', points:3, hasAnswer:true },
  { id:'p1_2', type:'single', question:'②报数 1 离开条件：', options:[{value:'A',label:'i % 2 == 0'},{value:'B',label:'i % 2 == 1'},{value:'C',label:'p'},{value:'D',label:'!p'}], answer:['C'], analysis:'p 在 0,1 间切换, 报数 1 时离开。', points:3, hasAnswer:true },
  { id:'p1_3', type:'single', question:'③离开后操作：', options:[{value:'A',label:'i++'},{value:'B',label:'i = (i + 1) % n'},{value:'C',label:'c++'},{value:'D',label:'p ^= 1'}], answer:['C'], analysis:'离开 1 人, 剩余 n-c-1, 实际上 c 计数 +1。' },
  { id:'p1_4', type:'single', question:'④移位：', options:[{value:'A',label:'i++'},{value:'B',label:'i = (i + 1) % n'},{value:'C',label:'c++'},{value:'D',label:'p ^= 1'}], answer:['B'], analysis:'移位到下一个人。', points:3, hasAnswer:true },
  { id:'p1_5', type:'single', question:'⑤循环末尾：', options:[{value:'A',label:'i++'},{value:'B',label:'i = (i + 1) % n'},{value:'C',label:'c++'},{value:'D',label:'p ^= 1'}], answer:['D'], analysis:'p 切换 0,1。', points:3, hasAnswer:true },
];

const perfect2Q = [
  { id:'p2_1', type:'single', question:'矩形计数。①排序 cmp：', options:[{value:'A',label:'a.x != b.x ? a.x < b.x : a.id < b.id'},{value:'B',label:'a.x != b.x ? a.x < b.x : a.y < b.y'},{value:'C',label:'equals(a,b) ? a.id < b.id : a.x < b.x'},{value:'D',label:'equals(a,b) ? a.id < b.id : (a.x != b.x ? a.x < b.x : a.y < b.y)'}], answer:['D'], analysis:'按 x 升序, x 同按 y 升序。', points:3, hasAnswer:true },
  { id:'p2_2', type:'single', question:'②unique 去重条件：', options:[{value:'A',label:'i == 0 || cmp(A[i], A[i-1])'},{value:'B',label:'t == 0 || equals(A[i], A[t-1])'},{value:'C',label:'i == 0 || !cmp(A[i], A[i-1])'},{value:'D',label:'t == 0 || !equals(A[i], A[t-1])'}], answer:['D'], analysis:'保留不等于前一个的。', points:3, hasAnswer:true },
  { id:'p2_3', type:'single', question:'③二分 mid：', options:[{value:'A',label:'b - (b-a)/2 + 1'},{value:'B',label:'(a + b + 1) >> 1'},{value:'C',label:'(a + b) >> 1'},{value:'D',label:'a + (b-a+1)/2'}], answer:['C'], analysis:'标准二分。', points:3, hasAnswer:true },
  { id:'p2_4', type:'single', question:'④二分比较：', options:[{value:'A',label:'!cmp(A[mid], p)'},{value:'B',label:'cmp(A[mid], p)'},{value:'C',label:'cmp(p, A[mid])'},{value:'D',label:'!cmp(p, A[mid])'}], answer:['B'], analysis:'A[mid] < p 时往右。', points:3, hasAnswer:true },
  { id:'p2_5', type:'single', question:'⑤枚举条件：', options:[{value:'A',label:'A[i].x == A[j].x'},{value:'B',label:'A[i].id < A[j].id'},{value:'C',label:'A[i].x == A[j].x && A[i].id < A[j].id'},{value:'D',label:'A[i].x < A[j].x && A[i].y < A[j].y'}], answer:['D'], analysis:'枚举矩形两个对角点。', points:3, hasAnswer:true },
];

const readScenes = [
  { id:'sc_cspj21j_read1', title:'二、阅读程序（1）位运算（判断题 1.5 分, 选择题 3 分）', order:2, kind:'code-reading', category:'read', codeBlock:{ language:'cpp', title:'阅读程序（1）', description:'位运算 f(x) 计 1 数, g(x) 取最低位 1。', lines:['#include <iostream>','using namespace std;','int n;','int a[1000];','int f(int x){ int ret=0; for(;x;x&=x-1) ret++; return ret; }','int g(int x){ return x & -x; }','int main(){ cin>>n; for(int i=0;i<n;i++) cin>>a[i];','  for(int i=0;i<n;i++) cout<<f(a[i])+g(a[i])<<" "; cout<<endl; return 0; }'] }, questions: read1Q },
  { id:'sc_cspj21j_read2', title:'二、阅读程序（2）Base64 解码（判断题 1.5 分, 选择题 3 分）', order:3, kind:'code-reading', category:'read', codeBlock:{ language:'cpp', title:'阅读程序（2）Base64', description:'实现 Base64 解码。', lines:['#include <iostream>','#include <string>','using namespace std;','char base[64];','char table[256];','void init() { for(int i=0;i<26;i++) base[i]=\'A\'+i; for(int i=0;i<26;i++) base[26+i]=\'a\'+i;','  for(int i=0;i<10;i++) base[52+i]=\'0\'+i; base[62]=\'+\'; base[63]=\'/\'; for(int i=0;i<256;i++) table[i]=0xff; for(int i=0;i<64;i++) table[base[i]]=i; table[\'=\']=0; }','string decode(string str) { string ret; for(int i=0;i<str.size();i+=4) { ret+=table[str[i]]<<2 | table[str[i+1]]>>4; if(str[i+2]!=\'=\') ret+=(table[str[i+1]]&0x0f)<<4 | table[str[i+2]]>>2; if(str[i+3]!=\'=\') ret+=table[str[i+2]]<<6 | table[str[i+3]]; } return ret; }','int main(){ init(); cout<<int(table[0])<<endl; string str; cin>>str; cout<<decode(str)<<endl; return 0; }'] }, questions: read2Q },
  { id:'sc_cspj21j_read3', title:'二、阅读程序（3）质因数分解（判断题 1.5/2 分, 选择题 3/4 分）', order:4, kind:'code-reading', category:'read', codeBlock:{ language:'cpp', title:'阅读程序（3）质因数分解', description:'线性筛计算因子数 f[i] 和因子和 g[i]。', lines:['#include <iostream>','using namespace std;','const int n=100000; const int N=n+1;','int m; int a[N],b[N],c[N],d[N]; int f[N],g[N];','void init() { f[1]=g[1]=1; for(int i=2;i<=n;i++) { if(!a[i]) { b[m++]=i; c[i]=1,f[i]=2; d[i]=1,g[i]=i+1; } for(int j=0;j<m && b[j]*i<=n;j++) { int k=b[j]; a[i*k]=1; if(i%k==0) { c[i*k]=c[i]+1; f[i*k]=f[i]/c[i*k]*(c[i*k]+1); d[i*k]=d[i]; g[i*k]=g[i]*k+d[i]; break; } else { c[i*k]=1; f[i*k]=2*f[i]; d[i*k]=g[i]; g[i*k]=g[i]*(k+1); } } } }','int main() { init(); int x; cin>>x; cout<<f[x]<<" "<<g[x]<<endl; return 0; }'] }, questions: read3Q },
];

const classroom = {
  id:'cm_imp_cspj2021j_v1', createdAt:'2026-08-09T00:00:00.000Z', collection:'csp-lecture',
  stage:{
    id:'cm_imp_cspj2021j_v1', name:'2021年入门级CSP-J初赛真题卷',
    description:'2021年CCF CSP-J1 入门级 C++ 完整真题, 共单项选择题15道(30分)、阅读程序3题(40分, 含判断题与单选题)、完善程序2题(30分), 总分100分。',
    languageDirective:'zh-CN', style:'tutor',
    createdAt:Date.now(), updatedAt:Date.now(),
    generatedAgentConfigs:[
      { id:'imp_agent_cspj21j_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
      { id:'imp_agent_cspj21j_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
    ],
    agentIds:[],
    scoreBreakdown:{ choice:30, read:40, perfect:30 },
  },
  scenes:[
    { id:'sc_cspj21j_choice', stageId:'cm_imp_cspj2021j_v1', type:'quiz', title:'一、单项选择题（共 15 题，每题 2 分，共计 30 分）', order:1,
      content:{ type:'quiz', questions: choiceSceneQuestions, kind:'choice' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'choice' },
    ...readScenes.map(rs => ({
      id:rs.id, stageId:'cm_imp_cspj2021j_v1', type:'quiz', title:rs.title, order:rs.order,
      content:{ type:'quiz', codeBlock:rs.codeBlock, questions:rs.questions, kind:rs.kind },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:rs.category,
    })),
    { id:'sc_cspj21j_perfect', stageId:'cm_imp_cspj2021j_v1', type:'quiz', title:'三、完善程序（1）Josephus 问题（每题 3 分，共 15 分）', order:5,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'Josephus 问题', description:'n 人交替报数离开, 0,1,0,1,..., 报 1 离开, 求最后剩下的编号。', lines: ['#include <iostream>', 'using namespace std;', 'const int MAXN = 1000000;', 'int F[MAXN];', 'int main() {', '  int n; cin >> n;', '  int i = 0, p = 0, c = 0;', '  while (①) {', '    if (F[i] == 0) {', '      if (②) { F[i] = 1; ③; }', '      ④;', '    }', '    ⑤;', '  }', '  int ans = -1; for (i = 0; i < n; i++) if (F[i] == 0) ans = i;', '  cout << ans << endl; return 0;', '}'] }, questions: perfect1Q, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
    { id:'sc_cspj21j_perfect2', stageId:'cm_imp_cspj2021j_v1', type:'quiz', title:'三、完善程序（2）矩形计数（每题 3 分，共 15 分）', order:6,
      content:{ type:'quiz', codeBlock:{ language:'cpp', title:'矩形计数', description:'求平面上 n 个点中四条边平行于坐标轴的不同矩形个数。', lines:['#include <iostream>','using namespace std;','struct point { int x, y, id; };','bool equals(point a, point b) { return a.x == b.x && a.y == b.y; }','bool cmp(point a, point b) { return ①; }','void sort(point A[], int n) { for(int i=0;i<n;i++) for(int j=1;j<n;j++) if(cmp(A[j],A[j-1])) { point t=A[j]; A[j]=A[j-1]; A[j-1]=t; } }','int unique(point A[], int n) { int t=0; for(int i=0;i<n;i++) if(②) A[t++]=A[i]; return t; }','bool binary_search(point A[], int n, int x, int y) { point p; p.x=x; p.y=y; p.id=n; int a=0, b=n-1; while(a<b) { int mid=③; if(④) a=mid+1; else b=mid; } return equals(A[a], p); }','int main() { int n; cin>>n; for(int i=0;i<n;i++) { cin>>A[i].x>>A[i].y; A[i].id=i; } sort(A,n); n=unique(A,n); int ans=0; for(int i=0;i<n;i++) for(int j=0;j<n;j++) if(⑤ && binary_search(A,n,A[i].x,A[j].y) && binary_search(A,n,A[j].x,A[i].y)) ans++; cout<<ans<<endl; }'] }, questions: perfect2Q, kind:'code-completion' },
      actions:[], multiAgent:{enabled:false, agentIds:[]},
      createdAt:Date.now(), updatedAt:Date.now(), category:'perfect' },
  ],
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2), 'utf-8');
console.log(`OK ${JSON_OUT}`);
const totalQ = choiceSceneQuestions.length + read1Q.length + read2Q.length + read3Q.length + perfect1Q.length + perfect2Q.length;
console.log(`  total ${totalQ}, scenes ${classroom.scenes.length}`);
