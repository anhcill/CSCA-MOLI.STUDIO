function stringValue(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function repairSequenceSubscriptArtifacts(value) {
  const input = stringValue(value);
  const looksLikeSequence = /数列|等差|等比|第\s*\d+\s*项|\{[A-Za-z]\s*n\}/i.test(input);
  const withSequenceName = input.replace(/\{([A-Za-z])\s*n\}/g, (_, name) => `\\(\\{${name}_n\\}\\)`);
  if (!looksLikeSequence) return withSequenceName;

  return withSequenceName
    .replace(/\b([a-z])\s*\^\s*\{?([1-9]\d?)\}?(?=\s*(?:=|[，。,.;；:：]|$))/gi, "$1_{$2}")
    .replace(/\b([a-z])\s*([1-9]\d?)\b/g, "$1_{$2}")
    .replace(/\b([A-Z])\s*n\b/g, "$1_n")
    .replace(/\b([A-Z])\s*([1-9]\d?)\b/g, "$1_{$2}");
}

function repairInverseLogExponentArtifacts(value) {
  const input = stringValue(value);
  const looksLikeInverseLog =
    /反函数|log\s*\d|\\log_\{\d+\}/i.test(input) ||
    /\by\s*=\s*[2-9]\s*(?:\(|x\s*[+-]\s*\d+).*v[ớo]i\s*x/i.test(input);
  if (!looksLikeInverseLog) return input;

  return input
    .replace(/\b([2-9])\s*\(\s*x\s*([+-])\s*(\d+)\s*\)/gi, "$1^{x$2$3}")
    .replace(/\b([2-9])\s*x\s*([+-])\s*(\d+)(?=\s*(?:[+−-]|\\|với|voi|x|$))/gi, "$1^{x$2$3}");
}

function normalizeVectorCoordinateGroup(value) {
  return stringValue(value)
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/，/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function repairVectorNotationArtifacts(value) {
  return stringValue(value)
    .replace(
      /(向量\s*)([A-Za-z])\s*(?:=>|⇒|→|->|\\Rightarrow\s*|\\to\s*)=?\s*([（(][^()（）]{1,80}[)）])/g,
      (_, prefix, name, coordinates) => `${prefix}\\(\\vec{${name}}=${normalizeVectorCoordinateGroup(coordinates)}\\)`,
    )
    .replace(
      /\b([a-z])\s*(?:=>|⇒|→|->|\\Rightarrow\s*|\\to\s*)=?\s*([（(][^()（）]{1,80}[)）])/gi,
      (_, name, coordinates) => `\\vec{${name}}=${normalizeVectorCoordinateGroup(coordinates)}`,
    )
    .replace(
      /\b([a-z])\s*(?:=>|⇒|→|->|\\Rightarrow\s*|\\to\s*)\s*(?=(?:[=⊥·.]|\\perp|\\cdot|[，。,.;；:：]|$))/gi,
      (_, name) => `\\vec{${name}}`,
    )
    .replace(/\\vec\{([a-z])\}\s*⊥\s*\\vec\{([a-z])\}/gi, "\\vec{$1}\\perp\\vec{$2}")
    .replace(/\\vec\{([a-z])\}\s*[·.]\s*\\vec\{([a-z])\}/gi, "\\vec{$1}\\cdot\\vec{$2}")
    .replace(
      /\|\s*([A-Za-z])\s*(?:=>|⇒|→|->|\\Rightarrow\s*|\\to\s*)\s*\|/g,
      (_, name) => `|\\vec{${name}}|`,
    );
}

function repairLooseSqrtRadicands(value) {
  return stringValue(value).replace(/\\sqrt\{\}\s*([([{][^=。\n；;，,]+)(?=\s*=)/g, (_, radicand) => {
    const clean = stringValue(radicand).trim();
    return clean ? `\\sqrt{${clean}}` : "\\sqrt{}";
  });
}

function repairOcrMathArtifacts(value) {
  return repairLooseSqrtRadicands(repairInverseLogExponentArtifacts(repairSequenceSubscriptArtifacts(repairVectorNotationArtifacts(stringValue(value))
    .replace(/¹/g, "^1")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3"))))
    .replace(/(^|[^\\A-Za-z])Delta\s*_?\s*([0-9A-Za-z]+)?/g, (_, prefix, index) => (
      `${prefix}\\Delta${index ? `_${index}` : ""}`
    ))
    .replace(/(^|[^A-Za-z_\\{])([xy])([A-Z])'/g, (_, prefix, axis, point) => (
      `${prefix}${axis}_{${point}'}`
    ))
    .replace(/(^|[^A-Za-z_\\{])([xy])([A-Z])\b/g, (_, prefix, axis, point) => (
      `${prefix}${axis}_{${point}}`
    ))
    .replace(/(^|[^\\])\{([^{}\n]*?=[^{}\n]*?)\s+([^{}\n]*?=[^{}\n]*?)\}/g, (_, prefix, left, right) => (
      `${prefix}\\{${stringValue(left).trim()}; ${stringValue(right).trim()}\\}`
    ))
    .replace(/⇔/g, "\\Leftrightarrow")
    .replace(/⇒|=>/g, "\\Rightarrow")
    .replace(/\b([A-Z])\\([A-Z])\b/g, "$1\\setminus $2")
    .replace(/(^|[^\\A-Za-z])log_\(([^()]+)\)/gi, "$1\\log_{($2)}")
    .replace(/(^|[^\\A-Za-z])log\s*([0-9]+)\s*\/\s*([0-9]+)(?=\s*[A-Za-z0-9(])/gi, "$1\\log_{\\frac{$2}{$3}}")
    .replace(/(^|[^\\A-Za-z])log\\pi\b/gi, "$1\\log_{\\pi}")
    .replace(/(^|[^\\A-Za-z])(ln|lg)(?=\\)/gi, (_, prefix, fn) => `${prefix}\\${fn.toLowerCase()} `)
    .replace(/(^|[^\\A-Za-z])(ln|lg)\s*([0-9]+)\b/gi, (_, prefix, fn, value) => `${prefix}\\${fn.toLowerCase()} ${value}`)
    .replace(/\blog\s*([0-9]+)\s*(?=\()/gi, "\\log_{$1}")
    .replace(/\b(với|voi)([A-Za-z])(?=(?:\s*(?:∈|\\in|\\n|>|<|=)))/gi, "$1 $2")
    .replace(/([A-Za-z])\s*(?:∈|\\in|\\n)\s*([NZQR])\b/g, "$1\\in \\mathbb{$2}")
    .replace(/([A-Za-z0-9}\]])\((?=[\u4e00-\u9fff])/g, "$1（")
    .replace(/（([^（）]*?)\)(?=[，。,.]|$)/g, "（$1）")
    .replace(/（([\u4e00-\u9fff])\)(?=[，。,.]|$)/g, "$1）");

  return cleanAiGeneratedMathArtifacts(repaired);
}

function cleanAiGeneratedMathArtifacts(value) {
  const input = stringValue(value);
  if (!input) return "";

  return input
    // 1. Fix spacing artifacts
    .replace(/\bConsider\s*option\s*([A-H])(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "Consider option $1")
    .replace(/\bConsideroption\s*([A-H])(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "Consider option $1")
    .replace(/\bConsideroption([A-H])(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "Consider option $1")
    .replace(/\bWehave(?=\d|\b)/gi, "We have ")
    .replace(/\bdoesnot\b/gi, "does not ")
    .replace(/\bdoesnotexist\b/gi, "does not exist")
    .replace(/\bTruestatement\b/gi, "True statement")
    .replace(/\bFalsestatement\b/gi, "False statement")
    .replace(/\bOption([A-H])\b/g, "Option $1")
    .replace(/\bis(?=\d)/gi, "is ")
    
    // 2. Fix false-positive backslashes in English words
    .replace(/\\sin\s*ce(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "since")
    .replace(/\\since(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "since")
    .replace(/\\sincere(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "sincere")
    .replace(/\\sincerely(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "sincerely")
    .replace(/\\cos\s*t(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cost")
    .replace(/\\cost(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cost")
    .replace(/\\costly(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "costly")
    .replace(/\\cosmetic(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cosmetic")
    .replace(/\\cosplay(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cosplay")
    .replace(/\\con\s*tact(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "contact")
    .replace(/\\contact(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "contact")
    
    // 3. Fix false-positive backslashes in Vietnamese words
    .replace(/\\tan\s+hết(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "tan hết")
    .replace(/\\tan\s+vỡ(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "tan vỡ")
    .replace(/\\tan\s+học(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "tan học")
    .replace(/\\tan\s+biến(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "tan biến")
    .replace(/\\tan\s+rã(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "tan rã")
    .replace(/\\tan\s+chảy(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "tan chảy")
    .replace(/\\tan\s+hoang(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "tan hoang")
    .replace(/\\tan\s+nát(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "tan nát")
    
    // 4. Fix false-positive backslashes in column/cột words
    .replace(/\\cột\s+mốc(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cột mốc")
    .replace(/\\cot\s+mốc(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cột mốc")
    .replace(/\\cột\s+cờ(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cột cờ")
    .replace(/\\cot\s+cờ(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cột cờ")
    .replace(/\\cột\s+nhà(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cột nhà")
    .replace(/\\cot\s+nhà(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cột nhà")
    .replace(/\\cột\s+điện(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cột điện")
    .replace(/\\cot\s+điện(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cột điện")
    .replace(/\\cột\s+sống(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cột sống")
    .replace(/\\cot\s+sống(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "cột sống")
    
    // 5. Fix false-positive backslashes in sector/second/section words
    .replace(/\\sec\s*tor(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "sector")
    .replace(/\\sector(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "sector")
    .replace(/\\sec\s*ond(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "second")
    .replace(/\\second(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "second")
    .replace(/\\sec\s*tion(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "section")
    .replace(/\\section(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "section")
    .replace(/\\sec\s*ure(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "secure")
    .replace(/\\secure(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "secure")
    .replace(/\\sec\s*ret(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "secret")
    .replace(/\\secret(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, "secret")
    
    // 6. Fix spaces before does not exist
    .replace(/\bdoes\s*not\s*exist(?![a-zA-Z0-9_\u00C0-\u1EF9])/gi, " does not exist")
    .replace(/\s+([,.;:!%?)\uFF0C\u3002\uFF1B\uFF1A\uFF09])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  repairOcrMathArtifacts,
  repairInverseLogExponentArtifacts,
  repairLooseSqrtRadicands,
  repairSequenceSubscriptArtifacts,
  repairVectorNotationArtifacts,
  cleanAiGeneratedMathArtifacts,
};
