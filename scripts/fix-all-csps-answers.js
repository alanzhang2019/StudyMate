// Comprehensive fix script for CSP-S 2014-2025 answers
// Based on web research cross-referencing multiple authoritative sources:
//   洛谷 ti.luogu.com.cn, CSDN, dotcpp.com, 洛谷 luogu.com.cn
// Idempotent: only writes if a change is needed; safe to re-run
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..', 'frontend', 'data', 'classrooms');

const fixes = {
  '2014': {
    file: 'cm_imp_csps2014s_v1.json',
    updates: {
      'q3':  ['D'],  // 00100100 + 00010101 = 00111001 (36+21=57)
      'm1':  ['A','B'],  // (B v C v D) v D ^ A, ((-A ^ B) v C) ^ -B → A,B为真
    }
  },
  '2015': {
    file: 'cm_imp_csps2015s_v1.json',
    updates: {
      'q3':  ['A'],  // 0.1 (bin) = 0.8 (hex)
      'q14': ['A'],  // 色数 = 3
    }
  },
  '2016': {
    file: 'cm_imp_csps2016s_v1.json',
    updates: {
      'q2':  ['A'],  // 第81个字符是 A (CSDN/洛谷)
      'q4':  ['B'],  // 0.1 (bin) = 0.4 (oct)
      'q7':  ['B'],  // 二叉树链表空指针数 = 7
      'q10': ['D'],  // while循环输出 3,3
      'q11': ['B'],  // 7个苹果放3个相同盘子, 8种
      'q12': ['A'],  // Dana, Michael, Eve
      'q13': ['C'],  // 三道菜最短 50 分钟
      'q14': ['C'],  // T(n)=2T(n/4)+√n, 主定理 case 2, O(√n log n)
      'm4':  ['A'],  // 果园灌溉: B打开, 其他都关上
    }
  },
  '2017': {
    file: 'cm_imp_csps2017s_v1.json',
    updates: {
      'q15': ['C'],  // 3*60*2*(1/20) = 18
    }
  },
  '2018': {
    file: 'cm_imp_csps2018s_v1.json',
    updates: {
      'q9':  ['D'],  // 抽奖概率 大箱红蓝比接近 1:1
    }
  },
  '2021': {
    file: 'cm_imp_csps2021s_v1.json',
    updates: {
      'q15': ['B'],  // A→C→E→H→J 长度 19
    }
  },
  '2022': {
    file: 'cm_imp_csps2022s_v1.json',
    updates: {
      'q7':  ['C'],  // 深度5的完全3叉树 100号父结点 = 97
      'q11': ['C'],  // 车牌 26^2 * 10^3 = 676000
      'q12': ['D'],  // 哈希表89在位置 2
      'q13': ['B'],  // 嵌套for O(n log n)
      'q15': ['B'],  // ack(2,2) = 7
    }
  },
  '2023': {
    file: 'cm_imp_csps2023s_v1.json',
    updates: {
      'q7':  ['C'],  // ABCAAAABA和ABABCBABA的LCS = 6
      'q12': ['C'],  // 奇数节点树只有1个重心 → 7节点
      'q15': ['A'],  // quick_power两次递归 T(n)=2T(n/2)+O(1) → O(n)
    }
  },
  '2024': {
    file: 'cm_imp_csps2024s_v1.json',
    updates: {
      'q11': ['A'],  // h层完全二叉树最多 2^h - 1
      'q12': ['C'],  // 10顶点完全图长度4环 = 630
      'q13': ['A'],  // f(f(x))=10 最小 x = 29
      'q14': ['C'],  // 01串最坏交换 = k*(n-k) (不是 k*(k-1)/2)
    }
  },
  '2025': {
    file: 'cm_imp_csps2025s_v1.json',
    updates: {
      'q2':  ['A'],  // KMP next for "abacaba" = {0,0,1,0,1,2,3}
      'q7':  ['A'],  // 8顶点完全图MST = 7
      'q11': ['C'],  // T(n)=2T(n/2)+O(n²) → O(n²) (主定理 case 1)
      'q14': ['C'],  // 斐波那契差异根因 = 重叠子问题
      'q15': ['B'],  // 截止最早 = A3 (EDF调度)
    }
  }
};

let totalFixed = 0;
let totalChecked = 0;

for (const [year, info] of Object.entries(fixes)) {
  const fp = path.join(dir, info.file);
  if (!fs.existsSync(fp)) {
    console.log(`MISSING: ${info.file}`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let yearFixed = 0;
  for (const scene of data.scenes) {
    if (!scene.content || !scene.content.questions) continue;
    for (const q of scene.content.questions) {
      if (info.updates[q.id]) {
        totalChecked++;
        const oldAns = JSON.stringify(q.answer);
        const newAns = JSON.stringify(info.updates[q.id]);
        if (oldAns !== newAns) {
          q.answer = info.updates[q.id];
          console.log(`[${year}] FIXED ${q.id}: ${oldAns} -> ${newAns}`);
          yearFixed++;
        }
      }
    }
  }
  if (yearFixed > 0) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[${year}] ${yearFixed} fixes applied to ${info.file}`);
    totalFixed += yearFixed;
  } else {
    console.log(`[${year}] ${Object.keys(info.updates).length} answers verified, no changes needed`);
  }
}

console.log(`\nTotal: ${totalFixed} fixed, ${totalChecked - totalFixed} already correct, ${totalChecked} checked.`);
