const test = require('node:test'), assert = require('node:assert/strict'), C = require('../src/lib/core');
test('LaTeX renders fractions, roots, scripts and matrices through native MathML without altering code fences', () => {
  const html = C.markdown('Inline $\\frac{1}{2}$\n\n$$x_i^2 + \\sqrt[3]{y}$$\n\n$\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}$\n\n```text\n$x$\n```');
  for (const element of ['<math', '<mfrac>', '<msubsup>', '<mroot>', '<mtable>']) assert.ok(html.includes(element), element);
  assert.ok(html.includes('<code>$x$')); assert.ok(html.includes('display="block"'));
});
test('untrusted or incomplete formulas remain escaped and bounded', () => {
  const html = C.markdown('$<script>alert(1)</script>$ and $\\frac{broken$');
  assert.ok(!html.includes('<script>')); assert.ok(html.includes('math-error')); assert.ok(html.includes('&lt;script'));
});
