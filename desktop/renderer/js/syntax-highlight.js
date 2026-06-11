/**
 * Lightweight syntax highlighting for Desktop-rendered code blocks.
 */

"use strict";

function normalizeLanguage(language) {
  const value = String(language || "").toLowerCase();
  const map = {
    javascript: "js",
    typescript: "ts",
    python: "py",
    shell: "sh",
    zsh: "sh",
    patch: "diff",
    text: "plain",
    txt: "plain",
  };
  return map[value] || value || "plain";
}

function escapeHighlightHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightCode(code, language) {
  const lang = normalizeLanguage(language);
  if (lang === "diff") return highlightDiff(code);
  const escaped = escapeHighlightHtml(code);
  if (["js", "jsx", "ts", "tsx"].includes(lang)) return highlightJavaScript(escaped);
  if (lang === "py") return highlightPython(escaped);
  if (["sh", "bash"].includes(lang)) return highlightShell(escaped);
  if (lang === "json") return highlightJson(escaped);
  return escaped;
}

function highlightJavaScript(html) {
  return highlightWithProtectedTokens(
    html,
    [
      { pattern: /(\/\/.*)$/gm, className: "hl-comment" },
      { pattern: /(&quot;(?:[^&]|&(?!quot;))*&quot;|&#39;(?:[^&]|&(?!#39;))*&#39;)/g, className: "hl-string" },
    ],
    (value) => value
      .replace(/\b(const|let|var|function|return|if|else|for|while|class|extends|new|async|await|try|catch|throw|import|export|from|true|false|null|undefined)\b/g, '<span class="hl-keyword">$1</span>')
      .replace(/\b(console|Math|JSON|Promise|Array|Object|String|Number|Date|require|module|exports|process)\b/g, '<span class="hl-builtin">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-number">$1</span>'),
  );
}

function highlightPython(html) {
  return highlightWithProtectedTokens(
    html,
    [
      { pattern: /(#.*)$/gm, className: "hl-comment" },
      { pattern: /(&quot;(?:[^&]|&(?!quot;))*&quot;|&#39;(?:[^&]|&(?!#39;))*&#39;)/g, className: "hl-string" },
    ],
    (value) => value
      .replace(/\b(def|class|return|if|elif|else|for|while|break|continue|pass|import|from|as|with|try|except|raise|True|False|None|async|await)\b/g, '<span class="hl-keyword">$1</span>')
      .replace(/\b(print|len|range|int|str|float|list|dict|set|tuple|open|enumerate|zip)\b/g, '<span class="hl-builtin">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-number">$1</span>'),
  );
}

function highlightShell(html) {
  return highlightWithProtectedTokens(
    html,
    [
      { pattern: /(#.*)$/gm, className: "hl-comment" },
      { pattern: /(&quot;(?:[^&]|&(?!quot;))*&quot;|&#39;(?:[^&]|&(?!#39;))*&#39;)/g, className: "hl-string" },
    ],
    (value) => value
      .replace(/\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|local|export|set|source|echo|printf|exit)\b/g, '<span class="hl-keyword">$1</span>'),
  );
}

function highlightJson(html) {
  return html
    .replace(/(&quot;[^&]+&quot;)(\s*:)/g, '<span class="hl-attr">$1</span>$2')
    .replace(/(:\s*)(&quot;(?:[^&]|&(?!quot;))*&quot;)/g, '$1<span class="hl-string">$2</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="hl-keyword">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="hl-number">$1</span>');
}

function highlightWithProtectedTokens(html, protections, highlightRest) {
  const tokens = [];
  let protectedHtml = String(html || "");
  protections.forEach((protection) => {
    protectedHtml = protectedHtml.replace(protection.pattern, (match) => {
      const marker = `\u0000HL${tokens.length}\u0000`;
      tokens.push(`<span class="${protection.className}">${match}</span>`);
      return marker;
    });
  });
  let highlighted = highlightRest(protectedHtml);
  tokens.forEach((token, index) => {
    highlighted = highlighted.replace(`\u0000HL${index}\u0000`, token);
  });
  return highlighted;
}

function highlightDiff(code) {
  return String(code || "").split("\n").map((line) => {
    const escaped = escapeHighlightHtml(line);
    if (/^(diff --git|index |@@ |--- |\+\+\+ )/.test(line)) {
      return `<span class="hl-diff-header">${escaped}</span>`;
    }
    if (line.startsWith("+")) return `<span class="hl-diff-add">${escaped}</span>`;
    if (line.startsWith("-")) return `<span class="hl-diff-del">${escaped}</span>`;
    return escaped;
  }).join("\n");
}

function renderCodeBlock(code, language) {
  const lang = normalizeLanguage(language);
  const lines = String(code || "").split("\n");
  const lineNumbers = lines
    .map((_, index) => `<span class="code-line-no">${index + 1}</span>`)
    .join("");
  return [
    `<div class="code-block-wrap" data-lang="${escapeHighlightHtml(language || "text")}">`,
    '<div class="code-block-header">',
    `<span class="code-block-lang">${escapeHighlightHtml(language || "text")}</span>`,
    '<button class="code-block-copy-btn" onclick="copyCodeBlock(this)" title="Copy code">Copy</button>',
    "</div>",
    '<div class="code-block-body">',
    `<div class="code-block-gutter" aria-hidden="true">${lineNumbers}</div>`,
    `<pre class="code-block-content language-${lang}"><code>${highlightCode(code, lang)}</code></pre>`,
    "</div>",
    "</div>",
  ].join("");
}

function needsEnhancedMarkdown(text) {
  return String(text || "").includes("```");
}

function parseMarkdownEnhanced(text) {
  const source = String(text || "");
  let output = "";
  let offset = 0;
  const fence = /```([\w+-]*)\n([\s\S]*?)```/g;
  let match;
  while ((match = fence.exec(source)) !== null) {
    output += parseInlineMarkdown(source.slice(offset, match.index));
    output += renderCodeBlock(match[2], match[1] || "text");
    offset = match.index + match[0].length;
  }
  output += parseInlineMarkdown(source.slice(offset));
  return `<div class="md">${output}</div>`;
}

function parseInlineMarkdown(text) {
  let html = escapeHighlightHtml(text);
  html = html
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/^\* (.*$)/gim, "<li>$1</li>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "</p><p>");
  html = html.replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>");
  html = html.replace(/<\/ul>\s*<ul>/gim, "");
  return `<p>${html}</p>`;
}

window.copyCodeBlock = function copyCodeBlock(button) {
  const wrap = button && button.closest ? button.closest(".code-block-wrap") : null;
  const code = wrap && wrap.querySelector ? wrap.querySelector(".code-block-content code") : null;
  if (!code) return;
  const text = code.innerText || code.textContent || "";
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      button.textContent = "Copied";
      setTimeout(() => { button.textContent = "Copy"; }, 1200);
    });
  }
};
