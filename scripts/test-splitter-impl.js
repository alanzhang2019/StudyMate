// C++ line splitter - converts compact one-line code into properly indented multi-line code
// Splits on `;`, `{`, `}` at top level (parenDepth=0), handles ① ② ③ placeholders,
// nested for/while/if without braces, and `else` keyword.

function splitCppLine(line) {
  if (line === '' || /^\s*$/.test(line)) return [''];
  const result = [];
  let buffer = '';
  let braceIndent = 0;
  let extraIndent = 0;
  const bodyStack = []; // 'brace' or 'nonBrace'
  let parenDepth = 0;
  let i = 0;
  const curIndent = () => Math.max(0, braceIndent + extraIndent);

  function flush() {
    const s = buffer.replace(/\s+$/, '');
    if (s.length > 0) {
      result.push('  '.repeat(curIndent()) + s);
    }
    buffer = '';
  }

  function skipWs(j) {
    while (j < line.length && /\s/.test(line[j])) j++;
    return j;
  }

  // Find whether the `(` matching the `)` at position `closePos` in `buf`
  // is preceded by a control-flow keyword (for/while/if/switch)
  function isControlFlowParen(buf, closePos) {
    let depth = 0;
    for (let p = closePos; p >= 0; p--) {
      if (buf[p] === ')') depth++;
      else if (buf[p] === '(') {
        depth--;
        if (depth === 0) {
          let j = p - 1;
          while (j >= 0 && /\s/.test(buf[j])) j--;
          let k = j;
          while (k >= 0 && /[a-zA-Z_]/.test(buf[k])) k--;
          const keyword = buf.slice(k + 1, j + 1);
          return /^(for|while|if|switch)$/.test(keyword);
        }
      }
    }
    return false;
  }

  while (i < line.length) {
    const ch = line[i];

    // Skip leading whitespace at the start of a new statement
    if (buffer === '' && parenDepth === 0 && /\s/.test(ch)) { i++; continue; }

    // String literal
    if (ch === '"' || ch === "'") {
      const q = ch;
      buffer += ch; i++;
      while (i < line.length) {
        buffer += line[i];
        if (line[i] === '\\' && i + 1 < line.length) {
          buffer += line[i + 1]; i += 2; continue;
        }
        if (line[i] === q) { i++; break; }
        i++;
      }
      continue;
    }

    // Placeholder ① ② ③ ...
    if (/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(ch)) {
      buffer += ch; i++; continue;
    }

    // Handle `else` keyword for extra indent
    if (parenDepth === 0 && /^\s*else\s*$/.test(buffer)) {
      flush();
      const j = skipWs(i);
      if (j < line.length && line[j] !== '{' && line[j] !== ';') {
        // Check if it's `else if`
        if (!/^if[\s(]/.test(line.slice(j))) {
          bodyStack.push('nonBrace');
          extraIndent++;
        }
        // For `else if`, the `if` will handle its own nonBrace push
      }
      i = j; // skip whitespace, next iteration processes the body start
      continue;
    }

    if (ch === '(') {
      buffer += ch;
      parenDepth++;
    } else if (ch === ')') {
      buffer += ch;
      parenDepth--;
      // Lookahead for body (only at top level)
      if (parenDepth === 0) {
        const j = skipWs(i + 1);
        if (j < line.length && line[j] !== '{' && line[j] !== ';') {
          if (isControlFlowParen(buffer, buffer.length - 1)) {
            flush();
            bodyStack.push('nonBrace');
            extraIndent++;
          }
        }
      }
    } else if (ch === '{' && parenDepth === 0) {
      // K&R style: keep `{` at end of line
      buffer = buffer.replace(/\s+$/, '') + ' {';
      flush();
      bodyStack.push('brace');
      braceIndent++;
    } else if (ch === '}' && parenDepth === 0) {
      flush();
      braceIndent--;
      // Pop the matching 'brace' and any 'nonBrace' markers that were inside it
      // (e.g. for `if(x) for(...) {...}`, the outer if's `nonBrace` is on the stack
      //  and should be popped when the for's body closes)
      while (bodyStack.length > 0) {
        const top = bodyStack.pop();
        if (top === 'brace') break;
        else { extraIndent--; }
      }
      const j = skipWs(i + 1);
      if (j < line.length && line[j] === ';') {
        result.push('  '.repeat(curIndent()) + '};');
        i = j + 1;
        continue;
      } else {
        result.push('  '.repeat(curIndent()) + '}');
      }
    } else if (ch === ';' && parenDepth === 0) {
      buffer += ';';
      flush();
      // Pop all 'nonBrace' markers - a single `;` ends a chain of non-braced bodies
      while (bodyStack.length > 0 && bodyStack[bodyStack.length - 1] === 'nonBrace') {
        bodyStack.pop();
        extraIndent--;
      }
    } else if (ch === '\n' && parenDepth === 0) {
      // Treat newline as a line break (only at top level, not inside parens)
      flush();
    } else {
      buffer += ch;
    }
    i++;
  }

  flush();
  return result;
}

module.exports = { splitCppLine };
