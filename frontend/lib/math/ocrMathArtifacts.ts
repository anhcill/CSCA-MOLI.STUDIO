export const OCR_MATH_SYMBOL_REPLACEMENTS: Record<string, string> = {
  ['\u00b9']: '^1',
  ['\u00b2']: '^2',
  ['\u00b3']: '^3',
};

function normalizeVectorCoordinateGroup(value: string): string {
  return String(value || '')
    .replace(/\uff08/g, '(')
    .replace(/\uff09/g, ')')
    .replace(/\uff0c/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

export function repairVectorNotationArtifacts(input: string): string {
  return String(input || '')
    .replace(
      /(向量\s*)([A-Za-z])\s*(?:=>|⇒|→|->|\\Rightarrow\s*|\\to\s*)=?\s*([(\uff08][^()\uff08\uff09]{1,80}[)\uff09])/g,
      (_, prefix: string, name: string, coordinates: string) => (
        `${prefix}\\(\\vec{${name}}=${normalizeVectorCoordinateGroup(coordinates)}\\)`
      ),
    )
    .replace(
      /\b([a-z])\s*(?:=>|⇒|→|->|\\Rightarrow\s*|\\to\s*)=?\s*([(\uff08][^()\uff08\uff09]{1,80}[)\uff09])/gi,
      (_, name: string, coordinates: string) => `\\vec{${name}}=${normalizeVectorCoordinateGroup(coordinates)}`,
    )
    .replace(
      /\b([a-z])\s*(?:=>|⇒|→|->|\\Rightarrow\s*|\\to\s*)\s*(?=(?:[=⊥·.]|\\perp|\\cdot|[，。,.;；:：]|$))/gi,
      (_, name: string) => `\\vec{${name}}`,
    )
    .replace(/\\vec\{([a-z])\}\s*⊥\s*\\vec\{([a-z])\}/gi, '\\vec{$1}\\perp\\vec{$2}')
    .replace(/\\vec\{([a-z])\}\s*[·.]\s*\\vec\{([a-z])\}/gi, '\\vec{$1}\\cdot\\vec{$2}')
    .replace(
      /\|\s*([A-Za-z])\s*(?:=>|⇒|→|->|\\Rightarrow\s*|\\to\s*)\s*\|/g,
      (_, name: string) => `|\\vec{${name}}|`,
    );
}

export function repairOcrMathArtifacts(input: string): string {
  return repairInverseLogExponentArtifacts(repairSequenceSubscriptArtifacts(repairVectorNotationArtifacts(input)))
    .replace(/(^|[^\\A-Za-z])Delta\s*_?\s*([0-9A-Za-z]+)?/g, (_, prefix: string, index: string) => (
      `${prefix}\\Delta${index ? `_${index}` : ''}`
    ))
    .replace(/(^|[^A-Za-z_\\{])([xy])([A-Z])'/g, (_, prefix: string, axis: string, point: string) => (
      `${prefix}${axis}_{${point}'}`
    ))
    .replace(/(^|[^A-Za-z_\\{])([xy])([A-Z])\b/g, (_, prefix: string, axis: string, point: string) => (
      `${prefix}${axis}_{${point}}`
    ))
    .replace(/(^|[^\\])\{([^{}\n]*?=[^{}\n]*?)\s+([^{}\n]*?=[^{}\n]*?)\}/g, (_, prefix: string, left: string, right: string) => (
      `${prefix}\\{${left.trim()}; ${right.trim()}\\}`
    ))
    .replace(/\b(với|voi)([A-Za-z])(?=(?:\s*(?:∈|\\in|\\n|>|<|=)))/gi, '$1 $2')
    .replace(/\b([A-Za-z])\s*(?:∈|\\in|\\n)\s*([NZQR])\b/g, '$1\\in \\mathbb{$2}')
    .replace(/([A-Za-z0-9}\]])\((?=[\u4e00-\u9fff])/g, '$1（')
    .replace(/（([^（）]*?)\)(?=[\uff0c\u3002,.]|$)/g, '（$1）')
    .replace(/([\u4e00-\u9fff])\)(?=[\uff0c\u3002,.]|$)/g, '$1）');
}

export function repairInverseLogExponentArtifacts(input: string): string {
  const looksLikeInverseLog =
    /反函数|log\s*\d|\\log_\{\d+\}/i.test(input) ||
    /\by\s*=\s*[2-9]\s*(?:\(|x\s*[+-]\s*\d+).*v[ớo]i\s*x/i.test(input);
  if (!looksLikeInverseLog) return input;

  return input
    .replace(/\b([2-9])\s*\(\s*x\s*([+-])\s*(\d+)\s*\)/gi, '$1^{x$2$3}')
    .replace(/\b([2-9])\s*x\s*([+-])\s*(\d+)(?=\s*(?:[+−-]|\\|với|voi|x|$))/gi, '$1^{x$2$3}');
}

export function repairSequenceSubscriptArtifacts(input: string): string {
  const looksLikeSequence = /数列|等差|等比|第\s*\d+\s*项|\{[A-Za-z]\s*n\}/i.test(input);
  const withSequenceName = input.replace(/\{([A-Za-z])\s*n\}/g, (_, name: string) => `\\(\\{${name}_n\\}\\)`);
  if (!looksLikeSequence) return withSequenceName;

  return withSequenceName
    .replace(/\b([a-z])\s*\^\s*\{?([1-9]\d?)\}?(?=\s*(?:=|[，。,.;；:：]|$))/gi, '$1_{$2}')
    .replace(/\b([a-z])\s*([1-9]\d?)\b/g, '$1_{$2}')
    .replace(/\b([A-Z])\s*n\b/g, '$1_n')
    .replace(/\b([A-Z])\s*([1-9]\d?)\b/g, '$1_{$2}');
}

export function normalizeOcrMathSyntax(input: string): string {
  return repairOcrMathArtifacts(input)
    .replace(/\b([A-Z])\\([A-Z])\b/g, '$1\\setminus $2')
    .replace(/=>/g, '\\Rightarrow ')
    .replace(/(^|[^\\A-Za-z])log_\(([^()]+)\)/gi, '$1\\log_{($2)}')
    .replace(/(^|[^\\A-Za-z])log\s*([0-9]+)\s*\/\s*([0-9]+)(?=\s*[A-Za-z0-9(])/gi, '$1\\log_{\\frac{$2}{$3}}')
    .replace(/(^|[^\\A-Za-z])log\\pi\b/gi, '$1\\log_{\\pi}')
    .replace(/(^|[^\\A-Za-z])(ln|lg)(?=\\)/gi, (_, prefix: string, fn: string) => `${prefix}\\${fn.toLowerCase()} `)
    .replace(/(^|[^\\A-Za-z])(ln|lg)\s*([0-9]+)\b/gi, (_, prefix: string, fn: string, value: string) => `${prefix}\\${fn.toLowerCase()} ${value}`)
    .replace(/(^|[^\\A-Za-z])log\s*([0-9]+)\s*(?=\()/gi, '$1\\log_{$2}');
}
