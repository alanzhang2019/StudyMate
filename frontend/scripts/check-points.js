const fs = require('fs');
const path = 'd:/AItrade/ai-math-mistake-machine/frontend/data/classrooms/cm_imp_cspj2021j_v1.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

let total = 0;
let qcount = 0;
const missingPts = [];
const breakdown = {};
const details = [];

for (const scene of data.scenes) {
  if (scene.type !== 'quiz') continue;
  const stype = scene.category;
  if (!(stype in breakdown)) breakdown[stype] = 0;
  for (const q of scene.content.questions) {
    qcount++;
    if (q.type === 'code_section') continue;
    if (q.points == null) {
      missingPts.push(`${scene.id}:${q.id}`);
    } else {
      total += q.points;
      breakdown[stype] += q.points;
      details.push(`${q.id} (${scene.id}) ${q.points}分`);
    }
  }
}
console.log('Total questions:', qcount);
console.log('Total points:', total);
console.log('Breakdown:', breakdown);
console.log('Missing points:', missingPts);
console.log('---');
for (const d of details) console.log(d);
