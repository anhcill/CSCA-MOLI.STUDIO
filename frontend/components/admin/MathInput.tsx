'use client';

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { FiDivide, FiEye, FiEyeOff, FiHash, FiRefreshCw } from 'react-icons/fi';
import RichMathText from '@/components/common/RichMathText';
import {
  normalizeAdminMathInputText,
  normalizeLatexMath,
  normalizeMathText,
  repairMathFormatArtifacts,
} from '@/lib/math/normalizeMath';

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  cnLabel?: string;
  cnValue?: string;
  onCnChange?: (value: string) => void;
  cnPlaceholder?: string;
  defaultTab?: 'vi' | 'cn';
  showInlinePreview?: boolean;
  commitDelayMs?: number;
}

const PRESET_TEMPLATES = [
  { symbol: '∑', label: 'Tổng', formula: '\\sum_{i=1}^{n}' },
  { symbol: '∫', label: 'Tích phân', formula: '\\int_{a}^{b}' },
  { symbol: '√', label: 'Căn', formula: '\\sqrt{x}' },
  { symbol: 'x²', label: 'Mũ', formula: 'x^{2}' },
  { symbol: 'x/y', label: 'Phân số', formula: '\\frac{a}{b}' },
  { symbol: 'π', label: 'Pi', formula: '\\pi' },
  { symbol: 'θ', label: 'Theta', formula: '\\theta' },
  { symbol: '∞', label: 'Vô cực', formula: '\\infty' },
  { symbol: '≤', label: '≤', formula: '\\leq' },
  { symbol: '≥', label: '≥', formula: '\\geq' },
  { symbol: '±', label: '±', formula: '\\pm' },
  { symbol: '≠', label: '≠', formula: '\\neq' },
  { symbol: 'α', label: 'Alpha', formula: '\\alpha' },
  { symbol: 'β', label: 'Beta', formula: '\\beta' },
  { symbol: 'γ', label: 'Gamma', formula: '\\gamma' },
  { symbol: 'μ', label: 'Mu', formula: '\\mu' },
  { symbol: 'Δ', label: 'Delta', formula: '\\Delta' },
  { symbol: '∂', label: 'Partial', formula: '\\partial' },
  { symbol: '·', label: 'Nhân', formula: '\\cdot' },
  { symbol: '÷', label: 'Chia', formula: '\\div' },
];

function insertMathIntoText(text: string, latex: string): string {
  const formatted = formatCustomMathInput(latex);
  return text ? `${text} ${formatted}` : formatted;
}

function displayMath(latex: string): string {
  return `\\(${latex}\\)`;
}

function shouldTreatAsMixedText(input: string): boolean {
  const trimmed = input.trim();
  if (!/\s/.test(trimmed)) return false;
  if (/^\\(?:text|mathrm|operatorname)\s*\{/.test(trimmed)) return false;

  const withoutCommands = trimmed.replace(/\\[a-zA-Z]+/g, '');
  const words = withoutCommands.match(/[A-Za-z\u00C0-\u1EF9]{2,}/g) || [];
  return words.length >= 2;
}

function isMathToken(token: string): boolean {
  return (
    /\\[a-zA-Z]+/.test(token) ||
    /[\^_{}=+\-*/<>\u2264\u2265]/.test(token) ||
    /^\d+(?:[.,]\d+)?$/.test(token) ||
    /^[a-zA-Z]$/.test(token)
  );
}

function wrapMixedMathFragments(input: string): string {
  const parts = input.trim().split(/(\s+)/);
  const out: string[] = [];
  const mathBuffer: string[] = [];
  let pendingSpace = '';

  const flushMath = () => {
    if (!mathBuffer.length) return;
    out.push(displayMath(mathBuffer.join('').trim()));
    mathBuffer.length = 0;
  };

  for (const part of parts) {
    if (!part) continue;

    if (/^\s+$/.test(part)) {
      pendingSpace += part;
      continue;
    }

    if (isMathToken(part)) {
      if (mathBuffer.length) {
        mathBuffer.push(pendingSpace);
      } else {
        out.push(pendingSpace);
      }
      pendingSpace = '';
      mathBuffer.push(part);
      continue;
    }

    flushMath();
    out.push(pendingSpace, part);
    pendingSpace = '';
  }

  flushMath();
  out.push(pendingSpace);

  return out.join('');
}

function formatCustomMathInput(input: string): string {
  const trimmed = normalizeLatexMath(input);
  if (!trimmed) return '';

  return shouldTreatAsMixedText(trimmed)
    ? wrapMixedMathFragments(trimmed)
    : displayMath(trimmed);
}

export default function MathInput({
  value,
  onChange,
  placeholder = 'Nhập giải thích...',
  label,
  cnLabel,
  cnValue,
  onCnChange,
  cnPlaceholder,
  defaultTab = 'vi',
  showInlinePreview = true,
  commitDelayMs = 0,
}: MathInputProps) {
  const [showMath, setShowMath] = useState(false);
  const [mathInput, setMathInput] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [tab, setTab] = useState<'vi' | 'cn'>(defaultTab);
  const [showPreview, setShowPreview] = useState(true);
  const [draftValue, setDraftValue] = useState(value || '');
  const [draftCnValue, setDraftCnValue] = useState(cnValue || '');
  const mathRef = useRef<HTMLTextAreaElement>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef({ vi: value || '', cn: cnValue || '' });
  const lastCommittedRef = useRef({ vi: value || '', cn: cnValue || '' });
  const dirtyDraftRef = useRef({ vi: false, cn: false });
  const onChangeRef = useRef(onChange);
  const onCnChangeRef = useRef(onCnChange);

  const currentValue = tab === 'vi' ? draftValue : draftCnValue;
  const deferredCurrentValue = useDeferredValue(currentValue);
  const deferredMathInput = useDeferredValue(mathInput);
  const currentRepairCandidate = useMemo(
    () => repairMathFormatArtifacts(currentValue),
    [currentValue],
  );
  const repairedPreviewValue = useMemo(
    () => repairMathFormatArtifacts(deferredCurrentValue),
    [deferredCurrentValue],
  );
  const canRepairCurrentValue = Boolean(currentValue && currentRepairCandidate !== currentValue);

  useEffect(() => {
    onChangeRef.current = onChange;
    onCnChangeRef.current = onCnChange;
  }, [onChange, onCnChange]);

  useEffect(() => {
    const nextValue = value || '';
    lastCommittedRef.current.vi = nextValue;
    if (!dirtyDraftRef.current.vi || latestDraftRef.current.vi === nextValue) {
      dirtyDraftRef.current.vi = false;
      latestDraftRef.current.vi = nextValue;
      setDraftValue(nextValue);
    }
  }, [value]);

  useEffect(() => {
    const nextValue = cnValue || '';
    lastCommittedRef.current.cn = nextValue;
    if (!dirtyDraftRef.current.cn || latestDraftRef.current.cn === nextValue) {
      dirtyDraftRef.current.cn = false;
      latestDraftRef.current.cn = nextValue;
      setDraftCnValue(nextValue);
    }
  }, [cnValue]);

  const clearCommitTimer = () => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  };

  const commitDraftValue = (targetTab: 'vi' | 'cn', nextValue = latestDraftRef.current[targetTab]) => {
    if (lastCommittedRef.current[targetTab] === nextValue) {
      dirtyDraftRef.current[targetTab] = false;
      return;
    }
    lastCommittedRef.current[targetTab] = nextValue;
    dirtyDraftRef.current[targetTab] = false;
    if (targetTab === 'vi') {
      onChangeRef.current(nextValue);
    } else {
      onCnChangeRef.current?.(nextValue);
    }
  };

  const scheduleCommit = (targetTab: 'vi' | 'cn', nextValue: string) => {
    latestDraftRef.current[targetTab] = nextValue;
    dirtyDraftRef.current[targetTab] = true;
    clearCommitTimer();
    if (commitDelayMs <= 0) {
      commitDraftValue(targetTab, nextValue);
      return;
    }
    commitTimerRef.current = setTimeout(() => {
      commitDraftValue(targetTab, nextValue);
      commitTimerRef.current = null;
    }, commitDelayMs);
  };

  const flushCurrentDraft = () => {
    clearCommitTimer();
    commitDraftValue(tab);
  };

  useEffect(() => {
    return () => {
      clearCommitTimer();
      const latestDraft = latestDraftRef.current;
      if (lastCommittedRef.current.vi !== latestDraft.vi) {
        onChangeRef.current(latestDraft.vi);
      }
      if (lastCommittedRef.current.cn !== latestDraft.cn) {
        onCnChangeRef.current?.(latestDraft.cn);
      }
    };
  }, []);

  useEffect(() => {
    if (cnLabel && defaultTab === 'cn') {
      setTab('cn');
    }
  }, [cnLabel, cnValue, defaultTab]);

  useEffect(() => {
    if (showMath && mathRef.current) {
      mathRef.current.focus();
    }
  }, [showMath]);

  useEffect(() => {
    if (!showMath || !deferredMathInput.trim()) {
      setPreviewHtml('');
      return;
    }

    const previewTimer = window.setTimeout(() => {
      setPreviewHtml(renderMathDisplay(formatCustomMathInput(deferredMathInput)));
    }, 80);

    return () => window.clearTimeout(previewTimer);
  }, [deferredMathInput, showMath]);

  const handleInsertPreset = (formula: string) => {
    const wrapped = displayMath(formula);
    const newVal = currentValue ? `${currentValue} ${wrapped}` : wrapped;
    if (tab === 'vi') {
      setDraftValue(newVal);
    } else {
      setDraftCnValue(newVal);
    }
    scheduleCommit(tab, newVal);
  };

  const handleInsertCustom = () => {
    if (!mathInput.trim()) return;
    const newVal = insertMathIntoText(currentValue, mathInput);
    if (tab === 'vi') {
      setDraftValue(newVal);
    } else {
      setDraftCnValue(newVal);
    }
    scheduleCommit(tab, newVal);
    startTransition(() => {
      setMathInput('');
      setPreviewHtml('');
      setShowMath(false);
    });
  };

  const handleCurrentValueChange = (nextValue: string) => {
    if (tab === 'vi') {
      setDraftValue(nextValue);
    } else {
      setDraftCnValue(nextValue);
    }
    scheduleCommit(tab, nextValue);
  };

  const handleRawInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleCurrentValueChange(e.target.value);
  };

  const handleRepairFormat = () => {
    const repairedValue = normalizeAdminMathInputText(currentValue);
    if (!repairedValue || repairedValue === currentValue) return;
    handleCurrentValueChange(repairedValue);
  };

  return (
    <div
      className="space-y-2"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          flushCurrentDraft();
        }
      }}
    >
      {(label || (tab === 'cn' && cnLabel)) && (
        <label className="block text-sm font-medium text-gray-700">
          {tab === 'cn' && cnLabel ? cnLabel : label}
        </label>
      )}

      {cnLabel && (
        <div className="flex gap-2 mb-1">
          <button
            type="button"
            onClick={() => {
              flushCurrentDraft();
              setTab('vi');
            }}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
              tab === 'vi'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🇻🇳 Tiếng Việt
          </button>
          <button
            type="button"
            onClick={() => {
              flushCurrentDraft();
              setTab('cn');
            }}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
              tab === 'cn'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🇨🇳 中文
          </button>
        </div>
      )}

      <div className="relative">
        <textarea
          value={currentValue}
          onChange={handleRawInput}
          placeholder={tab === 'cn' ? (cnPlaceholder || placeholder) : placeholder}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base leading-relaxed resize-y font-mono"
        />

        {/* Math toolbar button */}
        <button
          type="button"
          onClick={() => setShowMath((isOpen) => !isOpen)}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 transition-colors"
          title="Chèn công thức toán học"
          aria-expanded={showMath}
          aria-controls="math-formula-panel"
        >
          <FiDivide size={16} />
        </button>
      </div>

      {canRepairCurrentValue && (
        <button
          type="button"
          onClick={handleRepairFormat}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
          title="Tự sửa lỗi format OCR/PDF như $$, khoảng tập hợp, \\cup, C ℝ"
        >
          <FiRefreshCw size={13} />
          Tự sửa format
        </button>
      )}

      {/* Math formula panel */}
      {showMath && (
        <div
          id="math-formula-panel"
          className="border-2 border-purple-300 rounded-xl bg-purple-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center gap-2 mb-2">
            <FiDivide className="text-purple-600" size={16} />
            <span className="text-sm font-semibold text-purple-700">
              Chèn công thức toán học
            </span>
          </div>

          {/* Preset symbols */}
          <div className="grid grid-cols-10 gap-1">
            {PRESET_TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => handleInsertPreset(t.formula)}
                className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-white border border-gray-200 hover:border-purple-400 hover:bg-purple-100 transition-colors"
                title={`${t.label}: ${t.formula}`}
              >
                <span className="text-base leading-none font-semibold text-purple-800">
                  {t.symbol}
                </span>
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <textarea
                ref={mathRef}
                value={mathInput}
                onChange={(e) => setMathInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleInsertCustom();
                  }
                }}
                rows={3}
                placeholder="Nhập công thức LaTeX, VD: \sqrt{2} hoặc x^{2}+1"
                className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm font-mono bg-white resize-y"
              />
            </div>
            <button
              type="button"
              onClick={handleInsertCustom}
              disabled={!mathInput.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Chèn
            </button>
          </div>

          {/* Preview */}
          {previewHtml && (
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-1">
                <FiHash size={12} className="text-gray-400" />
                <span className="text-xs text-gray-500">Xem trước:</span>
              </div>
              <div
                className="math-preview"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}

          {/* LaTeX reference */}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700">
              Mẹo: Viết công thức nhanh
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 bg-white rounded p-2 border">
              <span className="font-mono">{"\\sqrt{x}"}</span><span>→ √x</span>
              <span className="font-mono">{"\\frac{a}{b}"}</span><span>→ a/b</span>
              <span className="font-mono">{"x^{2}"}</span><span>→ x²</span>
              <span className="font-mono">{"\\sum_{i=1}^{n}"}</span><span>→ Σ</span>
              <span className="font-mono">{"\\int_{a}^{b}"}</span><span>→ ∫</span>
              <span className="font-mono">{"\\pi"}</span><span>→ π</span>
            </div>
          </details>
        </div>
      )}

      {/* Inline preview of current value */}
      {showInlinePreview && currentValue && !showPreview && (
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
        >
          <FiEye size={13} />
          Hiện xem trước
        </button>
      )}

      {showInlinePreview && currentValue && showPreview && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500 mb-1">Xem trước:</div>
          <div className="mb-1 flex justify-end">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              <FiEyeOff size={12} />
              Ẩn
            </button>
          </div>
          <RichMathText value={repairedPreviewValue} className="text-base leading-relaxed text-gray-800" />
        </div>
      )}

    </div>
  );
}

// Render a string that may contain inline \(...\) or display \[...\] math
// Also auto-detects raw LaTeX patterns like \frac{}{}, \sqrt{}, etc.
function renderMathDisplay(text: string): string {
  if (!text) return '';
  text = normalizeMathText(text);

  function safeRender(latex: string): string {
    try {
      return katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return latex;
    }
  }

  const out: string[] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    // Skip over HTML tags (already rendered spans)
    if (text[i] === '<') {
      const gt = text.indexOf('>', i);
      if (gt !== -1) {
        out.push(text.slice(i, gt + 1));
        i = gt + 1;
        continue;
      }
    }

    // Already wrapped \(...\)
    if (text.slice(i, i + 2) === '\\(') {
      const end = text.indexOf('\\)', i);
      if (end !== -1) {
        out.push(safeRender(text.slice(i + 2, end)));
        i = end + 2;
        continue;
      }
    }

    // Already wrapped \[...\]
    if (text.slice(i, i + 2) === '\\[') {
      const end = text.indexOf('\\]', i);
      if (end !== -1) {
        try {
          out.push(katex.renderToString(text.slice(i + 2, end).trim(), { displayMode: true, throwOnError: false }));
        } catch {
          out.push(text.slice(i, end + 2));
        }
        i = end + 2;
        continue;
      }
    }

    // Backslash command
    if (text[i] === '\\') {
      let j = i + 1;
      while (j < len && /[a-zA-Z]/.test(text[j])) j++;
      const cmd = text.slice(i, j);

      let args = '';
      while (j < len && /\s/.test(text[j])) j++;

      // Optional [...]
      if (text[j] === '[') {
        let depth = 0, k = j;
        do { if (text[k] === '[') depth++; else if (text[k] === ']') depth--; k++; } while (k < len && depth > 0);
        args += text.slice(j, k); j = k;
        while (j < len && /\s/.test(text[j])) j++;
      }
      // Optional {...}
      if (text[j] === '{') {
        let depth = 0, k = j;
        do { if (text[k] === '{') depth++; else if (text[k] === '}') depth--; k++; } while (k < len && depth > 0);
        args += text.slice(j, k); j = k;
        while (j < len && /\s/.test(text[j])) j++;
        // Second {...} for \frac
        if (text[j] === '{') {
          let depth2 = 0, k2 = j;
          do { if (text[k2] === '{') depth2++; else if (text[k2] === '}') depth2--; k2++; } while (k2 < len && depth2 > 0);
          args += text.slice(j, k2); j = k2;
        }
      }

      const full = cmd + args;
      if (full.length > 1) {
        out.push(safeRender(full));
        i = j;
        continue;
      }
    }

    // Variable with superscript: x^2, x^{n}
    if (/[a-zA-Z]/.test(text[i])) {
      let j = i;
      while (j < len && /[a-zA-Z]/.test(text[j])) j++;
      const base = text.slice(i, j);
      let k = j;

      if (text[k] === '^') {
        k++;
        let sup = '';
        if (text[k] === '{') {
          let depth = 0, k2 = k;
          do { if (text[k2] === '{') depth++; else if (text[k2] === '}') depth--; k2++; } while (k2 < len && depth > 0);
          sup = text.slice(k + 1, k2 - 1); k = k2;
        } else {
          let k2 = k;
          while (k2 < len && /[a-zA-Z0-9]/.test(text[k2])) k2++;
          sup = text.slice(k, k2); k = k2;
        }

        let sub = '';
        if (text[k] === '_') {
          k++;
          if (text[k] === '{') {
            let depth = 0, k2 = k;
            do { if (text[k2] === '{') depth++; else if (text[k2] === '}') depth--; k2++; } while (k2 < len && depth > 0);
            sub = text.slice(k + 1, k2 - 1); k = k2;
          } else {
            let k2 = k;
            while (k2 < len && /[a-zA-Z0-9]/.test(text[k2])) k2++;
            sub = text.slice(k, k2); k = k2;
          }
        }

        const latex = sub ? `${base}^{${sup}}_{${sub}}` : `${base}^{${sup}}`;
        out.push(safeRender(latex));
        i = k;
        continue;
      }

      // Variable with subscript only: x_1
      if (text[k] === '_') {
        k++;
        let sub = '';
        if (text[k] === '{') {
          let depth = 0, k2 = k;
          do { if (text[k2] === '{') depth++; else if (text[k2] === '}') depth--; k2++; } while (k2 < len && depth > 0);
          sub = text.slice(k + 1, k2 - 1); k = k2;
        } else {
          let k2 = k;
          while (k2 < len && /[a-zA-Z0-9]/.test(text[k2])) k2++;
          sub = text.slice(k, k2); k = k2;
        }
        out.push(safeRender(`${base}_{${sub}}`));
        i = k;
        continue;
      }

      out.push(base);
      i = j;
      continue;
    }

    // Math symbols as unicode chars
    const sym: Record<string, string> = {
      '√': '\\sqrt{}', '∑': '\\sum', '∏': '\\prod', '∫': '\\int',
      '≤': '\\leq', '≥': '\\geq', '≠': '\\neq', '→': '\\to',
      '⇒': '\\Rightarrow', '∈': '\\in', '∉': '\\notin', '⊂': '\\subset',
      '⊃': '\\supset', '∀': '\\forall', '∃': '\\exists',
      '∂': '\\partial', 'Δ': '\\Delta', '±': '\\pm', '×': '\\times',
      '÷': '\\div', '·': '\\cdot', '⋯': '\\cdots', '…': '\\ldots',
      'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
      'θ': '\\theta', 'π': '\\pi', 'λ': '\\lambda', 'μ': '\\mu',
      'σ': '\\sigma', 'ω': '\\omega', '∞': '\\infty',
    };
    if (text[i] in sym) {
      out.push(safeRender(sym[text[i]]));
      i++;
      continue;
    }

    // Plain character
    out.push(text[i]);
    i++;
  }

  return out.join('');
}

export { renderMathDisplay };
