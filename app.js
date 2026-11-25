// moonlit-md — a small, safe markdown editor with live preview.
// Pure logic (renderMarkdown, countWords, readingTime) is exported for tests;
// all DOM wiring is guarded so this module can be imported under Node.

const WORDS_PER_MINUTE = 200;

/**
 * Escape the characters that have meaning in HTML so raw markup in the
 * source can never break out into the rendered output.
 */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeUrl(url) {
  const trimmed = url.trim();
  if (trimmed === "") return false;
  // Block scriptable / data schemes outright.
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;
  // Allow http(s), mailto, in-page anchors and relative paths.
  if (/^(https?:|mailto:)/i.test(trimmed)) return true;
  if (trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return true;
  }
  // A bare relative reference has no scheme colon before any slash.
  const colon = trimmed.indexOf(":");
  const slash = trimmed.indexOf("/");
  return colon === -1 || (slash !== -1 && slash < colon);
}

function renderInline(rawText) {
  let text = escapeHtml(rawText);

  // Park inline code spans so emphasis/link parsing cannot touch them.
  const codeSpans = [];
  text = text.replace(/`([^`]+)`/g, (_match, code) => {
    codeSpans.push(`<code>${code}</code>`);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });

  // Links: [label](url)
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) => {
    if (!isSafeUrl(url)) return label;
    return `<a href="${url}" rel="noopener noreferrer">${label}</a>`;
  });

  // Bold before italic so ** is not consumed as two single asterisks.
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Restore code spans.
  text = text.replace(/\u0000(\d+)\u0000/g, (_match, index) => codeSpans[Number(index)] ?? "");
  return text;
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const BLOCKQUOTE_RE = /^>\s?(.*)$/;
const UNORDERED_RE = /^\s*[-*]\s+(.+)$/;
const ORDERED_RE = /^\s*\d+\.\s+(.+)$/;
const FENCE_RE = /^```/;

function startsBlock(line) {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    BLOCKQUOTE_RE.test(line) ||
    UNORDERED_RE.test(line) ||
    ORDERED_RE.test(line)
  );
}

/**
 * Render a small, safe subset of Markdown to HTML.
 * Supports headings, bold, italic, inline code, fenced code blocks,
 * links, unordered/ordered lists, blockquotes and paragraphs.
 * All source HTML is escaped first, so raw tags never pass through.
 */
export function renderMarkdown(markdown) {
  if (typeof markdown !== "string") return "";
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Fenced code block: ``` ... ```
    if (FENCE_RE.test(line)) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip the closing fence (or run past the end harmlessly)
      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    if (BLOCKQUOTE_RE.test(line)) {
      const quoteLines = [];
      while (i < lines.length && BLOCKQUOTE_RE.test(lines[i])) {
        quoteLines.push(lines[i].match(BLOCKQUOTE_RE)[1]);
        i += 1;
      }
      blocks.push(`<blockquote><p>${renderInline(quoteLines.join(" "))}</p></blockquote>`);
      continue;
    }

    if (UNORDERED_RE.test(line)) {
      const items = [];
      while (i < lines.length && UNORDERED_RE.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].match(UNORDERED_RE)[1].trim())}</li>`);
        i += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (ORDERED_RE.test(line)) {
      const items = [];
      while (i < lines.length && ORDERED_RE.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].match(ORDERED_RE)[1].trim())}</li>`);
        i += 1;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Paragraph: consume lines until a blank line or another block starts.
    const paragraphLines = [line.trim()];
    i += 1;
    while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i])) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(`<p>${renderInline(paragraphLines.join(" "))}</p>`);
  }

  return blocks.join("\n");
}

/** Count words in plain text (letters/numbers, allowing inner ' or -). */
export function countWords(text) {
  if (typeof text !== "string") return 0;
  const matches = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

/**
 * Estimated reading time in whole minutes at 200 words per minute.
 * Returns 0 for empty text, otherwise at least 1.
 */
export function readingTime(text) {
  const words = countWords(text);
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/** Wrap rendered body HTML in a complete standalone document for export. */
export function buildExportHtml(markdown, title = "moonlit-md export") {
  const body = renderMarkdown(markdown);
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    "<style>body{font-family:Georgia,serif;max-width:44rem;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1a1a1a}pre{background:#111;color:#f5f5f5;padding:1rem;overflow:auto;border-radius:.5rem}code{font-family:ui-monospace,monospace}blockquote{border-left:3px solid #dc143c;margin-left:0;padding-left:1rem;color:#444}</style>",
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Browser UI (skipped under Node / tests)
// ---------------------------------------------------------------------------

const SAMPLE_MARKDOWN = `# Moonlit Notes

Write **bold** ideas and *quiet* ones under a crimson moon.

## Tonight's list

- Draft the chapter
- Sharpen the ` + "`renderMarkdown`" + ` function
- Ship it before dawn

> The night is long, but the preview is instant.

Read more at [Vempire](https://github.com/MrVempiree).

\`\`\`
const moon = "full";
\`\`\`
`;

if (typeof document !== "undefined") {
  const editor = document.querySelector("#editor");
  const preview = document.querySelector("#preview");
  const stats = document.querySelector("#stats");
  const downloadButton = document.querySelector("#download");
  const copyButton = document.querySelector("#copy-html");
  const sampleButton = document.querySelector("#load-sample");
  const clearButton = document.querySelector("#clear");

  if (editor && preview) {
    const update = () => {
      const source = editor.value;
      preview.innerHTML = renderMarkdown(source);
      if (stats) {
        const words = countWords(source);
        const minutes = readingTime(source);
        const lines = source === "" ? 0 : source.split("\n").length;
        stats.textContent = `${words} words · ${minutes} min read · ${source.length} characters · ${lines} lines`;
      }
    };

    editor.addEventListener("input", update);
    editor.value = SAMPLE_MARKDOWN;
    update();

    downloadButton?.addEventListener("click", () => {
      const html = buildExportHtml(editor.value);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "moonlit-export.html";
      link.click();
      URL.revokeObjectURL(url);
    });

    copyButton?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(renderMarkdown(editor.value));
        copyButton.textContent = "Copied!";
        setTimeout(() => {
          copyButton.textContent = "Copy HTML";
        }, 1500);
      } catch {
        copyButton.textContent = "Copy failed";
      }
    });

    sampleButton?.addEventListener("click", () => {
      editor.value = SAMPLE_MARKDOWN;
      update();
      editor.focus();
    });

    clearButton?.addEventListener("click", () => {
      editor.value = "";
      update();
      editor.focus();
    });
  }
}
