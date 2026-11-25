import { test } from "node:test";
import assert from "node:assert/strict";

import { renderMarkdown, countWords, readingTime, buildExportHtml, escapeHtml } from "../app.js";

test("renders headings at the right level", () => {
  assert.equal(renderMarkdown("# Title"), "<h1>Title</h1>");
  assert.equal(renderMarkdown("### Deep"), "<h3>Deep</h3>");
  assert.equal(renderMarkdown("###### Six"), "<h6>Six</h6>");
});

test("renders bold and italic", () => {
  assert.equal(renderMarkdown("a **bold** word"), "<p>a <strong>bold</strong> word</p>");
  assert.equal(renderMarkdown("a *soft* word"), "<p>a <em>soft</em> word</p>");
  assert.equal(renderMarkdown("a __bold__ word"), "<p>a <strong>bold</strong> word</p>");
  assert.equal(renderMarkdown("a _soft_ word"), "<p>a <em>soft</em> word</p>");
});

test("renders inline code without interpreting markup inside it", () => {
  assert.equal(renderMarkdown("run `npm test` now"), "<p>run <code>npm test</code> now</p>");
  assert.equal(renderMarkdown("`**not bold**`"), "<p><code>**not bold**</code></p>");
});

test("renders fenced code blocks with contents escaped", () => {
  const html = renderMarkdown("```\nconst x = 1 < 2;\n```");
  assert.equal(html, "<pre><code>const x = 1 &lt; 2;</code></pre>");
});

test("renders links with safe hrefs", () => {
  const html = renderMarkdown("[Vempire](https://github.com/MrVempiree)");
  assert.equal(
    html,
    '<p><a href="https://github.com/MrVempiree" rel="noopener noreferrer">Vempire</a></p>',
  );
});

test("neutralises javascript: links", () => {
  const html = renderMarkdown("[click](javascript:alert(1))");
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes("<a "));
  assert.ok(html.includes("click"));
});

test("renders unordered and ordered lists", () => {
  assert.equal(renderMarkdown("- one\n- two"), "<ul><li>one</li><li>two</li></ul>");
  assert.equal(renderMarkdown("1. one\n2. two"), "<ol><li>one</li><li>two</li></ol>");
});

test("renders blockquotes", () => {
  assert.equal(renderMarkdown("> stay sharp"), "<blockquote><p>stay sharp</p></blockquote>");
});

test("joins wrapped lines into one paragraph and splits on blank lines", () => {
  assert.equal(renderMarkdown("line one\nline two"), "<p>line one line two</p>");
  assert.equal(renderMarkdown("first\n\nsecond"), "<p>first</p>\n<p>second</p>");
});

test("escapes raw HTML instead of passing it through", () => {
  const html = renderMarkdown("<script>alert(1)</script>");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
});

test("escapes event-handler markup", () => {
  const html = renderMarkdown('<img src=x onerror="alert(1)">');
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
});

test("escapeHtml escapes all five special characters", () => {
  assert.equal(escapeHtml(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
});

test("renderMarkdown tolerates empty and non-string input", () => {
  assert.equal(renderMarkdown(""), "");
  assert.equal(renderMarkdown(null), "");
  assert.equal(renderMarkdown(undefined), "");
});

test("countWords counts plain words", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("hello world"), 2);
  assert.equal(countWords("  spaced   out\nwords  "), 3);
  assert.equal(countWords(null), 0);
});

test("readingTime is 0 for empty text and scales with word count", () => {
  assert.equal(readingTime(""), 0);
  assert.equal(readingTime("one"), 1);
  assert.equal(readingTime("word ".repeat(200)), 1);
  assert.equal(readingTime("word ".repeat(201)), 2);
  assert.equal(readingTime("word ".repeat(400)), 2);
});

test("buildExportHtml wraps rendered output in a standalone document", () => {
  const html = buildExportHtml("# Hi\n\n<script>alert(1)</script>", "My <Title>");
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes("<title>My &lt;Title&gt;</title>"));
  assert.ok(html.includes("<h1>Hi</h1>"));
  assert.ok(!html.includes("<script>alert"));
});
