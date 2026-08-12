// Test the C++ line splitter on sample CSP code
const splitter = require('./test-splitter-impl.js');

const tests = [
  {
    name: 'simple declarations',
    input: '#include <iostream>',
    expected: ['#include <iostream>'],
  },
  {
    name: 'struct with member',
    input: 'struct point { int x, y, id; };',
    expected: [
      'struct point {',
      '  int x, y, id;',
      '};',
    ],
  },
  {
    name: 'function with return',
    input: 'bool equals(point a, point b) { return a.x == b.x && a.y == b.y; }',
    expected: [
      'bool equals(point a, point b) {',
      '  return a.x == b.x && a.y == b.y;',
      '}',
    ],
  },
  {
    name: 'function with placeholder',
    input: 'bool cmp(point a, point b) { return ①; }',
    expected: [
      'bool cmp(point a, point b) {',
      '  return ①;',
      '}',
    ],
  },
  {
    name: 'nested for-if',
    input: 'void sort(point A[], int n) { for(int i=0;i<n;i++) for(int j=1;j<n;j++) if(cmp(A[j],A[j-1])) { point t=A[j]; A[j]=A[j-1]; A[j-1]=t; } }',
    expected: [
      'void sort(point A[], int n) {',
      '  for(int i=0;i<n;i++)',
      '    for(int j=1;j<n;j++)',
      '      if(cmp(A[j],A[j-1])) {',
      '        point t=A[j];',
      '        A[j]=A[j-1];',
      '        A[j-1]=t;',
      '      }',
      '}',
    ],
  },
  {
    name: 'unique function',
    input: 'int unique(point A[], int n) { int t=0; for(int i=0;i<n;i++) if(②) A[t++]=A[i]; return t; }',
    expected: [
      'int unique(point A[], int n) {',
      '  int t=0;',
      '  for(int i=0;i<n;i++)',
      '    if(②)',
      '      A[t++]=A[i];',
      '  return t;',
      '}',
    ],
  },
  {
    name: 'binary_search',
    input: 'bool binary_search(point A[], int n, int x, int y) { point p; p.x=x; p.y=y; p.id=n; int a=0, b=n-1; while(a<b) { int mid=③; if(④) a=mid+1; else b=mid; } return equals(A[a], p); }',
    expected: [
      'bool binary_search(point A[], int n, int x, int y) {',
      '  point p;',
      '  p.x=x;',
      '  p.y=y;',
      '  p.id=n;',
      '  int a=0, b=n-1;',
      '  while(a<b) {',
      '    int mid=③;',
      '    if(④)',
      '      a=mid+1;',
      '    else',
      '      b=mid;',
      '  }',
      '  return equals(A[a], p);',
      '}',
    ],
  },
  {
    name: 'main with nested loops and ⑤',
    input: 'int main() { int n; cin>>n; for(int i=0;i<n;i++) { cin>>A[i].x>>A[i].y; A[i].id=i; } sort(A,n); n=unique(A,n); int ans=0; for(int i=0;i<n;i++) for(int j=0;j<n;j++) if(⑤ && binary_search(A,n,A[i].x,A[j].y) && binary_search(A,n,A[j].x,A[i].y)) ans++; cout<<ans<<endl; }',
    expected: [
      'int main() {',
      '  int n;',
      '  cin>>n;',
      '  for(int i=0;i<n;i++) {',
      '    cin>>A[i].x>>A[i].y;',
      '    A[i].id=i;',
      '  }',
      '  sort(A,n);',
      '  n=unique(A,n);',
      '  int ans=0;',
      '  for(int i=0;i<n;i++)',
      '    for(int j=0;j<n;j++)',
      '      if(⑤ && binary_search(A,n,A[i].x,A[j].y) && binary_search(A,n,A[j].x,A[i].y))',
      '        ans++;',
      '  cout<<ans<<endl;',
      '}',
    ],
  },
];

let passed = 0, failed = 0;
for (const t of tests) {
  const actual = splitter.splitCppLine(t.input);
  const actualStr = actual.join('\n');
  const expectedStr = t.expected.join('\n');
  if (actualStr === expectedStr) {
    console.log('✓ ' + t.name);
    passed++;
  } else {
    console.log('✗ ' + t.name);
    console.log('  Expected:');
    for (const l of t.expected) console.log('    ' + l);
    console.log('  Actual:');
    for (const l of actual) console.log('    ' + l);
    failed++;
  }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
