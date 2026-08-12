const fs = require('fs');
const p = 'frontend/data/classrooms/cm_imp_cspj2015j_v1.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));

// Find 完善程序 (1) 打印月历
const s = d.scenes.find(x => x.title.indexOf('完善程序（1') >= 0);

// Fix code: `i < ③` → `i <= ③`
const code = s.content.codeBlock.lines;
for (let i = 0; i < code.length; i++) {
  if (code[i].includes('for (i = 1; i <')) {
    code[i] = code[i].replace('for (i = 1; i < ③', 'for (i = 1; i <= ③');
    console.log(`Fixed code line ${i+1}:`, code[i]);
  }
}

// Fix q30 (④ 处)
const q30 = s.content.questions.find(q => q.id === 'p1_4');
console.log('--- Before q30 ---');
console.log(JSON.stringify(q30.options, null, 2));
console.log('answer:', q30.answer);
q30.options = [
  { value: 'A', label: '1' },
  { value: 'B', label: 'i' },
  { value: 'C', label: 'dayNum[i]' },
  { value: 'D', label: "'\\t'" },
];
q30.answer = ['B'];

// Fix q31 (⑤ 处)
const q31 = s.content.questions.find(q => q.id === 'p1_5');
console.log('--- Before q31 ---');
console.log(JSON.stringify(q31.options, null, 2));
console.log('answer:', q31.answer);
q31.options = [
  { value: 'A', label: 'i % 7' },
  { value: 'B', label: 'offset % 7' },
  { value: 'C', label: '(offset + i) % 7' },
  { value: 'D', label: 'dayNum[i] % 7' },
];
q31.answer = ['C'];
q31.analysis = '列号每行 7 列换行；当前打印的 i 出现在列 (i-1+offset)%7=6 时需换行，等价 (offset+i)%7==0。';

// Also re-check 完善程序 (2) 中位数: page 7 shows page 8
fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8');
console.log('\nWritten fix to', p);
