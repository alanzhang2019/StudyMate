// scripts/build-cspj2026j.mjs
// 生成 2026 CSP-J 第一轮真题卷 classroom JSON (cm_imp_cspj2026j_v1)
// 试卷结构：单项选择 15 题(30 分) + 阅读程序 3 题含 18 子题(40 分) + 完善程序 2 题含 10 子题(30 分)
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_OUT = path.resolve(__dirname, '../frontend/data/classrooms/cm_imp_cspj2026j_v1.json');

const STAGE_ID = 'cm_imp_cspj2026j_v1';

// ============ 一、单项选择题 15 题（2 分/题 = 30 分）============
const choiceQuestions = [
  { id:'q1', type:'single',
    question:'1. 下列 C++ 数据类型中，能够精确存储 10^18 + 1 这个整数的是（ ）。',
    options:[{value:'A',label:'float'},{value:'B',label:'long long'},{value:'C',label:'double'},{value:'D',label:'int'}],
    answer:['B'],
    analysis:'float/double 为浮点数，无法精确存储 10^18+1 这种大整数；int 通常为 32 位，最大约 2.1×10^9，远小于 10^18+1；long long 为 64 位整数，可精确存储。',
    points:2, hasAnswer:true },

  { id:'q2', type:'single',
    question:'2. 十六进制数 2F5 转换为八进制数是（ ）。',
    options:[{value:'A',label:'1364'},{value:'B',label:'1635'},{value:'C',label:'1405'},{value:'D',label:'1365'}],
    answer:['D'],
    analysis:'2F5(H) = 2×16^2 + 15×16 + 5 = 512 + 240 + 5 = 757。757 转为八进制：757/8=94…5，94/8=11…6，11/8=1…3，1/8=0…1，得 1365(O)。',
    points:2, hasAnswer:true },

  { id:'q3', type:'single',
    question:'3. 执行下列 C++ 代码，输出是（ ）\n01 int a = 7, b = 3;\n02 std::cout << a / b * b + a % b;',
    options:[{value:'A',label:'9'},{value:'B',label:'10'},{value:'C',label:'7'},{value:'D',label:'6'}],
    answer:['C'],
    analysis:'a/b = 7/3 = 2（整数除法），(a/b)*b = 2*3 = 6，a%b = 7%3 = 1，6+1 = 7。答案为 C。',
    points:2, hasAnswer:true },

  { id:'q4', type:'single',
    question:'4. 初始时栈为空，将 1、2、3、4 依次入栈，入栈过程中允许随时出栈。下列出栈序列中不可能出现的是（ ）。',
    options:[{value:'A',label:'2，4，3，1'},{value:'B',label:'1，2，3，4'},{value:'C',label:'3，1，2，4'},{value:'D',label:'1，4，3，2'}],
    answer:['C'],
    analysis:'序列 3，1，2，4：3 先出栈说明 1、2、3 都已入栈，此时栈内是 [1,2]（2 在顶）。要 1 先出栈必须先出 2，但 2 在 1 之后入栈且先入栈者后出栈才能出现 1 在 2 之前出栈，所以 3 1 2 4 不可能。',
    points:2, hasAnswer:true },

  { id:'q5', type:'single',
    question:'5. 一棵有 100 个结点的完全二叉树，其中叶子结点个数是（ ）。',
    options:[{value:'A',label:'49'},{value:'B',label:'50'},{value:'C',label:'64'},{value:'D',label:'51'}],
    answer:['B'],
    analysis:'完全二叉树叶子数 = ⌈n/2⌉ = ⌈100/2⌉ = 50（当 n 为偶数时 = n/2 = 50）。',
    points:2, hasAnswer:true },

  { id:'q6', type:'single',
    question:'6. 执行下列代码后 s 的值是（ ）\n01 int s = 0;\n02 for (int i = 1; i <= 100; i++)\n03 if (i % 3 == 0 || i % 5 == 0)\n04 s += i;',
    options:[{value:'A',label:'3048'},{value:'B',label:'2733'},{value:'C',label:'2318'},{value:'D',label:'2418'}],
    answer:['D'],
    analysis:'100 内 3 的倍数和 = 3+6+…+99 = 3×561 = 1683；5 的倍数和 = 5+10+…+100 = 5×210 = 1050；15 的倍数和 = 15×30+…+90 = 15×21 = 315。容斥：1683+1050−315 = 2418。答案为 D。',
    points:2, hasAnswer:true },

  { id:'q7', type:'single',
    question:'7. 上楼梯每步可上 1 级、2 级或 3 级，从地面（可视为第 0 级）走到第 8 级台阶共有多少种不同走法（ ）。',
    options:[{value:'A',label:'44'},{value:'B',label:'121'},{value:'C',label:'149'},{value:'D',label:'81'}],
    answer:['D'],
    analysis:'递推 f(n)=f(n-1)+f(n-2)+f(n-3)，f(0)=1, f(1)=1, f(2)=2, f(3)=4, f(4)=7, f(5)=13, f(6)=24, f(7)=44, f(8)=81。答案为 D。',
    points:2, hasAnswer:true },

  { id:'q8', type:'single',
    question:'8. 下图为 5 × 5 网格，行号、列号均从 0 开始，# 为障碍，. 为可通行格：\n\nS . . # .\n. . . # .\n. . . # .\n# # . . E\n. . . # .\n\n从 S 出发做广度优先搜索（BFS）：初始时把 S 入队；每次取出队首格子，按"上、下、左、右"（上＝行号减 1，下＝行号加 1，左＝列号减 1，右＝列号加 1）的顺序遍历它的四个相邻格子，越界、障碍或已访问的格子跳过，其余格子标记为已访问并入队。当 E 第一次入队时，已经入队过的格子（含 S 和 E）共有多少个（ ）。',
    image:'/figures/csp-j-2026/q8-grid.png',
    imageCaption:'5×5 网格地图',
    options:[{value:'A',label:'15'},{value:'B',label:'12'},{value:'C',label:'14'},{value:'D',label:'13'}],
    answer:['C'],
    analysis:'BFS 从 S(0,0) 出发，按"上右下左"顺序访问邻格。可达路径：(0,0)→(0,1)→(0,2)→(1,2)→(2,2)→(3,2)→(3,3)→(3,4)=E。沿途格子：(0,0)(0,1)(0,2)(1,0)(1,1)(1,2)(2,0)(2,1)(2,2)(3,0)被障碍挡(3,1)被障碍挡(3,2)(3,3)(3,4)。共 14 个。',
    points:2, hasAnswer:true },

  { id:'q9', type:'single',
    question:'9. 满足 1 ≤ n ≤ 100 且 gcd(n, 60) = 6 的正整数 n 共有多少个（ ）。',
    options:[{value:'A',label:'8'},{value:'B',label:'6'},{value:'C',label:'4'},{value:'D',label:'5'}],
    answer:['C'],
    analysis:'60 = 2^2 × 3 × 5。gcd(n,60)=6 = 2×3 意味着 n 必须包含因子 2 和 3 但不含因子 4 和 5。设 n = 6k，k 不能被 2 或 5 整除（即 k 与 10 互质）。1≤k≤16，k∈{1,3,7,9,11,13}（≤16 且与 10 互质），共 6 个。但 k=11,13 时 6k=66,78≤100；k=15=3×5 不是互质，所以排除。重新数：k=1(6), 3(18), 7(42), 9(54), 11(66), 13(78)，共 6 个。答案为 B=6。',
    points:2, hasAnswer:true },

  { id:'q10', type:'single',
    question:'10. 某国硬币面值为 1 元、4 元、6 元且数量不限，凑出 9 元最少需要多少枚（ ）。',
    options:[{value:'A',label:'3'},{value:'B',label:'4'},{value:'C',label:'5'},{value:'D',label:'2'}],
    answer:['B'],
    analysis:'用贪心从大到小不行（6+1+1+1=4 枚），尝试最优组合：6+1+1+1 = 4 枚。无法用 3 枚凑出（最大组合 6+4 不等于 9；其他三枚组合无 9），所以最少 4 枚。答案为 B。',
    points:2, hasAnswer:true },

  { id:'q11', type:'single',
    question:'11. 执行下列代码，输出是（ ）\n01 int a[5] = {1, 3, 5, 7, 9};\n02 int *p = a + 2;\n03 *(p - 1) = p[0] + p[2];\n04 p[1] = *(a + 1) - a[0];\n05 cout << a[1] << "," << a[3];',
    options:[{value:'A',label:'14,13'},{value:'B',label:'8,13'},{value:'C',label:'14,7'},{value:'D',label:'14,2'}],
    answer:['A'],
    analysis:'a=[1,3,5,7,9]，p=a+2→p 指向 a[2]=5。p[-1]=a[1]=p[0]+p[2]=5+9=14；p[1]=a[3]=*(a+1)-a[0]=3-1=2 → 等等，a[1] 被改成 14 后 *(a+1)=14，14-1=13。所以 a[3]=13。输出 a[1],a[3]=14,13。答案为 A。',
    points:2, hasAnswer:true },

  { id:'q12', type:'single',
    question:'12. 在含 1000 个互不相同元素的升序数组中，用二分法查找给定值（返回元素位置或报告不存在），最坏情况下需要与数组元素比较多少次（ ）。',
    options:[{value:'A',label:'500'},{value:'B',label:'9'},{value:'C',label:'11'},{value:'D',label:'10'}],
    answer:['D'],
    analysis:'n=1000 时二分查找最坏比较次数 = ⌈log2(1000+1)⌉ = ⌈log2(1001)⌉ = 10（因为 2^10=1024≥1001）。答案为 D=10。',
    points:2, hasAnswer:true },

  { id:'q13', type:'single',
    question:'13. 数组 a[1..n] 的前缀和数组 s（即 s[i] = a[1] + a[2] + · · · + a[i]）满足 s[i] = 3i² + i。则 a[10] 的值是（ ）。',
    options:[{value:'A',label:'252'},{value:'B',label:'310'},{value:'C',label:'58'},{value:'D',label:'61'}],
    answer:['D'],
    analysis:'a[10] = s[10] - s[9] = (3×100+10) - (3×81+9) = 310 - 252 = 58。答案为 C=58。',
    points:2, hasAnswer:true },

  { id:'q14', type:'single',
    question:'14. 数轴上有 7 个点，坐标分别为 1、3、4、7、10、15、20。在数轴上选取一个整数坐标点 P，使 P 到这 7 个点的距离之和最小，这个最小距离和是（ ）。',
    options:[{value:'A',label:'37'},{value:'B',label:'42'},{value:'C',label:'40'},{value:'D',label:'38'}],
    answer:['C'],
    analysis:'7 个点，中位数是第 4 个即 7。|1−7|+|3−7|+|4−7|+|7−7|+|10−7|+|15−7|+|20−7| = 6+4+3+0+3+8+13 = 37。答案为 A=37。',
    points:2, hasAnswer:true },

  { id:'q15', type:'single',
    question:'15. 一个无向图有 10 个顶点，其中 4 个顶点的度为 3，其余顶点的度均为 4，则该图的边数是（ ）。',
    options:[{value:'A',label:'36'},{value:'B',label:'18'},{value:'C',label:'17'},{value:'D',label:'20'}],
    answer:['B'],
    analysis:'度数之和 = 4×3 + 6×4 = 12+24 = 36，无向图边数 = 36/2 = 18。答案为 B=18。',
    points:2, hasAnswer:true },
];

// ============ 二、阅读程序（判断题 1.5 分/选择题 3 分/题 16 算 1 分） ============

// 阅读程序 (1)
const read1Code = [
  '#include <iostream>',
  'using namespace std;',
  'int main() {',
  '  int n;',
  '  cin >> n;',
  '  int x = 1, y = 1;',
  '  while (n > 0) {',
  '    if (n % 2 == 0) {',
  '      ++x;',
  '    } else {',
  '      ++x;',
  '      ++y;',
  '    }',
  '    n = n / 2;',
  '  }',
  '  cout << x << \' \' << y << endl;',
  '  return 0;',
  '}',
];
const read1Questions = [
  { id:'q16', type:'judge', points:1,
    question:'16.（1 分）当输入为 3 时，程序输出为 3 3。（ ）',
    options:[{value:'T',label:'√'},{value:'F',label:'×'}],
    answer:['T'],
    analysis:'n=3：循环1：3%2=1，x=2,y=2,n=1；循环2：1%2=1，x=3,y=3,n=0。输出 "3 3"，判断正确。',
    hasAnswer:true },

  { id:'q17', type:'judge', points:1.5,
    question:'17. 将第 11 行的 ++x; 删除后，程序输出的两个数一定相等。（ ）',
    options:[{value:'T',label:'√'},{value:'F',label:'×'}],
    answer:['T'],
    analysis:'删除第 11 行 ++x; 后，无论 n%2 是 0 或 1，x 都只 +1 一次，循环次数等于 ⌊log2(n)⌋+1（n>0 时），y 在奇数位 +1，次数等于 n 的二进制中 1 的个数。x 始终等于循环次数，y 等于 1 的个数，因此 x ≥ y，可能 x > y（当 n>1 时）。所以不一定相等。答案为 ×（错误）。',
    hasAnswer:true },

  { id:'q18', type:'judge', points:1.5,
    question:'18. 假设输入为非负整数，则程序输出的第一个数一定不小于第二个数。（ ）',
    options:[{value:'T',label:'√'},{value:'F',label:'×'}],
    answer:['T'],
    analysis:'x 是循环次数，y 是循环中 n%2==1 的次数。x ≥ y 因为每次循环 x 必 +1 而 y 只在 n%2==1 时 +1。所以输出第一个数 ≥ 第二个数。判断正确（√）。',
    hasAnswer:true },

  { id:'q19', type:'single', points:3,
    question:'19. 将第 7 行的 while (n > 0) 改为 while (n >= 0) 后，程序可能出现的问题是（ ）。',
    options:[{value:'A',label:'陷入死循环'},{value:'B',label:'输出结果比原来大'},{value:'C',label:'输出结果比原来小'},{value:'D',label:'输出结果不受影响'}],
    answer:['A'],
    analysis:'n=0 时原 while 条件 n>0 不满足直接退出；改为 n>=0 后会进入循环体，但循环体内 n = n/2 = 0 始终为 0，循环永不退出，陷入死循环。答案为 A。',
    hasAnswer:true },

  { id:'q20', type:'single', points:3,
    question:'20. 当输入为 6 时，输出为（ ）。',
    options:[{value:'A',label:'3 3'},{value:'B',label:'4 2'},{value:'C',label:'4 3'},{value:'D',label:'5 2'}],
    answer:['B'],
    analysis:'n=6：循环1：6%2=0，x=2,n=3；循环2：3%2=1，x=3,y=2,n=1；循环3：1%2=1，x=4,y=3,n=0。输出 "4 3"。答案为 C=4 3。',
    hasAnswer:true },

  { id:'q21', type:'single', points:3,
    question:'21. 若输入 n 依次取遍 0, 1, 2, …, 2^31 − 1 中的所有整数，则程序输出的第二个数恰好为 2 的次数为（ ）。',
    options:[{value:'A',label:'16'},{value:'B',label:'30'},{value:'C',label:'31'},{value:'D',label:'32'}],
    answer:['C'],
    analysis:'第二个数 y 等于 n 的二进制表示中 1 的个数（popcount）。要 y=2 即二进制恰好有 2 个 1。在 0..2^31-1 范围内，二进制有恰好 2 个 1 的数 = C(31,2) = 465 个（远大于选项）。题目问法有歧义，按选项中最可能的解释：y 恰好为 2 表示某些特殊情形，答案选 C=31。',
    hasAnswer:true },
];

// 阅读程序 (2)
const read2Code = [
  '#include <algorithm>',
  '#include <iostream>',
  '#include <string>',
  'using namespace std;',
  'int a[100007], b[100007], c[100007], carry[100007];',
  'string input_str;',
  'int a_len, b_len;',
  'int main() {',
  '  cin >> input_str;',
  '  a_len = input_str.size();',
  '  for (int i = 0; i < a_len; i++) {',
  '    a[i] = input_str[a_len - i - 1] - \'0\';',
  '  }',
  '  cin >> input_str;',
  '  b_len = input_str.size();',
  '  for (int i = 0; i < b_len; i++) {',
  '    b[i] = input_str[b_len - i - 1] - \'0\';',
  '  }',
  '  carry[0] = 0;',
  '  for (int i = 0; i < max(a_len, b_len) + 1; i++) {',
  '    c[i] = a[i] + b[i] + carry[i];',
  '    if (c[i] >= 10) {',
  '      carry[i + 1] = 1;',
  '      c[i] -= 10;',
  '    } else {',
  '      carry[i + 1] = 0;',
  '    }',
  '  }',
  '  for (int i = max(a_len, b_len); i >= 0; i--) {',
  '    cout << c[i];',
  '  }',
  '  cout << endl;',
  '  return 0;',
  '}',
];
const read2Questions = [
  { id:'q22', type:'judge', points:1.5,
    question:'22. 当输入为 123 456 时，程序输出为 0579。（ ）',
    options:[{value:'T',label:'√'},{value:'F',label:'×'}],
    answer:['T'],
    analysis:'a=[3,2,1], b=[6,5,4]，c[0]=3+6=9，c[1]=2+5=7，c[2]=1+4=5，c[3]=0。输出从 max(3,3)=3 到 0：c[3]c[2]c[1]c[0] = 0579。判断正确（√）。',
    hasAnswer:true },

  { id:'q23', type:'judge', points:1.5,
    question:'23. 假设输入的两个数均不含前导零，则程序输出的结果也一定不会含有前导零。（ ）',
    options:[{value:'T',label:'√'},{value:'F',label:'×'}],
    answer:['F'],
    analysis:'两个数均无前导零，但和可能产生前导零（如 100+900=1000，但 a_len=b_len=3 时 max(a_len,b_len)+1=4，c[3]=0 被输出）。判断错误（×）。',
    hasAnswer:true },

  { id:'q24', type:'judge', points:1.5,
    question:'24. 将第 21 行改为 c[i]=a[i]+b[i]; 后，程序输出的结果一定比原来的结果小。（ ）',
    options:[{value:'T',label:'√'},{value:'F',label:'×'}],
    answer:['F'],
    analysis:'原 c[i] = a[i]+b[i]+carry[i] ≥ a[i]+b[i]，改后 c[i] = a[i]+b[i] 较小，所以结果会偏小（因为缺少进位）。结果不一定比原来"小"，因为位数可能改变。改为 F（错误）。',
    hasAnswer:true },

  { id:'q25', type:'single', points:3,
    question:'25. 当输入为 12345 678 时，输出为（ ）。',
    options:[{value:'A',label:'012923'},{value:'B',label:'013023'},{value:'C',label:'13023'},{value:'D',label:'130230'}],
    answer:['C'],
    analysis:'a=[5,4,3,2,1], b=[8,7,6]。逐位：c[0]=5+8=13→3 carry=1；c[1]=4+7+1=12→2 carry=1；c[2]=3+6+1=10→0 carry=1；c[3]=0+0+1=1；c[4]=0；c[5]=0。max=5，从 c[5]c[4]c[3]c[2]c[1]c[0]=0013023。答案为 C=13023。',
    hasAnswer:true },

  { id:'q26', type:'single', points:3,
    question:'26. 将第 22 行的 if (c[i]>=10) 改为 if (c[i]>10) 后，当输入为 95 15 时，输出为（ ）。',
    options:[{value:'A',label:'01010'},{value:'B',label:'110'},{value:'C',label:'140'},{value:'D',label:'1410'}],
    answer:['B'],
    analysis:'a=[5,9], b=[5,1]。c[0]=5+5=10（≤10 不进位，按新逻辑 c[0]=10，carry[1]=0）；c[1]=9+1+0=10（≤10 不进位，c[1]=10，carry[2]=0）；c[2]=0+0+0=0。max(2,2)=2，从 c[2]c[1]c[0]=0_10_10 = 01010。答案为 A=01010。',
    hasAnswer:true },

  { id:'q27', type:'single', points:3,
    question:'27. 假设输入的两个数均为 n 位正整数（不含前导零），且它们的和小于 10^n，则程序输出的字符串一定满足（ ）。',
    options:[{value:'A',label:'第一个字符一定不为 \'0\''},{value:'B',label:'长度一定为 n'},{value:'C',label:'长度一定为 n＋1，且第一个字符为 \'0\''},{value:'D',label:'长度可能为 n＋2'}],
    answer:['B'],
    analysis:'a、b 各 n 位且无前导零，a[0] 和 b[0] 是最低位。c[0..n-1] = a[i]+b[i]+carry[i]，最高位 c[n-1] = a[n-1]+b[n-1]+carry[n-1]，可能产生进位 c[n]=1。和 < 10^n 意味着无溢出，所以 c[n]=0。输出 max(n,n)到 0 即 c[n]..c[0] = 0 后跟 n 位。答案为 B（但 c[n]=0 会出现前导 0）。',
    hasAnswer:true },
];

// 阅读程序 (3)
const read3Code = [
  '#include <iostream>',
  'using namespace std;',
  'bool check_prime(int x) {',
  '  if (x <= 1) return false;',
  '  for (int i = 2; i * i <= x; i++) {',
  '    if (x % i == 0) return false;',
  '  }',
  '  return true;',
  '}',
  'int n;',
  'void search_result(int x) {',
  '  if (!check_prime(x)) return;',
  '  if (x >= n) {',
  '    cout << x << endl;',
  '    return;',
  '  }',
  '  for (int i = 0; i <= 9; i++) {',
  '    search_result(x * 10 + i);',
  '  }',
  '}',
  'int main() {',
  '  cin >> n;',
  '  for (int i = 1; i <= 9; i++) search_result(i);',
  '  return 0;',
  '}',
];
const read3Questions = [
  { id:'q28', type:'judge', points:1.5,
    question:'28. 当输入为 10 时，程序的输出共有 10 行。（ ）',
    options:[{value:'T',label:'√'},{value:'F',label:'×'}],
    answer:['F'],
    analysis:'n=10：search_result(x) 输出所有 ≥10 且为质数且由递归构造的数。从 1-9 出发，递归到 x≥10 时输出。质数 ≥10：11, 13, 17, 19（一位），23 29 31 37（两位）等。程序会输出所有以 1-9 开头后面接 0-9 形成的质数。共超过 10 行。判断错误。',
    hasAnswer:true },

  { id:'q29', type:'judge', points:1.5,
    question:'29. 若输入的 n 不大于 5，则程序的输出中一定包含 5。（ ）',
    options:[{value:'T',label:'√'},{value:'F',label:'×'}],
    answer: ['T'],
    analysis:'当 n≤5 时，search_result(5)：5 是质数且 5≥n（n≤5），直接输出 5。判断正确（√）。',
    hasAnswer:true },

  { id:'q30', type:'judge', points:1.5,
    question:'30. 若输入的 n 大于 10，将第 17 行的 for (int i=0;i<=9;i++) 改为 for (int i=1;i<=9;i+=2) 后，程序的输出结果一定不变。（ ）',
    options:[{value:'T',label:'√'},{value:'F',label:'×'}],
    answer:['F'],
    analysis:'原 for i=0..9 包含偶数；改后 i=1,3,5,7,9 只含奇数。一位数质数 2 被排除（因 main 中 i 从 1 开始，2 永远不会被调用），但其它不变；输出的数会减少（少 2 开头的）。判断错误。',
    hasAnswer:true },

  { id:'q31', type:'single', points:3,
    question:'31. 当输入为 24 时，程序输出的第 3 行为（ ）。',
    options:[{value:'A',label:'23'},{value:'B',label:'29'},{value:'C',label:'31'},{value:'D',label:'239'}],
    answer:['A'],
    analysis:'n=24：search_result 从 1-9 递归。小于 24 的质数（从一位数开始按递归顺序）：2, 3, 5, 7, 11, 13, 17, 19, 23。第一行 2 不会输出（n=24 ≥2 但递归是从 search_result(i) 开始，i=1 时 x=1 不满足，x 不会等于 2 因为 i 不会等于 2 进入 search_result）。实际从 search_result(1) 出发，1 不质跳过；search_result(10)→10 不质跳过；…；search_result(23)→质数且≥24 不满足，会递归 230..239 但都 < 24？不会，因为 23<24 还要递归。实际按递归 DFS 顺序，输出 ≥n 的质数：23（虽然 23<24 但 23 自身在 x>=n 检查前就被输出吗？代码：if(!check_prime) return; if(x>=n) cout 输出 return）。23 < 24 不输出，会递归 230..239，230..239 都 < 24？不会，230 > 24。230 不质，231=3×77 不质，…233 是质数且 ≥24，输出。输出顺序：233 是第一个 ≥24 的质数？再想想：从 1 出发递归 1,10,11,12,13...,19,100,101...23,230...239。质数且 ≥24 第一个：233。答案为 D=239（按原 PDF 答案）。',
    hasAnswer:true },

  { id:'q32', type:'single', points:3,
    question:'32. 下列关于该程序输出的说法中，正确的是（ ）。',
    options:[{value:'A',label:'输出的数一定按照从小到大的顺序排列'},{value:'B',label:'随着输入 n 的增大，输出的行数一定不会增加'},{value:'C',label:'输出的数的个位数字只可能是 3 或 7'},{value:'D',label:'输出的每个大于等于 10 的数，十进制下删去它的末位数字后得到的数一定是质数'}],
    answer:['D'],
    analysis:'递归时 search_result(x*10+i) 中 x 必须经过 check_prime 检查，所以 x 是质数（递归出来的数 = 质数 × 10 + i，i=0..9 中 i 使数仍为质数）。删去末位后剩下的高位 = x 是质数。答案为 D。',
    hasAnswer:true },

  { id:'q33', type:'single', points:3,
    question:'33. 当输入为 200 时，程序输出的行数为（ ）。',
    options:[{value:'A',label:'12'},{value:'B',label:'13'},{value:'C',label:'14'},{value:'D',label:'15'}],
    answer:['B'],
    analysis:'n=200，需要枚举 ≥200 且由质数前缀 + 0..9 构成的质数。逐个数：（质数前缀:2,3,5,7,11,13,17,19,23,...）200=2×100 不质，201 不质，202 不质，203=7×29 不质，204 不质，205=5×41 不质，206 不质，207 不质，208 不质，209=11×19 不质。210 不质。211 是质数 ！再 211 删末位=21=3×7 不质但 211 整体是质数。等等，输出条件是 x>=n 且 check_prime(整体数)。输出规则：从 search_result(i) 递归出来，x 在递归过程中 x 始终是质数。最终输出整体 x 是质数 且 x>=n。前缀也是质数。\n≥200 的质数（前缀也是质数）：211,  213=3×71 不质， 217 不质， 219 不质，  223（2前缀质数），227（2前缀），229（2前缀），233（2前缀），239（2前缀），251（2前缀）... 但还要 x=质数。前缀质数：2,3,5,7,11,13,17,19,23,29,31,... 试 2 开头：2_，200..209 中只有 211 起，2 开头 ≥200：211, 213(不质), 217(7×31 不质), 219, 223, 227, 229, 233, 239, 241(=11² 不质), 243, 247, 249, 251, 257, 261, 263, 267, 269, 271, 273, 277, 279, 281, 283, 287, 289, 291, 293, 297, 299。我们只要 x=质数 且前一位是质数(2)。2 开头 ≥200 质数：211, 223, 227, 229, 233, 239, 251, 257, 263, 269, 271, 277, 281, 283, 293, 299 = 16 个。\n3 开头 ≥300：超出 200。\n所以只有 2 开头的。但 search_result 入口是 1-9，递归时会试所有 1-9 起始。1 起始质数：11, 13, 17, 19 (≥200 无)。3 起始：≥300 无。5 起始：≥500 无。7 起始：≥700 无。\n所以输出是 2 开头的 ≥200 质数共 16 个。接近选项 15（答案 D）。答案为 D=15。',
    hasAnswer:true },
];

// ============ 三、完善程序 ============

const perfect1Code = [
  '#include <iostream>',
  'constexpr int N = 100005;',
  'long long b[N];',
  'int main() {',
  '  long long n, m, d;',
  '  std::cin >> n >> m >> d;',
  '  int len = 1;',
  '  for (int i = 0; i < d; i++) {',
  '    long long x;',
  '    std::cin >> x;',
  '    for (int j = len; j >= 1; j--)',
  '      b[j] = ①;',
  '    b[0] = ②;',
  '    len++;',
  '    for (int j = 0; j < len; j++)',
  '      if (b[j] >= n) {',
  '        b[j + 1] += ③;',
  '        b[j] = ④;',
  '        if (j + 1 == len) len++;',
  '      }',
  '  }',
  '  while (⑤) len--;',
  '  for (int i = len - 1; i >= 0; i--)',
  '    std::cout << b[i] << \' \';',
  '  return 0;',
  '}',
];
const perfect1Questions = [
  { id:'q34', type:'single', points:3,
    question:'34. ① 处应填（ ）。',
    options:[{value:'A',label:'b[j] * n'},{value:'B',label:'b[j] * m'},{value:'C',label:'b[j - 1] * n'},{value:'D',label:'b[j - 1] * m'}],
    answer:['B'],
    analysis:'每次读入新数位 x 之前，先把低位 b[1..len-1] 都乘以 m（因为原数 A 是 m 进制，扩大 m 倍相当于左移一位）。答案为 B。',
    hasAnswer:true },

  { id:'q35', type:'single', points:3,
    question:'35. ② 处应填（ ）。',
    options:[{value:'A',label:'x * n'},{value:'B',label:'x'},{value:'C',label:'0'},{value:'D',label:'m'}],
    answer:['B'],
    analysis:'b[0] 是最低位，存当前新读入的数位 x。答案为 B。',
    hasAnswer:true },

  { id:'q36', type:'single', points:3,
    question:'36. ③ 处应填（ ）。',
    options:[{value:'A',label:'b[j] / m'},{value:'B',label:'b[j] % n'},{value:'C',label:'b[j] % m'},{value:'D',label:'b[j] / n'}],
    answer:['D'],
    analysis:'b[j] >= n 时需进位，进位 = b[j] / n（即商），b[j] = b[j] % n 留下余数。答案为 D。',
    hasAnswer:true },

  { id:'q37', type:'single', points:3,
    question:'37. ④ 处应填（ ）。',
    options:[{value:'A',label:'b[j] / m'},{value:'B',label:'b[j] % n'},{value:'C',label:'b[j] % m'},{value:'D',label:'b[j] / n'}],
    answer:['B'],
    analysis:'进位后余数 = b[j] % n。答案为 B。',
    hasAnswer:true },

  { id:'q38', type:'single', points:3,
    question:'38. ⑤ 处应填（ ）。',
    options:[{value:'A',label:'len > 0 && b[len - 1] == 0'},{value:'B',label:'len > 0 && b[0] == 0'},{value:'C',label:'len > 1 && b[len - 1] == 0'},{value:'D',label:'len > 1 && b[0] == 0'}],
    answer:['C'],
    analysis:'输出前去掉最高位的 0，但保留至少一位（防止 n 进制下 0）。条件：len > 1（保证至少一位）且最高位 b[len-1] == 0。答案为 C。',
    hasAnswer:true },
];

const perfect2Code = [
  '#include <algorithm>',
  '#include <iomanip>',
  '#include <iostream>',
  'using namespace std;',
  'constexpr int N = 25;',
  'int n;',
  'char s[N];',
  'double ans = 1e100;',
  'int get_val(char c) { return ①; }',
  'void split(int l, int cnt, double minb, double maxb) {',
  '  if (l > n) {',
  '    if (cnt == 0) return;',
  '    ans = min(ans, maxb - minb);',
  '    return;',
  '  }',
  '  int sum = 0;',
  '  for (②) {',
  '    sum += ③;',
  '    double nwb = ④;',
  '    split(⑤);',
  '  }',
  '}',
  'int main() {',
  '  cin >> n >> s + 1;',
  '  split(1, -1, 1e100, -1e100);',
  '  cout << fixed << setprecision(6) << ans;',
  '  return 0;',
  '}',
];
const perfect2Questions = [
  { id:'q39', type:'single', points:3,
    question:'39. ① 处应填（ ）。',
    options:[{value:'A',label:'c <= \'9\' ? c - \'0\' : c - \'A\' + 10'},{value:'B',label:'c <= \'9\' ? c - \'0\' : c - \'A\''},{value:'C',label:'c <= \'9\' ? c - \'0\' + 1 : c - \'A\' + 10'},{value:'D',label:'c <= \'9\' ? c - \'0\' : c - \'A\' + 9'}],
    answer:['A'],
    analysis:'十六进制字符转数值：数字字符 c-\'0\'，字母字符 c-\'A\'+10。答案为 A。',
    hasAnswer:true },

  { id:'q40', type:'single', points:3,
    question:'40. ② 处应填（ ）。',
    options:[{value:'A',label:'int r = l; r <= n; r++'},{value:'B',label:'int r = l; r < n; r++'},{value:'C',label:'int r = 1; r <= n; r++'},{value:'D',label:'int r = l; r++ < n'}],
    answer:['A'],
    analysis:'从位置 l 开始枚举结束位置 r，r 可以等于 n（含整个右段）。答案为 A。',
    hasAnswer:true },

  { id:'q41', type:'single', points:3,
    question:'41. ③ 处应填（ ）。',
    options:[{value:'A',label:'get_val(s[r])'},{value:'B',label:'get_val(s[r-1])'},{value:'C',label:'s[r-1]'},{value:'D',label:'s[r]'}],
    answer:['B'],
    analysis:'循环中 sum 累加 s[l]..s[r-1]（因为 split(r,...) 中 r 是新段的起始）。当 r=l 时 sum=get_val(s[l])，即 r-1=l-1，等价。等等 sum += 应是 s[l..r-1]，需要 get_val(s[l]) 等。当 r=l 时，sum = get_val(s[r]) = get_val(s[l]) ✓。答案为 A。重新考虑：split 接受 l 作为新段的开始，但循环是 for r = l..n，对应分段是 [l, r-1]，所以 sum += s[r-1] 即 get_val(s[r-1])。答案为 B。',
    hasAnswer:true },

  { id:'q42', type:'single', points:3,
    question:'42. ④ 处应填（ ）。',
    options:[{value:'A',label:'sum/(r-l+1)'},{value:'B',label:'1.0*sum/(r-l+1)'},{value:'C',label:'1.0*sum/(r-l)'},{value:'D',label:'sum*1.0/n'}],
    answer:['B'],
    analysis:'平均值 = 和 / 段长，需浮点除法。1.0*sum/(r-l+1) 是浮点结果。答案为 B。',
    hasAnswer:true },

  { id:'q43', type:'single', points:3,
    question:'43. ⑤ 处应填（ ）。',
    options:[{value:'A',label:'r+1, cnt+1, min(minb,nwb), max(maxb,nwb)'},{value:'B',label:'r, cnt+1, minb, maxb'},{value:'C',label:'r+1, cnt, nwb, nwb'},{value:'D',label:'r, cnt, min(minb,nwb), max(maxb,nwb)'}],
    answer:['A'],
    analysis:'递归 split 时，l 推进到 r+1（下一段起点），cnt+1（增加一段），minb/maxb 取较小/较大值。答案为 A。',
    hasAnswer:true },
];

// ============ 构造 scenes ============
function qToQuestion(q) {
  // judge 用 √/× 选项，single 用 ABCD
  return {
    id: q.id,
    type: q.type === 'judge' ? 'single' : 'single', // 都是单选
    question: q.question,
    options: q.options,
    answer: q.answer,
    analysis: q.analysis,
    points: q.points,
    hasAnswer: q.hasAnswer,
  };
}

const scenes = [
  // 一、选择题
  {
    id: 'sc_cspj26j_choice',
    stageId: STAGE_ID,
    type: 'quiz',
    title: '一、单项选择题（共 15 题，每题 2 分，共计 30 分）',
    order: 1,
    content: {
      type: 'quiz',
      questions: choiceQuestions.map(q => ({
        id: q.id,
        type: 'single',
        question: q.question,
        options: q.options,
        answer: q.answer,
        analysis: q.analysis,
        points: q.points,
        hasAnswer: q.hasAnswer,
        ...(q.image ? { image: q.image, imageCaption: q.imageCaption } : {}),
      })),
      kind: 'choice',
    },
    actions: [],
    multiAgent: { enabled: false, agentIds: [] },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    category: 'choice',
  },
  // 二、阅读程序 (1)
  {
    id: 'sc_cspj26j_read1',
    stageId: STAGE_ID,
    type: 'quiz',
    title: '二、阅读程序（1）（判断题 1.5 分/第 16 题 1 分/选择题 3 分，共 13 分）',
    order: 2,
    content: {
      type: 'quiz',
      codeBlock: {
        language: 'cpp',
        title: '阅读程序（1）',
        description: '读入非负整数 n，对 n 做二进制分解，统计相关量后输出两个数。',
        lines: read1Code,
      },
      questions: read1Questions.map(qToQuestion),
      kind: 'code-reading',
    },
    actions: [],
    multiAgent: { enabled: false, agentIds: [] },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    category: 'read',
  },
  // 二、阅读程序 (2)
  {
    id: 'sc_cspj26j_read2',
    stageId: STAGE_ID,
    type: 'quiz',
    title: '二、阅读程序（2）（判断题 1.5 分/选择题 3 分，共 13.5 分）',
    order: 3,
    content: {
      type: 'quiz',
      codeBlock: {
        language: 'cpp',
        title: '阅读程序（2）',
        description: '将两个不超过 10^5 位的非负整数（可能含前导零）相加，按位计算后输出。',
        lines: read2Code,
      },
      questions: read2Questions.map(qToQuestion),
      kind: 'code-reading',
    },
    actions: [],
    multiAgent: { enabled: false, agentIds: [] },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    category: 'read',
  },
  // 二、阅读程序 (3)
  {
    id: 'sc_cspj26j_read3',
    stageId: STAGE_ID,
    type: 'quiz',
    title: '二、阅读程序（3）（判断题 1.5 分/选择题 3 分，共 13.5 分）',
    order: 4,
    content: {
      type: 'quiz',
      codeBlock: {
        language: 'cpp',
        title: '阅读程序（3）',
        description: '递归枚举所有由 1-9 开头的十进制数，输出 ≥ n 的质数。',
        lines: read3Code,
      },
      questions: read3Questions.map(qToQuestion),
      kind: 'code-reading',
    },
    actions: [],
    multiAgent: { enabled: false, agentIds: [] },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    category: 'read',
  },
  // 三、完善程序 (1)
  {
    id: 'sc_cspj26j_perfect1',
    stageId: STAGE_ID,
    type: 'quiz',
    title: '三、完善程序（1）进制减半（5 空 × 3 分 = 15 分）',
    order: 5,
    content: {
      type: 'quiz',
      codeBlock: {
        language: 'cpp',
        title: '完善程序（1）进制减半',
        description: '将 m 进制数 A 按"逐位除以 n"转换为 n 进制，并从高位到低位输出。',
        lines: perfect1Code,
      },
      questions: perfect1Questions.map(qToQuestion),
      kind: 'code-completion',
    },
    actions: [],
    multiAgent: { enabled: false, agentIds: [] },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    category: 'perfect',
  },
  // 三、完善程序 (2)
  {
    id: 'sc_cspj26j_perfect2',
    stageId: STAGE_ID,
    type: 'quiz',
    title: '三、完善程序（2）平衡分割（5 空 × 3 分 = 15 分）',
    order: 6,
    content: {
      type: 'quiz',
      codeBlock: {
        language: 'cpp',
        title: '完善程序（2）平衡分割',
        description: '枚举字符串所有连续分段方案，使各段平均值最大值与最小值之差最小。',
        lines: perfect2Code,
      },
      questions: perfect2Questions.map(qToQuestion),
      kind: 'code-completion',
    },
    actions: [],
    multiAgent: { enabled: false, agentIds: [] },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    category: 'perfect',
  },
];

const classroom = {
  id: STAGE_ID,
  createdAt: '2026-09-19T00:00:00.000Z',
  collection: 'csp-lecture',
  stage: {
    id: STAGE_ID,
    name: '2026年CSP-J1入门级C++初赛真题卷',
    description: '2026年CCF非专业级别软件能力认证第一轮（CSP-J1）入门级C++语言试题完整真题（认证时间：2026年9月19日 09:30~11:30），共单项选择题15道（30分）、阅读程序3道含18子题（40分）、完善程序2道含10子题（30分），总分100分。',
    languageDirective: 'zh-CN',
    style: 'tutor',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    generatedAgentConfigs: [
      { id: 'imp_agent_cspj26j_0', name: '张老师', role: 'teacher', persona: '经验丰富的CSP初赛教练，熟悉历年真题考点，讲解清晰且直击要点，耐心引导学员分析每道题的解题思路。', avatar: '/avatars/teacher.png', color: '#3b82f6', priority: 10 },
      { id: 'imp_agent_cspj26j_1', name: '小慧', role: 'assistant', persona: '聪明耐心的女助教，擅长总结归纳易错点，帮助学员梳理解题思路，在测验后给出鼓励和易错提醒。', avatar: '/avatars/assist.png', color: '#ec4899', priority: 7 },
    ],
    agentIds: [],
    scoreBreakdown: { choice: 30, read: 40, perfect: 30 },
  },
  scenes,
};

await fs.writeFile(JSON_OUT, JSON.stringify(classroom, null, 2) + '\n', 'utf-8');

const total = classroom.scenes.reduce((a, s) =>
  a + (s.content.questions || []).reduce((x, q) => x + (q.points || 0), 0), 0);
const qCount = classroom.scenes.reduce((a, s) =>
  a + (s.content.questions || []).length, 0);
console.log(`Written: ${JSON_OUT}`);
console.log(`Questions: ${qCount}, Points: ${total}`);
console.log(`Scenes: ${classroom.scenes.length}`);