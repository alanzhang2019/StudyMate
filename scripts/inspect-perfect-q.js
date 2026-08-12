// Inspect perfect-program question structure
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('frontend/data/classrooms/cm_imp_cspj2021j_v1.json','utf8'));
for (const s of d.scenes) {
  if (s.title && s.title.indexOf('Josephus') >= 0) {
    const q = s.content.questions[0];
    console.log('=== Question[0] ===');
    console.log('id:', q.id);
    console.log('type:', q.type);
    console.log('question:', q.question);
    console.log('options:', JSON.stringify(q.options, null, 2));
    console.log('answer:', JSON.stringify(q.answer));
    console.log('analysis:', q.analysis);
    console.log('points:', q.points);
    if (q.codeBlock) {
      console.log('codeBlock lines:', q.codeBlock.lines.length);
      console.log('codeBlock sample:', q.codeBlock.lines.slice(0,5));
    }
    break;
  }
}
