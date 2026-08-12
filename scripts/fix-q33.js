const fs = require('fs');
const p = 'frontend/data/classrooms/cm_imp_cspj2015j_v1.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));

// Fix q33 (② 处): D should be "count = count + 1" not "count = count - 1"
const perfect2 = d.scenes.find(x => x.title.indexOf('完善程序（2') >= 0);
const q33 = perfect2.content.questions.find(q => q.id === 'p2_2');
console.log('Before q33:', JSON.stringify(q33.options));
q33.options = [
  { value: 'A', label: 'count = 0' },
  { value: 'B', label: 'count = mid' },
  { value: 'C', label: 'count = n' },
  { value: 'D', label: 'count = count + 1' },
];
q33.answer = ['A'];
console.log('After q33:', JSON.stringify(q33.options));

fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8');
console.log('Done');
