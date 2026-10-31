(function(root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.KairoMath = factory(); })(globalThis, function() {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]));
  const symbols = { alpha:'α', beta:'β', gamma:'γ', delta:'δ', epsilon:'ε', theta:'θ', lambda:'λ', mu:'μ', pi:'π', rho:'ρ', sigma:'σ', tau:'τ', phi:'φ', chi:'χ', psi:'ψ', omega:'ω', Gamma:'Γ', Delta:'Δ', Theta:'Θ', Lambda:'Λ', Sigma:'Σ', Phi:'Φ', Psi:'Ψ', Omega:'Ω', infinity:'∞', infty:'∞', times:'×', cdot:'·', pm:'±', mp:'∓', neq:'≠', le:'≤', leq:'≤', ge:'≥', geq:'≥', approx:'≈', equiv:'≡', to:'→', rightarrow:'→', leftarrow:'←', mapsto:'↦', in:'∈', notin:'∉', subset:'⊂', subseteq:'⊆', forall:'∀', exists:'∃', partial:'∂', nabla:'∇', sum:'∑', prod:'∏', int:'∫', oint:'∮', ldots:'…', cdots:'⋯', vert:'|', lbrace:'{', rbrace:'}' };
  function expression(source, depth = 0) {
    if (source.length > 10000 || depth > 32) throw new Error('Formula exceeds rendering limits.');
    const tokens = source.match(/\\(?:[A-Za-z]+|.)|\d+(?:\.\d+)?|[^\s]/g) || []; let index = 0;
    const rawGroup = () => { if (tokens[index++] !== '{') throw new Error('Expected a group.'); let level = 1, value = ''; while (index < tokens.length && level) { const token = tokens[index++]; if (token === '{') level++; if (token === '}') level--; if (level) value += token; } if (level) throw new Error('Unclosed group.'); return value; };
    const group = () => tokens[index] === '{' ? expression(rawGroup(), depth + 1) : atom();
    const atom = () => {
      const token = tokens[index++]; if (token === undefined) throw new Error('Missing expression.');
      if (token === '{') { index--; return '<mrow>' + expression(rawGroup(), depth + 1) + '</mrow>'; }
      if (token.startsWith('\\')) {
        const name = token.slice(1);
        if (name === 'frac' || name === 'dfrac' || name === 'tfrac') return '<mfrac>' + group() + group() + '</mfrac>';
        if (name === 'sqrt') { let degree = ''; if (tokens[index] === '[') { index++; while (index < tokens.length && tokens[index] !== ']') degree += tokens[index++]; if (tokens[index++] !== ']') throw new Error('Unclosed root degree.'); } const body = group(); return degree ? '<mroot>' + body + expression(degree, depth + 1) + '</mroot>' : '<msqrt>' + body + '</msqrt>'; }
        if (['text','mathrm','mathbf','mathbb','operatorname'].includes(name)) return '<mstyle mathvariant="' + ({mathbf:'bold',mathbb:'double-struck'}[name] || 'normal') + '"><mtext>' + escape(rawGroup()) + '</mtext></mstyle>';
        if (name === 'left' || name === 'right') { const delimiter = tokens[index++]; return delimiter === '.' ? '' : '<mo stretchy="true">' + escape(symbols[delimiter?.slice(1)] || delimiter || '') + '</mo>'; }
        if (name === 'begin') {
          const environment = rawGroup(); if (!['matrix','pmatrix','bmatrix','aligned','cases'].includes(environment)) throw new Error('Unsupported math environment.');
          let body = ''; while (index < tokens.length && tokens[index] !== '\\end') body += tokens[index++]; if (tokens[index++] !== '\\end' || rawGroup() !== environment) throw new Error('Unclosed math environment.');
          const table = '<mtable>' + body.split('\\\\').map(row => '<mtr>' + row.split('&').map(cell => '<mtd><mrow>' + expression(cell, depth + 1) + '</mrow></mtd>').join('') + '</mtr>').join('') + '</mtable>';
          const delimiters = {pmatrix:['(',')'],bmatrix:['[',']'],cases:['{','']}[environment]; return delimiters ? '<mrow><mo stretchy="true">' + delimiters[0] + '</mo>' + table + '<mo stretchy="true">' + delimiters[1] + '</mo></mrow>' : table;
        }
        if (['sin','cos','tan','log','ln','exp','lim','min','max','det'].includes(name)) return '<mi mathvariant="normal">' + name + '</mi>';
        if ([',',';','quad','qquad','!',' '].includes(name)) return '<mspace width="' + (name === 'qquad' ? '2em' : name === 'quad' ? '1em' : '0.25em') + '"/>';
        if (symbols[name]) return '<mo>' + escape(symbols[name]) + '</mo>';
        return '<mtext>' + escape(token) + '</mtext>';
      }
      if (/^\d/.test(token)) return '<mn>' + token + '</mn>';
      return /^[A-Za-z]$/.test(token) ? '<mi>' + token + '</mi>' : '<mo>' + escape(token) + '</mo>';
    };
    let output = '';
    while (index < tokens.length) {
      let base = atom(), sub = '', sup = '';
      while (['_','^'].includes(tokens[index])) { const script = tokens[index++], value = group(); if (script === '_') sub = value; else sup = value; }
      if (sub && sup) base = '<msubsup>' + base + sub + sup + '</msubsup>'; else if (sub) base = '<msub>' + base + sub + '</msub>'; else if (sup) base = '<msup>' + base + sup + '</msup>';
      output += base;
    }
    return '<mrow>' + output + '</mrow>';
  }
  function render(source, display = false) { try { return '<math xmlns="http://www.w3.org/1998/Math/MathML" display="' + (display ? 'block' : 'inline') + '" aria-label="' + escape(source) + '">' + expression(source) + '</math>'; } catch { return '<code class="math-error">' + escape(source) + '</code>'; } }
  return { render };
});
