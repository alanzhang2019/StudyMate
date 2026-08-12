// Comprehensive fix script for CSP-J 2014-2025 answers
// Based on web research cross-referencing multiple authoritative sources
// Idempotent: only writes if a change is needed; safe to re-run
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..', 'frontend', 'data', 'classrooms');

const fixes = {
  '2014': {
    file: 'cm_imp_cspj2014j_v1.json',
    updates: {
      'q14': ['C'],  // x = (int)(x * 100 + 0.5) / 100.0
    }
  },
  '2015': {
    file: 'cm_imp_cspj2015j_v1.json',
    updates: {
      'q16': ['D'],  // 前序=根左右, 中序=左根右 → 必须没有左子树(或只有根)
    }
  },
  '2016': {
    file: 'cm_imp_cspj2016j_v1.json',
    updates: {
      'q6':  ['A'],  // CapsLock,A,S,D循环, 第81个字符是A
    }
  },
  '2017': {
    file: 'cm_imp_cspj2017j_v1.json',
    updates: {
      'q14': ['C'],  // 串"copyright"子串个数是46 (含空串)
      'q17': ['D'],  // 合并两个长度n有序数组最坏2n-1次
    }
  },
  '2018': {
    file: 'cm_imp_cspj2018j_v1.json',
    updates: {
      'q2':  ['D'],  // (1001101011)2=619, 其它都是617
      'q6':  ['A'],  // CapsLock,A,S,D,F循环, 第81个字符是A
      'q11': ['A'],  // 4个无区别点构成的简单无向连通图个数是6
    }
  },
  '2020': {
    file: 'cm_imp_cspj2020j_v1.json',
    updates: {
      'q3':  ['C'],  // (x∧y)∨(z∨x)为真
      'p1_1': ['D'], 'p1_2': ['D'], 'p1_3': ['D'], 'p1_5': ['D'],
      'p2_1': ['C'], 'p2_2': ['C'], 'p2_3': ['C'], 'p2_4': ['B'],
    }
  },
  '2022': {
    file: 'cm_imp_cspj2022j_v1.json',
    updates: {
      'q13': ['C'],  // 八进制32.1 = 26.125
      'q14': ['B'],  // 字符串abcab有13个互不相同的子串
      'r1d1': ['A'], // 删去unsigned, 值仍≤255, 行为不变
      'r1s1': ['B'], // 输入13 8, 输出209
      'r2d1': ['B'], // 输入7 3, min执行448次不是449
      'r2s3': ['B'], // 输入100 100, 第一行7
      'r3d3': ['B'], // 任意n, k增大, 第二数变1仅对完全平方数
    }
  },
  '2023': {
    file: 'cm_imp_cspj2023j_v1.json',
    updates: {
      'r2q4': ['D'], // v[m][n]→v[n][m] 越界
      'r2q5': ['B'], // 输入csp-j p-jcs输出1
      'r2q6': ['D'], // 输入csppsc spsccp输出1
    }
  },
  '2025': {
    file: 'cm_imp_cspj2025j_v1.json',
    updates: {
      'r3q6': ['B'], // a={1..n}时LCS等价于b的最长上升子序列
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
