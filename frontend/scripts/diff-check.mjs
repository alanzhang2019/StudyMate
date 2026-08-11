// Comprehensive diff report: JSON read/perfect programs vs PDF OCR
// Plus: problem-solving answer verification with auto-computation
// Outputs structural issues, missing code blocks, answer mismatches

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

const DIR = './data/classrooms';

const files = (await readdir(DIR)).filter(f => /^cm_imp_csp[js]\d{4}[js]_v1\.json$/.test(f)).sort();

const out = [];
out.push('='.repeat(80));
out.push('真卷JSON结构 + 问题求解答案 对比报告');
out.push('='.repeat(80));
out.push('');

// 工具：整数分拆 p(n, k) = 把 n 拆成至多 k 份（每份≥1，无序，允许 0 表示不足 k 份）
function partitionAtMost(n, k) {
  const memo = new Map();
  const dfs = (remain, max, parts) => {
    if (parts > k) return 0;
    if (remain === 0) return 1;
    const key = `${remain}|${max}|${parts}`;
    if (memo.has(key)) return memo.get(key);
    let cnt = 0;
    for (let i = Math.min(max, remain); i >= 1; i--) {
      cnt += dfs(remain - i, i, parts + 1);
    }
    memo.set(key, cnt);
    return cnt;
  };
  return dfs(n, n, 0);
}

// 错排 D(n) = n! * sum_{k=0..n} (-1)^k / k!
function derangement(n) {
  let sum = 0;
  for (let k = 0; k <= n; k++) {
    sum += (k % 2 === 0 ? 1 : -1) / factorial(k);
  }
  return Math.round(factorial(n) * sum);
}
function factorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }

// 走格子: 起点 (0,0) 面朝 +x，每轮走 k 单位后右转，求第 n 轮后的坐标
// 数学坐标系 (y 向上)，右转 +x→-y→-x→+y→+x
function walkAfterRounds(n) {
  let x = 0, y = 0;
  const dirs = [[1,0],[0,-1],[-1,0],[0,1]];
  for (let i = 1; i <= n; i++) {
    const [dx, dy] = dirs[(i - 1) % 4];
    x += dx * i; y += dy * i;
  }
  return { x, y };
}

// 1..n 中包含数字 d 的数有几个
function countDigitIn(n, d) {
  let cnt = 0;
  for (let i = 1; i <= n; i++) {
    if (String(i).includes(String(d))) cnt++;
  }
  return cnt;
}

// 容斥: 1..n 中不能被 a,b,c 中任一整除的数有几个
function countNotDivisibleByAny(n, arr) {
  // 递归枚举所有子集
  let excluded = 0;
  const m = arr.length;
  for (let mask = 1; mask < (1 << m); mask++) {
    let lcm = 1;
    let bits = 0;
    for (let i = 0; i < m; i++) {
      if (mask & (1 << i)) {
        bits++;
        lcm = lcm * arr[i] / gcd(lcm, arr[i]);
      }
    }
    if (lcm > n) continue;
    excluded += Math.floor(n / lcm) * (bits % 2 === 1 ? 1 : -1);
  }
  return n - excluded;
}
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

// 卡特兰数 C_n = C(2n,n)/(n+1)，n 节点不同二叉树形态数 = C_{n-1}
function catalan(n) { return n < 0 ? 0 : Math.round(factorial(2*n) / factorial(n) / factorial(n+1)); }

// Fibonacci: f(1)=2, f(2)=3, f(n)=f(n-1)+f(n-2) - 1×n 棋盘黑白填涂 (不相邻黑)
function fibColoring(n) {
  let a = 2, b = 3;
  for (let i = 3; i <= n; i++) { const t = a + b; a = b; b = t; }
  return b;
}

// 棋盘 4x4 选 2 个不同行不同列的方格
function gridPick(n) {
  return comb(n, 2) * comb(n, 2);
}
function comb(n, k) { return factorial(n) / factorial(k) / factorial(n-k); }

// 链状二叉树: 1 个叶子 (退化)
// 完全二叉树: 高度 = ceil(log2(n+1))
function binaryTreeMinHeight(n) {
  // 2^h - 1 >= n -> h >= log2(n+1)
  return Math.ceil(Math.log2(n + 1));
}

// 解析 options 中数字（按 A,B,C,D 顺序）
function optionValues(q) {
  return (q.options || []).map(o => o.label);
}

// 核心：从问题文本中识别题型并计算预期答案
function autoSolve(q) {
  const text = (q.question || '').replace(/\s+/g, ' ');
  let m;

  // 题型 1: M 个同样的球放到 N 个同样的袋子里（取最后一个 M=,N= 匹配，避免命中示例）
  const partMatches = [...text.matchAll(/M\s*=\s*(\d+)\s*[,，]\s*N\s*=\s*(\d+)/g)];
  if (partMatches.length) {
    const last = partMatches[partMatches.length - 1];
    const M = +last[1], N = +last[2];
    return { type: 'partition', value: String(partitionAtMost(M, N)), computed: partitionAtMost(M, N) };
  }

  // 题型 2: 重新排列 n 个数字使都不在原位 (n = 数字个数, 即连续数字串的长度)
  m = text.match(/重新排列\s*(\d[\d\s,，]*\d)/);
  if (m) {
    const digits = m[1].replace(/[\s,，]/g, '');
    const n = digits.length;
    if (n >= 1 && n <= 20) {
      const v = derangement(n);
      if (Number.isFinite(v)) {
        return { type: 'derangement', value: String(v), computed: v };
      }
    }
  }

  // 题型 3: 结点数为 n 的二叉树最多叶子数 (支持 "n 个的" 或 "n 的" 两种写法)
  m = text.match(/结点数为\s*(\d+)\s*(?:个)?\s*的二叉树最多/);
  if (m) {
    const n = +m[1];
    return { type: 'max-leaves', value: String((n + 1) >> 1), computed: (n + 1) >> 1 };
  }

  // 题型 4: 4x4 棋盘选 2 个不同行不同列
  if (/4\s*[×xX]\s*4/.test(text) && /不在同行也不在同列/.test(text)) {
    return { type: '4x4-pick', value: String(gridPick(4)), computed: gridPick(4) };
  }

  // 题型 5: 1..n 中包含数字 d 的数有几个
  m = text.match(/从\s*1\s*到\s*(\d+)\s*这\s*\d+\s*个数中.*?包含.*?(\d)/);
  if (m) {
    const N = +m[1], d = +m[2];
    return { type: 'count-digit', value: String(countDigitIn(N, d)), computed: countDigitIn(N, d) };
  }

  // 题型 6: 不能被 a,b,c 整除
  m = text.match(/不能被\s*(\d+)\s*[,、]\s*(\d+)\s*[,、]\s*(\d+)\s*任一个整除/);
  if (m) {
    const arr = [+m[1], +m[2], +m[3]];
    m = text.match(/在\s*1\s*和\s*(\d+)\s*之间/);
    if (m) {
      const N = +m[1];
      const v = countNotDivisibleByAny(N, arr);
      return { type: 'not-divisible', value: String(v), computed: v };
    }
  }

  // 题型 7: 结点数为 n 的不同形态二叉树 (支持 "n 个的" 或 "n 的" 两种写法)
  m = text.match(/结点数为\s*(\d+)\s*(?:个)?\s*的不同形态二叉树/);
  if (m) {
    const n = +m[1];
    return { type: 'binary-trees', value: String(catalan(n - 1)), computed: catalan(n - 1) };
  }

  // 题型 8: 1×n 棋盘黑白填涂 (Fibonacci)
  m = text.match(/1\s*[×xX]\s*(\d+)\s*方格/);
  if (m) {
    const n = +m[1];
    return { type: 'fib-color', value: String(fibColoring(n)), computed: fibColoring(n) };
  }

  // 题型 9: 二叉树最少叶子数 + 最小高度
  m = text.match(/(\d+)\s*节点二叉树最少有.*?个叶子.*?最小高度/);
  if (m) {
    const n = +m[1];
    return { type: 'binary-tree-min', value: `1 个叶子, 高度 ${binaryTreeMinHeight(n)}`, computed: 1 };
  }

  // 题型 10: 走格子 (2017 轮)
  m = text.match(/第\s*(\d+)\s*轮后.*?坐标/);
  if (m) {
    const n = +m[1];
    const p = walkAfterRounds(n);
    return { type: 'walk', value: `(${p.x}, ${p.y})`, computed: `${p.x},${p.y}` };
  }

  // 题型 11: 甲乙丙丁郊游逻辑题 (2018 J/S 共有题)
  if (/甲乙丙丁/.test(text) && (/郊游/.test(text) || /周末/.test(text))) {
    const sol = solveJYBD();
    if (sol) {
      // 尝试多种 label 格式匹配：
      // 2018 J 风格: "去了, 没去, 去了, 下雨"  (天气用 "下雨"/"不下雨")
      // 2018 S 风格: "甲去 乙不去 丁去 不下雨" (天气用 "下雨"/"不下雨")
      // 早期 J 题偶用 "没下雨"
      const fmt1 = `${sol.jia ? '去了' : '没去'}, ${sol.yi ? '去了' : '没去'}, ${sol.ding ? '去了' : '没去'}, ${sol.rain ? '下雨' : '不下雨'}`;
      const fmt2 = `甲${sol.jia ? '去' : '不去'} 乙${sol.yi ? '去' : '不去'} 丁${sol.ding ? '去' : '不去'} ${sol.rain ? '下雨' : '不下雨'}`;
      const fmt3 = `${sol.jia ? '去了' : '没去'}, ${sol.yi ? '去了' : '没去'}, ${sol.ding ? '去了' : '没去'}, ${sol.rain ? '下雨' : '没下雨'}`;
      const opts = q.options || [];
      // 规范化：统一逗号、全半角、空格
      const norm = s => String(s).replace(/\s+/g, ' ').replace(/，/g, ',').replace(/\s*,\s*/g, ', ').trim();
      const matchOpt = opts.find(o => {
        const l = norm(o.label);
        return l === norm(fmt1) || l === norm(fmt2) || l === norm(fmt3);
      });
      // 即使无 match 也返回（用于发现选项集本身错的情况）
      return {
        type: 'logic-jybd',
        value: fmt2,
        computed: fmt2,
        matchValue: matchOpt ? matchOpt.value : null,
      };
    }
  }

  return null;
}

// 求解 2018 普及/提高组甲乙丙丁郊游逻辑题
// 已知条件：
// ①如果下雨且乙不去,甲一定不去   →  (rain AND !乙) → !甲
// ②如果乙去,丁一定去             →  乙 → 丁
// ③如果丙去,丁一定不去           →  丙 → !丁
// ④如果丁不去且甲不去,丙一定不去 →  (!丁 AND !甲) → !丙
// 题目已知丙去了，求甲/乙/丁/是否下雨
function solveJYBD() {
  const variants = [];
  for (const jia of [true, false]) {
    for (const yi of [true, false]) {
      for (const ding of [true, false]) {
        for (const rain of [true, false]) {
          const bing = true;  // 丙去了
          let ok = true;
          // ① (rain AND !乙) → !甲
          if (rain && !yi && jia) ok = false;
          // ② 乙 → 丁
          if (yi && !ding) ok = false;
          // ③ 丙 → !丁
          if (bing && ding) ok = false;
          // ④ (!丁 AND !甲) → !丙
          if (!ding && !jia && bing) ok = false;
          if (ok) variants.push({ jia, yi, ding, rain });
        }
      }
    }
  }
  if (variants.length !== 1) return null;
  return variants[0];
}

// 硬编码答案表（图形题或无法自动计算的题）
const HARD_CODED = {
  // 2014 S: ps1 数字 1,1,2,4,8,8 组成的不同四位数
  'cm_imp_csps2014s_v1|sc_csps14s_problem_solving|ps1': 102,
  // 2014 S: ps2 图最短路径 A->E
  'cm_imp_csps2014s_v1|sc_csps14s_problem_solving|ps2': 10,
  // 2016 S: ps2 7 门考试冲突最小时间段
  'cm_imp_csps2016s_v1|sc_csps16s_problem_solving|ps2': 3,
  // 2017 S: ps2 A-B 最小割
  'cm_imp_csps2017s_v1|sc_csps17j_problem_solving|ps2': null, // 需要 PDF 图
  // 2018 S: ps2 位运算方程
  'cm_imp_csps2018s_v1|sc_csps18s_problem|ps2': null,
  // 2017 J: ps2 13 格棋盘全变 0 最少操作
  'cm_imp_cspj2017j_v1|sc_cspj17j_problem_solving|ps2': 3,
};

// 格式化预期答案为选项值（如适用）
function expectedOptionLabel(q, expected) {
  const opts = q.options || [];
  for (const o of opts) {
    if (o.label === String(expected) || o.value === String(expected)) return o.value;
  }
  return null;
}

let totalProblems = 0, problemsChecked = 0, problemsMismatched = 0, problemsUnverifiable = 0;

for (const f of files) {
  const m = f.match(/cm_imp_csp([js])(\d{4})([js])_v1/);
  if (!m) continue;
  const [, kind, year, jOrS] = m;
  const series = kind === 'j' ? 'J' : 'S';
  const data = JSON.parse(await readFile(join(DIR, f), 'utf-8'));

  out.push(`\n${'─'.repeat(80)}`);
  out.push(`【${year} ${series}】 ${f}`);
  out.push('─'.repeat(80));

  if (!data.scenes || !Array.isArray(data.scenes)) {
    out.push('  ❌ 无 scenes 字段');
    continue;
  }

  // 找阅读/完善程序（排除 问题求解 类）
  const allScenes = data.scenes || [];
  const isProblemSolving = s => {
    if ((s.id || '').includes('problem_solving')) return true;
    if ((s.id || '').includes('_problem') && !(s.id || '').includes('perfect')) return true;
    if ((s.title || '').includes('问题求解')) return true;
    return false;
  };
  const reads = allScenes.filter(s => s.category === 'read' && !isProblemSolving(s));
  const perfects = allScenes.filter(s => s.category === 'perfect');
  const problems = allScenes.filter(s => s.category === 'read' && isProblemSolving(s));

  out.push(`阅读程序数: ${reads.length}, 完善程序数: ${perfects.length}, 问题求解数: ${problems.length}`);

  let allOk = true;

  for (const s of [...reads, ...perfects]) {
    const tag = s.category === 'read' ? '📖阅读' : '✍️完善';
    out.push(`\n  ${tag} ${s.id} | ${s.title || '(无标题)'}`);

    // 1. 标题检查
    if (!s.title) {
      out.push(`    ⚠️ 缺少 title`);
      allOk = false;
    }

    // 2. codeBlock检查
    const cb = s.content && s.content.codeBlock;
    if (!cb) {
      out.push(`    ❌ 缺少 codeBlock`);
      allOk = false;
    } else {
      const lines = cb.lines || [];
      if (lines.length === 0) {
        out.push(`    ❌ codeBlock.lines 为空`);
        allOk = false;
      } else {
        out.push(`    📝 codeBlock ${lines.length} 行 (lang=${cb.language || '?'}, startLine=${cb.startLine || 1})`);
      }
    }

    // 3. 题目检查
    const qs = (s.content && s.content.questions) || [];
    out.push(`    ❓ 题目数: ${qs.length}`);

    if (qs.length === 0) {
      out.push(`    ❌ 没有任何题目`);
      allOk = false;
    }

    // 4. 题目id和answer完整性
    for (const q of qs) {
      if (!q.id) {
        out.push(`    ⚠️ 题目缺 id`);
        allOk = false;
      }
      const hasCodeLines = q.codeLines && q.codeLines.length > 0;
      const minLen = hasCodeLines ? 1 : 5;
      if (!q.question || q.question.length < minLen) {
        out.push(`    ⚠️ ${q.id} 题目内容过短或缺失`);
        allOk = false;
      }
      if (q.type !== 'judge' && (!q.options || q.options.length < 2)) {
        out.push(`    ⚠️ ${q.id} 选择题缺选项`);
        allOk = false;
      }
      if (!q.answer || (Array.isArray(q.answer) && q.answer.length === 0)) {
        out.push(`    ⚠️ ${q.id} 缺答案`);
        allOk = false;
      }
    }

    // 5. 题目类型分布
    const typeCount = {};
    for (const q of qs) {
      typeCount[q.type] = (typeCount[q.type] || 0) + 1;
    }
    out.push(`    📊 题型分布: ${JSON.stringify(typeCount)}`);

    // 6. 题目编号是否以 r/cr 开头
    if (s.category === 'read' && reads[0] === s) {
      const firstQId = qs[0] ? qs[0].id : '';
      const ok = firstQId.startsWith('r') || firstQId.startsWith('cr') || firstQId.startsWith('ps');
      if (!ok) {
        out.push(`    ⚠️ 阅读题第一题 id 应以 r/cr 开头, 实际: ${firstQId}`);
      }
    }
  }

  // === 问题求解题答案验证 ===
  for (const s of problems) {
    const qs = (s.content && s.content.questions) || [];
    out.push(`\n  🧮问题求解 ${s.id} | ${s.title || '(无标题)'}`);
    for (const q of qs) {
      totalProblems++;
      const key = `${f}|${s.id}|${q.id}`;
      const answerVal = Array.isArray(q.answer) ? q.answer.join(',') : String(q.answer);
      out.push(`    📌 ${q.id} | 答案: ${answerVal}`);

      let expected = null, expectedVal = null, source = 'auto';

      // 优先查硬编码
      if (HARD_CODED[key] !== undefined && HARD_CODED[key] !== null) {
        expected = String(HARD_CODED[key]);
        source = 'hard-coded';
      } else {
        // 自动计算
        const result = autoSolve(q);
        if (result) {
          expected = result.value;
          source = `auto:${result.type}`;
          // 若 autoSolve 已直接定位到匹配选项（如 logic-jybd）
          if (result.matchValue) expectedVal = result.matchValue;
        }
      }

      if (expected === null) {
        out.push(`       ⚠️ 无法验证（需参照 PDF 图或手算）`);
        problemsUnverifiable++;
        continue;
      }

      problemsChecked++;

      // 查找匹配选项（label 优先, 适用于 2018 S ps1 等用整段描述作为 label 的题）
      const opts = q.options || [];
      if (!expectedVal) {
        const normExpected = String(expected).replace(/\s+/g, ' ').trim();
        const matchOpt = opts.find(o => {
          const label = String(o.label || '').replace(/\s+/g, ' ').trim();
          return label === normExpected || o.value === normExpected;
        });
        expectedVal = matchOpt ? matchOpt.value : null;
      }

      if (Array.isArray(q.answer) && expectedVal && q.answer.includes(expectedVal)) {
        out.push(`       ✅ 答案正确 (${source}: ${expected})`);
      } else if (Array.isArray(q.answer) && q.answer[0] && opts.find(o => o.value === q.answer[0])) {
        // 答案不匹配
        const curOpt = opts.find(o => o.value === q.answer[0]);
        out.push(`       ❌ 答案错误! 当前 ${q.answer[0]}=${curOpt ? curOpt.label : '?'}, 预期 ${expectedVal || expected} (${source})`);
        problemsMismatched++;
        allOk = false;
      } else {
        out.push(`       ❌ 答案不在选项中! 当前 ${answerVal}, 预期 ${expected} (${source})`);
        problemsMismatched++;
        allOk = false;
      }
    }
  }

  out.push(allOk ? `\n  ✅ 整体结构 OK` : `\n  ⚠️ 存在结构问题`);
}

out.push('');
out.push('='.repeat(80));
out.push('问题求解题验证汇总');
out.push('='.repeat(80));
out.push(`总问题数: ${totalProblems}`);
out.push(`已验证: ${problemsChecked}`);
out.push(`  ✅ 通过: ${problemsChecked - problemsMismatched}`);
out.push(`  ❌ 不匹配: ${problemsMismatched}`);
out.push(`  ⚠️ 无法自动验证: ${problemsUnverifiable}`);

const reportPath = 'tmp-diff-report.txt';
await import('fs/promises').then(fs => fs.writeFile(reportPath, out.join('\n'), 'utf-8'));
console.log(`报告已写入: ${reportPath}`);
console.log(`共检查 ${files.length} 个文件，问题求解题 ${totalProblems} 道，${problemsMismatched} 道答案不匹配`);
