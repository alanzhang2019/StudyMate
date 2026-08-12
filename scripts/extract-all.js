const fs = require('fs');
const path = require('path');

const dir = 'd:/AItrade/ai-math-mistake-machine/frontend/data/classrooms';
const years = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2022, 2023];

const out = [];
for (const y of years) {
  const id = `cm_imp_cspj${y}j_v1`;
  const fp = path.join(dir, `${id}.json`);
  if (!fs.existsSync(fp)) {
    out.push(`MISSING: ${id}`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  out.push(`\n===== ${id} (${data.stage.name}) =====`);
  for (const scene of data.scenes) {
    if (!scene.content || !scene.content.questions) continue;
    for (const q of scene.content.questions) {
      const qtext = q.question.replace(/[\r\n]+/g, ' ').substring(0, 80);
      out.push(`${q.id} [${scene.title.substring(0,20)}] | ans=${JSON.stringify(q.answer)} pts=${q.points} | ${qtext}`);
    }
  }
}

const outPath = 'd:/AItrade/ai-math-mistake-machine/scripts/current-answers.txt';
fs.writeFileSync(outPath, out.join('\n'), 'utf8');
console.log(`Wrote ${out.length} lines to ${outPath}`);
