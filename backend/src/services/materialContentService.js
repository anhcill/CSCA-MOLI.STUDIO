const pdfParse = require("pdf-parse");
const sanitizeHtml = require("sanitize-html");

function normalizeMaterialText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/([A-Za-zÀ-ỹ])-\n([A-Za-zÀ-ỹ])/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isHeading(line, index) {
  if (!line || line.length > 90) return false;
  if (/[:;,.!?。]$/.test(line)) return false;
  if (/^(bài|chương|phần|mục|chủ đề|topic|lesson)\b/i.test(line)) return true;
  if (/^\d+(\.\d+)*\s+/.test(line)) return true;
  return index === 0 && line.length <= 70;
}

function listType(line) {
  if (/^\d+[\.)]\s+/.test(line)) return "ol";
  if(/^[-*•]\s+/.test(line)) return "ul";
  return null;
}

function stripListMarker(line) {
  return line.replace(/^\d+[\.)]\s+/, "").replace(/^[-*•]\s+/, "").trim();
}

function buildMaterialHtmlFromText(input) {
  const text = normalizeMaterialText(input);
  if (!text) return "";

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const html = [];
  let activeList = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${escapeHtml(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!activeList) return;
    html.push(`</${activeList}>`);
    activeList = null;
  };

  lines.forEach((line, index) => {
    const currentList = listType(line);
    if (currentList) {
      flushParagraph();
      if (activeList !== currentList) {
        closeList();
        activeList = currentList;
        html.push(`<${activeList}>`);
      }
      html.push(`<li>${escapeHtml(stripListMarker(line))}</li>`);
      return;
    }

    closeList();
    if (isHeading(line, index)) {
      flushParagraph();
      html.push(index === 0 ? `<h2>${escapeHtml(line)}</h2>` : `<h3>${escapeHtml(line)}</h3>`);
      return;
    }

    paragraph.push(line);
    if (/[.!?。]$/.test(line) || paragraph.join(" ").length > 220) {
      flushParagraph();
    }
  });

  flushParagraph();
  closeList();
  return sanitizeMaterialHtml(html.join("\n"));
}

function sanitizeMaterialHtml(html) {
  return sanitizeHtml(String(html || ""), {
    allowedTags: [
      "h2",
      "h3",
      "h4",
      "p",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "b",
      "i",
      "sub",
      "sup",
      "code",
      "pre",
      "br",
      "span",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {},
    allowedSchemes: [],
  });
}

async function extractPdfWebContent(buffer) {
  const parsed = await pdfParse(buffer);
  const contentText = normalizeMaterialText(parsed.text);
  const contentHtml = buildMaterialHtmlFromText(contentText);
  return {
    contentText,
    contentHtml,
    meta: {
      pages: parsed.numpages || null,
      extractedCharacters: contentText.length,
      parser: "pdf-parse",
    },
  };
}

function prepareMaterialContent({ content_text, content_html, content_meta, file_type } = {}) {
  const contentText = normalizeMaterialText(content_text);
  const contentHtml = contentText
    ? buildMaterialHtmlFromText(contentText)
    : sanitizeMaterialHtml(content_html);
  let meta = {};
  if (content_meta && typeof content_meta === "object" && !Array.isArray(content_meta)) {
    meta = content_meta;
  }
  return {
    contentText: contentText || null,
    contentHtml: contentHtml || null,
    contentSource: contentHtml ? (file_type === "pdf" ? "pdf_extract" : "manual") : "file",
    contentMeta: meta,
  };
}

module.exports = {
  buildMaterialHtmlFromText,
  extractPdfWebContent,
  normalizeMaterialText,
  prepareMaterialContent,
  sanitizeMaterialHtml,
};
