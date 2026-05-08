'use client';

import { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { FiSigma, FiSuperscript } from 'react-icons/fi';

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  cnLabel?: string;
  cnValue?: string;
  onCnChange?: (value: string) => void;
  cnPlaceholder?: string;
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

function renderMath(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      errorColor: '#dc2626',
    });
  } catch {
    return `<span style="color:#dc2626">Lỗi: ${latex}</span>`;
  }
}

function insertMathIntoText(text: string, latex: string): string {
  const wrapped = displayMath(latex);
  return text ? `${text} ${wrapped}` : wrapped;
}

function displayMath(latex: string): string {
  return `\\(${latex}\\)`;
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
}: MathInputProps) {
  const [showMath, setShowMath] = useState(false);
  const [mathInput, setMathInput] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [tab, setTab] = useState<'vi' | 'cn'>('vi');
  const mathRef = useRef<HTMLInputElement>(null);

  const currentValue = tab === 'vi' ? value : (cnValue || '');
  const setCurrentValue = tab === 'vi'
    ? onChange
    : (onCnChange || (() => {}));

  useEffect(() => {
    if (showMath && mathRef.current) {
      mathRef.current.focus();
    }
  }, [showMath]);

  useEffect(() => {
    if (mathInput.trim()) {
      const html = renderMath(mathInput, false);
      setPreviewHtml(html);
    } else {
      setPreviewHtml('');
    }
  }, [mathInput]);

  const handleInsertPreset = (formula: string) => {
    const wrapped = displayMath(formula);
    const newVal = currentValue ? `${currentValue} ${wrapped}` : wrapped;
    setCurrentValue(newVal);
  };

  const handleInsertCustom = () => {
    if (!mathInput.trim()) return;
    const newVal = insertMathIntoText(currentValue, mathInput);
    setCurrentValue(newVal);
    setMathInput('');
    setShowMath(false);
  };

  const handleRawInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentValue(e.target.value);
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}

      {cnLabel && (
        <div className="flex gap-2 mb-1">
          <button
            type="button"
            onClick={() => setTab('vi')}
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
            onClick={() => setTab('cn')}
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
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y font-mono"
        />

        {/* Math toolbar button */}
        <button
          type="button"
          onClick={() => setShowMath(!showMath)}
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 transition-colors"
          title="Chèn công thức toán học"
        >
          <FiSigma size={16} />
        </button>
      </div>

      {/* Math formula panel */}
      {showMath && (
        <div className="border-2 border-purple-300 rounded-xl bg-purple-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 mb-2">
            <FiSigma className="text-purple-600" size={16} />
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
                <span
                  className="text-base leading-none"
                  dangerouslySetInnerHTML={{ __html: renderMath(t.formula, false) }}
                />
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <input
                ref={mathRef}
                type="text"
                value={mathInput}
                onChange={(e) => setMathInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInsertCustom();
                  }
                }}
                placeholder="Nhập công thức LaTeX, VD: \sqrt{2} hoặc x^{2}+1"
                className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm font-mono bg-white"
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
                <FiSuperscript size={12} className="text-gray-400" />
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
              <span className="font-mono">\\sqrt{x}</span><span>→ √x</span>
              <span className="font-mono">\\frac{a}{b}</span><span>→ a/b</span>
              <span className="font-mono">x^{2}</span><span>→ x²</span>
              <span className="font-mono">\\sum_{i=1}^{n}</span><span>→ Σ</span>
              <span className="font-mono">\\int_{a}^{b}</span><span>→ ∫</span>
              <span className="font-mono">\\pi</span><span>→ π</span>
            </div>
          </details>
        </div>
      )}

      {/* Inline preview of current value */}
      {currentValue && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500 mb-1">Xem trước:</div>
          <div
            className="math-preview text-sm text-gray-800"
            dangerouslySetInnerHTML={{ __html: renderMathDisplay(currentValue) }}
          />
        </div>
      )}

      {/* CN input below if needed */}
      {cnLabel && tab === 'cn' && onCnChange && (
        <div className="mt-2 space-y-1">
          <label className="block text-xs font-medium text-gray-600">{cnLabel}</label>
          <textarea
            value={cnValue || ''}
            onChange={(e) => onCnChange(e.target.value)}
            placeholder={cnPlaceholder}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y font-mono"
          />
        </div>
      )}
    </div>
  );
}

// Render a string that may contain inline \(...\) or display \[...\] math
function renderMathDisplay(text: string): string {
  // Process display math first (\[...\]) then inline \(...\)
  const display = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => {
    try {
      return katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span style="color:#dc2626">Lỗi: ${latex}</span>`;
    }
  });

  return display.replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => {
    try {
      return katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span style="color:#dc2626">Lỗi: ${latex}</span>`;
    }
  });
}

export { renderMathDisplay };
