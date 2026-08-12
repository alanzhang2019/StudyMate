// Comprehensive fix script for CSP-J 2014-2023 answers
// Based on web research cross-referencing multiple authoritative sources
const fs = require('fs');
const path = require('path');

const dir = 'd:/AItrade/ai-math-mistake-machine/frontend/data/classrooms';

const fixes = {
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
      'p1_1': ['D'],  // 质因数分解: i初始化为2
      'p1_2': ['D'],  // 循环条件 i*i<=n
      'p1_3': ['D'],  // while(n%i==0)
      'p1_5': ['D'],  // 输出 n
      'p2_1': ['C'],  // 区间覆盖: 排序条件 A[j-1].a < A[j].a
      'p2_2': ['C'],  // A[j-1]=t (交换)
      'p2_3': ['C'],  // 过滤条件 A[i].b > A[p-1].b
      'p2_4': ['B'],  // while 条件 q+1<n && A[q+1].a<=r
    }
  },
  '2022': {
    file: 'cm_imp_cspj2022j_v1.json',
    updates: {
      'q13': ['C'],  // 八进制32.1 = 26.125 (选项C是26.125)
      'q14': ['B'],  // 字符串abcab有13个互不相同的子串
      'r2d1': ['B'], // 输入7 3时min实际执行448次, 题目说449次 -> 错误
      'r2s3': ['B'], // 输入100 100时第一行 -> 7
    }
  },
  '2023': {
    file: 'cm_imp_cspj2023j_v1.json',
    updates: {
      'r2q4': ['D'], // v[m][n]→v[n][m] 越界, 可能非正常退出
      'r2q5': ['B'], // 输入 csp-j p-jcs 输出 1
      'r2q6': ['D'], // 输入 csppsc spsccp 输出 1
    }
  }
};

let totalFixed = 0;

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
    console.log(`[${year}] No changes needed`);
  }
}

console.log(`\nTotal fixes applied: ${totalFixed}`);
