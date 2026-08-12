// Build 2016 CSP-J (adapted to new question format) JSON from PDF.
// 36 questions total: 22 single-choice + 4 read-program + 10 perfect-program.
// Score breakdown: choice 40 (q1-q20 @ 1.5, q21-q22 @ 5) + read 32 (4 x 8) + perfect 28 (5+5) = 100.
const fs = require('fs');

const stageId = 'cm_imp_cspj2016j_v1';

// 22 single-choice questions (40 pts).
// q1-q20 @ 1.5 each = 30, q21-q22 @ 5 each = 10.
const choiceQuestions = [
  { id:'q1', points:1.5,
    q:'1. 以下不是微软公司出品的软件是（ ）。',
    opts:[['A','PowerPoint'],['B','Word'],['C','Excel'],['D','Acrobat Reader']],
    ans:['D'], a:'Acrobat Reader 是 Adobe 公司的产品, PowerPoint/Word/Excel 都是微软出品。' },

  { id:'q2', points:1.5,
    q:'2. 如果 256 种颜色用二进制编码来表示,至少需要（ ）位。',
    opts:[['A','6'],['B','7'],['C','8'],['D','9']],
    ans:['C'], a:'2^7=128 < 256 ≤ 256=2^8, 至少需要 8 位。' },

  { id:'q3', points:1.5,
    q:'3. 以下不属于无线通信技术的是（ ）。',
    opts:[['A','蓝牙'],['B','Wi-Fi'],['C','GPRS'],['D','以太网']],
    ans:['D'], a:'以太网是有线局域网技术, 蓝牙/Wi-Fi/GPRS 都是无线通信。' },

  { id:'q4', points:1.5,
    q:'4. 以下不是 CPU 生产厂家的是（ ）。',
    opts:[['A','Intel'],['B','AMD'],['C','Microsoft'],['D','IBM']],
    ans:['C'], a:'Intel/AMD/IBM 都生产 CPU, 微软只做软件不做硬件。' },

  { id:'q5', points:1.5,
    q:'5. 以下不是存储设备的是（ ）。',
    opts:[['A','光盘'],['B','磁盘'],['C','固态硬盘'],['D','鼠标']],
    ans:['D'], a:'鼠标是输入设备, 其他三项都是存储设备。' },

  { id:'q6', points:1.5,
    q:'6. 如果开始时计算机处于小写输入状态,现在有一只小老鼠反复按照 Caps Lock、字母键 A、字母键 S 和字母键 D 的顺序循环按键,即 Caps Lock、A、S、D、Caps Lock、A、S、D……屏幕上输出的第 81 个字符是字母（ ）。',
    opts:[['A','A'],['B','S'],['C','D'],['D','a']],
    ans:['C'], a:'每 4 步 (CapsLock+A+S+D) 产生 3 个字符, CapsLock 不输出, 奇数轮大写, 偶数轮小写。81=3×27, 第 27 轮 (奇) 第 3 个字符 = 大写 D。' },

  { id:'q7', points:1.5,
    q:'7. 二进制数 00101100 和 00010101 的和是（ ）。',
    opts:[['A','00101000'],['B','01000001'],['C','01000100'],['D','00111000']],
    ans:['B'], a:'00101100 (44) + 00010101 (21) = 01000001 (65)。' },

  { id:'q8', points:1.5,
    q:'8. 与二进制小数 0.1 相等的八进制数是（ ）。',
    opts:[['A','0.8'],['B','0.4'],['C','0.2'],['D','0.1']],
    ans:['B'], a:'0.1 二进制 = 1/2 = 0.4 八进制 (4/8 = 1/2)。' },

  { id:'q9', points:1.5,
    q:'9. 以下属于 32 位机器和 64 位机器的区别的是（ ）。',
    opts:[['A','显示器不同'],['B','硬盘大小不同'],['C','寻址空间不同'],['D','输入法不同']],
    ans:['C'], a:'32 位寻址 2^32 ≈ 4GB, 64 位寻址 2^64, 寻址空间是核心区别。' },

  { id:'q10', points:1.5,
    q:'10. 以下关于字符串的判定语句正确的是（ ）。',
    opts:[['A','字符串是一种特殊的线性表'],['B','串的长度必须大于零'],['C','字符串不可以用数组来表示'],['D','空字符串组成的串就是空串']],
    ans:['A'], a:'字符串是数据元素为字符的线性表, 属于特殊的线性表, 选 A; B 错(空串长度为 0); C 错(可用字符数组存储); D 错(空串是长度 0 的串, 与空格字符无关)。' },

  // q11 needs the tree figure; rendered at /figures/csp-j-2016/q11-tree.png.
  // Tree is 4 levels deep with rightmost leaf at index 15 (sequential storage,
  // 1-indexed, left child = 2i, right child = 2i+1).
  { id:'q11', points:1.5,
    q:'11. 一棵二叉树如右图所示,若采用顺序存储结构,即用一维数组元素存储该二叉树中的节点[根节点的下标为 1,若某节点的下标为 i,则其左孩子位于下标 2i 处,右孩子位于下标（2i+1）处],则图中所有节点的最大下标为（ ）。',
    image: '/figures/csp-j-2016/q11-tree.png',
    imageCaption: '右图: 二叉树示意图',
    opts:[['A','6'],['B','10'],['C','12'],['D','15']],
    ans:['D'], a:'树深度 4 层, 顺序存储最右下标 = 2^4 - 1 = 15。' },

  { id:'q12', points:1.5,
    q:'12. 若有如下程序段,其中 s、a、b、c 均已定义为整型变量,且 a、c 均已赋值（c 大于 0）:s = a; for (b = 1; b <= c; b++) s = s + 1; 则与上述程序段修改 s 值的等价的赋值语句是（ ）。',
    opts:[['A','s = a+b'],['B','s = a+c'],['C','s = s+c'],['D','s = b+c']],
    ans:['B'], a:'for 循环 b 从 1 到 c 共 c 次, s 自增 c 次, 所以 s = a + c。' },

  { id:'q13', points:1.5,
    q:'13. 有以下程序:',
    codeBlock: {
      language: 'cpp',
      lines: [
        '#include <iostream>',
        'using namespace std;',
        'int main() {',
        '    int k = 4, n = 0;',
        '    while (n < k) {',
        '        n++;',
        '        if (n % 3 != 0) continue;',
        '        k--;',
        '    }',
        '    cout << k << "," << n << endl;',
        '    return 0;',
        '}',
      ],
    },
    opts:[['A','2,2'],['B','2,3'],['C','3,2'],['D','3,3']],
    ans:['D'], a:'n=0→1 (1%3≠0 continue); n=1→2 (2%3≠0 continue); n=2→3 (3%3==0 k--→3); 3<3 退出, 输出 3,3。' },

  // q14: single-peak array fill-in-the-blank, 3 sub-options labeled a/b/c.
  // Algorithm:
  //   Search(1, n)
  //   1. k = [n/2]
  //   2. if L[k] > L[k-1] and L[k] > L[k+1]   (peak found)
  //   3.    then c (return L[k])
  //   4.    else if L[k] > L[k-1] and L[k] < L[k+1]   (rising -> search right)
  //   5.        then a (Search(k+1, n))
  //   6.    else                                (falling -> search left)
  //   7.        then b (Search(1, k-1))
  // So order is c, a, b.
  { id:'q14', points:1.5,
    q:'14. 给定含有 n 个不同数的数组 L=x₁,x₂,…,xₙ。如果 L 中存在 xₖ（1<k<n）,使得 xₖ<xₖ₊₁, xₖ>…>xₖ₋₁, 则称 L 是单峰的,并称 xₖ 是 L 的"峰顶"。现在已知 L 是单峰的,请把 a、b、c 三行代码补全到算法中,使得算法准确找到 L 的峰顶。正确的填空顺序是（ ）。',
    opts:[['A','c,a,b'],['B','c,b,a'],['C','a,b,c'],['D','b,a,c']],
    ans:['A'], a:'① c 填 return L[k] (找到峰顶返回); ② a 填 Search(k+1, n) (上升段在右侧, 递归右半); ③ b 填 Search(1, k-1) (下降段在左侧, 递归左半)。顺序 c,a,b。' },

  { id:'q15', points:1.5,
    q:'15. 设简单无向图 G 有 16 条边且每个顶点的度数都是 2,则图 G 有（ ）个顶点。',
    opts:[['A','10'],['B','12'],['C','8'],['D','16']],
    ans:['D'], a:'2 × 边数 = 顶点度数之和, 即 2n = 2×16 = 32, n = 16。' },

  // q16: stars-and-bars with identical plates. Partitions of 7 into ≤3 parts.
  { id:'q16', points:1.5,
    q:'16. 有 7 个一模一样的苹果,放到 3 个一样的盘子中,一共有（ ）种放法。',
    opts:[['A','7'],['B','8'],['C','21'],['D','3⁷']],
    ans:['B'], a:'7 的 ≤3 部分拆分数 = 8: {7},{6,1},{5,2},{5,1,1},{4,3},{4,2,1},{3,3,1},{3,2,2}。' },

  // q17: irrigation valves - need figure to solve.
  { id:'q17', points:1.5,
    q:'17. 下图表示一个果园灌溉系统,有 A、B、C、D 四个阀门,每个阀门可以打开或关上,所有管道粗细相同,以下设置阀门的方法中,可以让果树浇上水的是（ ）。',
    image: '/figures/csp-j-2016/q17-irrigation.png',
    imageCaption: '图: 灌溉系统',
    opts:[['A','B 打开,其他都关上'],['B','AB 都打开,CD 都关上'],['C','A 打开,其他都关上'],['D','D 打开,其他都关上']],
    ans:['B'], a:'水从左上"有水"经过 B 阀流入 B 罐, 再经过 A 阀流出沿主管到 C/D 交叉口; C 关 D 关时水流到不了果树; 需 AB 都打开让水流经主路到达 D 后再打开 D 流到果树。' },

  // q18: Lucia shares photo but doesn't want Jacob to see.
  { id:'q18', points:1.5,
    q:'18. Lucia 和她的朋友以及朋友的朋友都在某社交网站上注册了账号。下图是他们之间的关系图,两个人之间有边相连代表这两个人是朋友,没有边相连代表不是朋友。这个社交网站的规则是: 如果某人 A 向他（她）的朋友 B 分享了某张照片,那么 B 就可以对该照片进行评论;如果 B 评论了该照片,那么他（她）的所有朋友都可以看见这个评论以及被评论的照片,但是不能对该照片进行评论（除非 A 也向这些人分享了该照片）。现在 Lucia 已经上传了一张照片,但是她不想让 Jacob 看见这张照片,那么她可以向（ ）分享该照片。',
    image: '/figures/csp-j-2016/q18-social.png',
    imageCaption: '图: 社交网络关系图',
    opts:[['A','Dana、Michael、Eve'],['B','Dana、Eve、Monica'],['C','Michael、Eve、Jacob'],['D','Michael、Peter、Monica']],
    ans:['B'], a:'规则: 看到评论的人也能看到照片(但不能再评论除非 A 也直接分享给 Ta)。要 Jacob 看不见, 分享对象到 Jacob 的任何路径上不能有 Lucia→Ta 的可达性。Lucia 朋友: Dana, Michael, Eve, Peter, Charles; Peter→Jacob, Charles→Jacob, Lena→Jacob (直接邻接); 分享 Dana/Eve/Monica, 评论链不经过 Peter/Charles/Lena 等到 Jacob 的路径。' },

  { id:'q19', points:1.5,
    q:'19. 周末,小明和爸爸妈妈三个人一起动手做三道菜。小明负责洗菜,爸爸负责切菜,妈妈负责炒菜。假设做每道菜的顺序都是: 先洗菜 10 分钟,然后切菜 10 分钟,最后炒菜 10 分钟。那么做一道菜需要 30 分钟。注意: 两道不同的菜的相同步骤不可以同时进行。例如第一道菜和第二道的菜不能同时洗,也不能同时切。那么做完三道菜的最短时间需要（ ）分钟。',
    opts:[['A','90'],['B','60'],['C','50'],['D','40']],
    ans:['C'], a:'流水线调度: 0-10 洗菜1(小明), 10-20 切菜1(爸爸)+洗菜2(小明), 20-30 炒菜1(妈妈)+切菜2(爸爸)+洗菜3(小明), 30-40 炒菜2(妈妈)+切菜3(爸爸), 40-50 炒菜3(妈妈)。共 50 分钟。' },

  { id:'q20', points:1.5,
    q:'20. 参加 NOI 比赛,以下不能带入考场的是（ ）。',
    opts:[['A','钢笔'],['B','适量的衣服'],['C','U 盘'],['D','铅笔']],
    ans:['C'], a:'NOI 规定严禁携带 U 盘等电子存储设备进入考场, 钢笔/铅笔/适量衣物均允许。' },

  { id:'q21', points:5,
    q:'21. 从一个 4×4 的棋盘（不可旋转）中选取不在同一行也不在同一列上的两个方格,共有（ ）种方法。',
    opts:[['A','76'],['B','88'],['C','64'],['D','72']],
    ans:['D'], a:'第一个格子 16 种, 第二个不能同行同列 = 9 种, 16×9/2 = 72。' },

  { id:'q22', points:5,
    q:'22. 约定二叉树的根节点高度为 1。一棵节点数为 2016 的二叉树最少有（ ）个叶子节点;一棵节点数为 2016 的二叉树最小的（ ）高度值是（ ）。',
    opts:[['A','1,13'],['B','1,11'],['C','1008,13'],['D','1008,11']],
    ans:['B'], a:'最少叶子节点 = 1 (链状树, 只有末端是叶子); 最小高度: 2^10=1024 ≤ 2016 < 2^11=2048, 高度至少 11。所以 (1,11) 选 B。' },
];

// 4 read-program scenes. Each has codeBlock + 1 multiple-choice question worth 8 pts.
const readPrograms = [
  {
    id:'sc_cspj16j_read1',
    title:'(一) 阅读以下程序,完成相关题目。',
    code: [
      '#include <iostream>',
      'using namespace std;',
      'int main() {',
      '    int max, min, sum, count = 0;',
      '    int tmp;',
      '    cin >> tmp;',
      '    if (tmp == 0)',
      '        return 0;',
      '    max = min = sum = tmp;',
      '    count++;',
      '    while (tmp != 0) {',
      '        cin >> tmp;',
      '        if (tmp != 0) {',
      '            sum += tmp;',
      '            count++;',
      '            if (tmp > max) max = tmp;',
      '            if (tmp < min) min = tmp;',
      '        }',
      '    }',
      '    cout << max << "," << min << "," << sum / count << endl;',
      '    return 0;',
      '}',
    ],
    q: { id:'q23', points:8,
      q:'23. 当程序的输入为"1 2 3 4 5 6 0 7"时,对应的输出是（ ）。',
      opts:[['A','6,1,3'],['B','6,1,4'],['C','1,6,3'],['D','1,6,4']],
      ans:['A'], a:'输入 1 2 3 4 5 6 0 7: 逐个读取, 读到 0 时本轮 while 退出 (前面已读取 6 个非零数, 1+2+3+4+5+6=21, count=6, max=6, min=1)。输出 6,1,21/6=3 → "6,1,3"。' },
  },
  {
    id:'sc_cspj16j_read2',
    title:'(二) 阅读以下程序,完成相关题目。',
    code: [
      '#include <iostream>',
      'using namespace std;',
      'int main() {',
      '    int i = 100, x = 0, y = 0;',
      '    while (i > 0) {',
      '        i--;',
      '        x = i % 8;',
      '        if (x == 1) y++;',
      '    }',
      '    cout << y << endl;',
      '    return 0;',
      '}',
    ],
    q: { id:'q24', points:8,
      q:'24. 程序输出的结果为（ ）。',
      opts:[['A','11'],['B','12'],['C','13'],['D','14']],
      ans:['C'], a:'i 从 99 降到 0 共 100 次。i%8==1 的 i = 1,9,17,…,97, 共 (97-1)/8+1 = 13 个。' },
  },
  {
    id:'sc_cspj16j_read3',
    title:'(三) 阅读以下程序,完成相关题目。',
    code: [
      '#include <iostream>',
      'using namespace std;',
      'int main() {',
      '    int a[6] = {1, 2, 3, 4, 5, 6};',
      '    int pi = 0;',
      '    int pj = 5;',
      '    int t, i;',
      '    while (pi < pj) {',
      '        t = a[pi];',
      '        a[pi] = a[pj];',
      '        a[pj] = t;',
      '        pi++;',
      '        pj--;',
      '    }',
      '    for (i = 0; i < 6; i++) cout << a[i] << ",";',
      '    cout << endl;',
      '    return 0;',
      '}',
    ],
    q: { id:'q25', points:8,
      q:'25. 程序输出的结果为（ ）。',
      opts:[['A','1,2,3,4,5,6'],['B','6,5,4,3,2,1'],['C','1,3,2,6,4,5'],['D','1,5,3,4,2,6']],
      ans:['B'], a:'pi 从 0 向右, pj 从 5 向左, 每次交换 a[pi] 和 a[pj], 即数组反转。' },
  },
  {
    id:'sc_cspj16j_read4',
    title:'(四) 阅读以下程序,完成相关题目。',
    code: [
      '#include <iostream>',
      'using namespace std;',
      'int main() {',
      '    int i, length1, length2;',
      '    string s1, s2;',
      '    s1 = "I have a dream.";',
      '    s2 = "I Have A Dream.";',
      '    length1 = s1.size();',
      '    length2 = s2.size();',
      '    for (i = 0; i < length1; i++)',
      '        if (s1[i] >= \'a\' && s1[i] <= \'z\')',
      '            s1[i] = \'a\' - \'A\';',
      '    for (i = 0; i < length2; i++)',
      '        if (s2[i] >= \'a\' && s2[i] <= \'z\')',
      '            s2[i] = \'a\' - \'A\';',
      '    if (s1 == s2)',
      '        cout << "=" << endl;',
      '    else if (s1 > s2)',
      '        cout << ">" << endl;',
      '    else',
      '        cout << "<" << endl;',
      '    return 0;',
      '}',
    ],
    q: { id:'q26', points:8,
      q:'26. 程序输出的结果为（ ）。',
      opts:[['A','<'],['B','>'],['C','='],['D','以上都不对']],
      ans:['C'], a:'s1 小写转大写 → "I Have A Dream.", s2 已是大写不变 → 相同, 输出 =。' },
  },
];

// 2 perfect-program scenes. Each has 5 fill-in-the-blank questions (14 pts total).
// 完美 (一): 读入整数. 配分 2.5/3/3/3/2.5 = 14 分
const perfect1 = {
  id:'sc_cspj16j_perfect1',
  title:'(一)（读入整数）请完善下面的程序,使程序能够读入两个 int 范围内的整数,并将这两个整数分别输出,每行一个。（第 1 小题和第 5 小题 2.5 分,其余每小题 3 分）',
  description: '输入: 整数之间和前后只会出现空格或者回车,输入数据要保证合法。例如输入: 123 -789 输出: 123 -789',
  code: [
    '#include <iostream>',
    'using namespace std;',
    'int readInt() {',
    '    int num = 0;',
    '    int negative = 0;',
    '    char c;',
    '    c = cin.get();',
    '    while ((c < \'0\' || c > \'9\') && c != \'-\') c = ①;',
    '    if (c == \'-\')',
    '        negative = 1;',
    '    else',
    '        ②;',
    '    c = cin.get();',
    '    while (③) {',
    '        ④;',
    '        c = cin.get();',
    '    }',
    '    if (negative == 1)',
    '        ⑤;',
    '    return num;',
    '}',
    'int main() {',
    '    int a, b;',
    '    a = readInt();',
    '    b = readInt();',
    '    cout << a << endl << b << endl;',
    '    return 0;',
    '}',
  ],
  qs: [
    { id:'q27', points:2.5, q:'27. ① 处应填（ ）。',
      opts:[['A','0xff'],['B','\'0\''],['C','0'],['D','cin.get()']],
      ans:['D'], a:'跳过非数字非负号字符, 需读取下一字符 → cin.get()。' },
    { id:'q28', points:3, q:'28. ② 处应填（ ）。',
      opts:[['A','negative=0'],['B','negative=1'],['C','continue'],['D','num=c-\'0\'']],
      ans:['D'], a:'else 分支说明 c 是数字字符, 需把首个数字字符累加到 num: num = c - \'0\'。' },
    { id:'q29', points:3, q:'29. ③ 处应填（ ）。',
      opts:[['A','c!=EOF'],['B','c!=0'],['C','c<=\'9\' && c>=\'0\''],['D','cin.get()<=\'9\' && cin.get()>=\'0\'']],
      ans:['C'], a:'数字字符判断: c 在 \'0\'..\'9\' 范围内。' },
    { id:'q30', points:3, q:'30. ④ 处应填（ ）。',
      opts:[['A','num+=c'],['B','num=num*10+c'],['C','num+=c*48'],['D','num=num*10+c-48']],
      ans:['D'], a:'字符转数字 (c-48) 后累加: num = num*10 + c - 48。' },
    { id:'q31', points:2.5, q:'31. ⑤ 处应填（ ）。',
      opts:[['A','return -num'],['B','return num'],['C','num=0'],['D','num=-1']],
      ans:['A'], a:'负数取负后返回: return -num。' },
  ],
};

// 完美 (二): 郊游活动. 配分 2.5/3/3/3/2.5 = 14 分
const perfect2 = {
  id:'sc_cspj16j_perfect2',
  title:'(二)（郊游活动）有 n 名同学参加学校组织的郊游活动,已知学校给这 n 名同学的郊游总经费为 A 元,与此同时第 i 位同学自己携带了 Mᵢ 元。为了方便郊游,活动地点提供 B（B ≥ n）辆自行车供人租用,租用第 j 辆自行车的价格为 Cⱼ 元。每位同学可以使用自己携带的钱或者学校的郊游经费,为了方便账务管理,每位同学只能为自己租用自行车,且不会借钱给他人,最多有多少位同学能够租用到自行车？（第 4 小题和第 5 小题 2.5 分,其余每小题 3 分）',
  description: '本题采用二分法。对于区间[l, r],我们取区间中点 mid 并判断租用到自行车的人数能否达到 mid。判断的过程是利用贪心算法实现的。试补全程序。',
  code: [
    '#include <iostream>',
    'using namespace std;',
    '#define MAXN 100000',
    'int n, B, A, M[MAXN], C[MAXN], l, r, ans, mid;',
    'bool check(int nn) {',
    '    int count = 0, i, j;',
    '    i = ①;',
    '    j = 1;',
    '    while (i <= n) {',
    '        if (②)',
    '            count += C[j] - M[i];',
    '        i++;',
    '        j++;',
    '    }',
    '    return ③;',
    '}',
    'void sort(int a[], int l, int r) {',
    '    int i = l, j = r, x = a[(l + r) / 2], y;',
    '    while (i <= j) {',
    '        while (a[i] < x) i++;',
    '        while (a[j] > x) j--;',
    '        if (i <= j) {',
    '            y = a[i];',
    '            a[i] = a[j];',
    '            a[j] = y;',
    '            i++;',
    '            j--;',
    '        }',
    '    }',
    '    if (i < r) sort(a, i, r);',
    '    if (l < j) sort(a, l, j);',
    '}',
    'int main() {',
    '    int i;',
    '    cin >> n >> B >> A;',
    '    for (i = 1; i <= n; i++) cin >> M[i];',
    '    for (i = 1; i <= B; i++) cin >> C[i];',
    '    sort(M, 1, n);',
    '    sort(C, 1, B);',
    '    l = 0;',
    '    r = n;',
    '    while (l <= r) {',
    '        mid = (l + r) / 2;',
    '        if (④) {',
    '            ans = mid;',
    '            l = mid + 1;',
    '        } else',
    '            r = ⑤;',
    '    }',
    '    cout << ans << endl;',
    '    return 0;',
    '}',
  ],
  qs: [
    { id:'q32', points:2.5, q:'32. ① 处应填（ ）。',
      opts:[['A','1'],['B','nn'],['C','n-nn+1'],['D','n-nn']],
      ans:['C'], a:'check(nn) 检查 nn 名学生能否租到车, 需配 M 中钱最多的 nn 人 (M 升序, 索引 n-nn+1..n) 与 C 中最便宜的 nn 辆车, 循环恰好 nn 次, 故 i 初始化为 n-nn+1。' },
    { id:'q33', points:3, q:'33. ② 处应填（ ）。',
      opts:[['A','M[i]<C[j]'],['B','M[i]!=0'],['C','M[i]>C[j]'],['D','M[i]!=C[j]']],
      ans:['A'], a:'只有当学生自己带的钱 M[i] 不足以支付 C[j] 时, 才需要学校经费补差额 C[j]-M[i]。' },
    { id:'q34', points:3, q:'34. ③ 处应填（ ）。',
      opts:[['A','count'],['B','A-count'],['C','A>=count'],['D','j']],
      ans:['C'], a:'check(nn) 返回 true 当且仅当所需学校经费不超过 A: 即 count <= A。' },
    { id:'q35', points:3, q:'35. ④ 处应填（ ）。',
      opts:[['A','check(mid)'],['B','!check(mid)'],['C','mid'],['D','mid<A']],
      ans:['A'], a:'能租到 mid 辆 (check(mid)==true) 时, 记录 ans=mid 并尝试更大的 mid。' },
    { id:'q36', points:2.5, q:'36. ⑤ 处应填（ ）。',
      opts:[['A','mid+1'],['B','mid-1'],['C','l+mid'],['D','r-mid']],
      ans:['B'], a:'不能租到 mid 辆, 缩右边界: r = mid - 1。' },
  ],
};

function buildQuestion(q) {
  return {
    id: q.id,
    type: 'single',
    question: q.q,
    options: q.opts.map(([v, l]) => ({ value: v, label: l })),
    answer: q.ans,
    analysis: q.a,
    points: q.points,
    hasAnswer: true,
    codeBlock: q.codeBlock,
    image: q.image,
    imageCaption: q.imageCaption,
  };
}

function buildScene(id, title, order, content, category, kind) {
  return {
    id, stageId, type: 'quiz', title, order,
    content: { ...content, kind },
    actions: [],
    multiAgent: { enabled: false, agentIds: [] },
    createdAt: Date.now(), updatedAt: Date.now(),
    category,
  };
}

const stage = {
  id: stageId,
  name: '2016年普及级CSP-J初赛真题卷（已根据新题型改编）',
  description: '2016年CCF NOIP普及组初赛真题,按CSP-J新题型改编: 选择题22题 (前20题1.5分,后2题5分,共40分)、阅读程序4题 (每题8分,共32分)、完善程序2题 (每题5个空,共28分), 总分100分。',
  languageDirective: 'zh-CN',
  style: 'tutor',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  generatedAgentConfigs: [
    { id:'imp_agent_cspj16j_0', name:'张老师', role:'teacher', persona:'经验丰富的CSP初赛教练', avatar:'/avatars/teacher.png', color:'#3b82f6', priority:10 },
    { id:'imp_agent_cspj16j_1', name:'小慧', role:'assistant', persona:'聪明耐心的女助教', avatar:'/avatars/assist.png', color:'#ec4899', priority:7 },
  ],
  agentIds: [],
  scoreBreakdown: { choice: 40, read: 32, perfect: 28 },
};

const scene0 = buildScene(
  'sc_cspj16j_choice',
  '一、选择题（共 22 题,第 1-20 题每题 1.5 分,第 21-22 题每题 5 分,共计 40 分）',
  1,
  { type: 'quiz', questions: choiceQuestions.map(buildQuestion) },
  'choice',
  'choice',
);

const readScenes = readPrograms.map((rp, i) => buildScene(
  rp.id,
  rp.title,
  i + 2,
  {
    type: 'quiz',
    codeBlock: { language: 'cpp', title: '', description: '', lines: rp.code },
    questions: [buildQuestion(rp.q)],
  },
  'read',
  'code-reading',
));

const perfectScenes = [perfect1, perfect2].map((p, i) => buildScene(
  p.id,
  p.title,
  i + 2 + readPrograms.length,
  {
    type: 'quiz',
    codeBlock: { language: 'cpp', title: '', description: p.description, lines: p.code },
    questions: p.qs.map(buildQuestion),
  },
  'perfect',
  'code-completion',
));

const classroom = {
  id: stageId,
  createdAt: new Date().toISOString(),
  collection: 'csp-lecture',
  stage: { ...stage, scenes: [scene0, ...readScenes, ...perfectScenes] },
};

fs.writeFileSync(
  'frontend/data/classrooms/cm_imp_cspj2016j_v1.json',
  JSON.stringify(classroom, null, 2),
);

const totalChoice = choiceQuestions.reduce((s, q) => s + q.points, 0);
const totalRead = readPrograms.reduce((s, rp) => s + rp.q.points, 0);
const totalPerfect = [...perfect1.qs, ...perfect2.qs].reduce((s, q) => s + q.points, 0);
console.log('choice:', totalChoice, '(should be 40)');
console.log('read:', totalRead, '(should be 32)');
console.log('perfect:', totalPerfect, '(should be 28)');
console.log('total:', totalChoice + totalRead + totalPerfect, '(should be 100)');
console.log('questions: 22 + 4 + 10 = 36');
