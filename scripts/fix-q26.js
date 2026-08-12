const fs = require('fs');
const p = 'frontend/data/classrooms/cm_imp_cspj2015j_v1.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
const s = d.scenes.find(x => x.content.codeBlock && x.content.codeBlock.title.indexOf('（4') >= 0);
s.content.codeBlock.lines = [
  '#include <iostream>',
  'using namespace std;',
  'void fun(char *a, char *b) {',
  '  a = b;',
  '  (*a)++;',
  '}',
  'int main() {',
  '  char c1, c2, *p1, *p2;',
  "  c1 = 'A';",
  "  c2 = 'a';",
  '  p1 = &c1;',
  '  p2 = &c2;',
  '  fun(p1, p2);',
  '  cout << c1 << c2 << endl;',
  '  return 0;',
  '}',
];
const q = s.content.questions[0];
q.answer = ['D'];
q.options = [
  { value: 'A', label: 'ba' },
  { value: 'B', label: 'aa' },
  { value: 'C', label: 'Ba' },
  { value: 'D', label: 'Ab' },
];
q.analysis = "fun 函数先 a=b 使 a 指向 c2，再 (*a)++ 即 c2++。c1 保持 'A' 不变，c2 从 'a' 变为 'b'，输出 \"Ab\"。";
fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n', 'utf8');
console.log('Fixed q26. answer=', q.answer, '| code lines:', s.content.codeBlock.lines.length);
console.log('New code:');
s.content.codeBlock.lines.forEach((l, i) => console.log((i+1).toString().padStart(2, ' ') + '| ' + l));
