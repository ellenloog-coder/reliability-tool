import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterFaqContent, getFaqContent, getManualContent } from "../src/reliability/help-content.js";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/reliability/app.js", import.meta.url), "utf8");
const drawerSource = readFileSync(new URL("../src/reliability/help-drawer.js", import.meta.url), "utf8");

test("manual uses matching bilingual chapter structure and documents all real modules", () => {
  const en = getManualContent("en");
  const zh = getManualContent("zh");
  assert.deepEqual(en.chapters.map(chapter => chapter.id), zh.chapters.map(chapter => chapter.id));
  assert.deepEqual(en.chapters.map(chapter => chapter.id), [
    "quick-start", "data-preparation", "life-data", "mtbf", "demonstration",
    "alt", "results", "reports", "application-scenarios", "privacy", "limitations"
  ]);
  const enScenarios = en.chapters.find(chapter => chapter.id === "application-scenarios");
  const zhScenarios = zh.chapters.find(chapter => chapter.id === "application-scenarios");
  assert.equal(enScenarios.sections.length, 4);
  assert.equal(zhScenarios.sections.length, 4);
  assert(enScenarios.sections.every(section => section.bullets.length >= 2));
  assert(zhScenarios.sections.every(section => section.bullets.length >= 2));
  assert.match(en.chapters.find(chapter => chapter.id === "alt").sections[0].text, /not implemented/i);
  assert.match(zh.chapters.find(chapter => chapter.id === "alt").sections[0].text, /尚未实现/);
  assert.match(enScenarios.sections[3].text, /not implemented/i);
  assert.match(zhScenarios.sections[3].text, /尚未实现/);
});

test("FAQ has matching bilingual category/question ids and covers a substantial set", () => {
  const en = getFaqContent("en");
  const zh = getFaqContent("zh");
  assert.deepEqual(en.categories.map(category => category.id), zh.categories.map(category => category.id));
  assert.deepEqual(
    en.categories.flatMap(category => category.items.map(item => item.id)),
    zh.categories.flatMap(category => category.items.map(item => item.id))
  );
  assert(en.categories.flatMap(category => category.items).length >= 40);
});

test("FAQ search matches question or answer and restores all content when cleared", () => {
  const content = getFaqContent("en");
  const total = content.categories.flatMap(category => category.items).length;
  const zeroFailure = filterFaqContent(content, "Infinity");
  assert(zeroFailure.flatMap(category => category.items).some(item => /zero failures/i.test(item.question)));
  assert.equal(filterFaqContent(content, "").flatMap(category => category.items).length, total);
  assert.equal(filterFaqContent(content, "not-a-real-faq-keyword").length, 0);
});

test("top navigation opens one shared in-app drawer and uses a language select", () => {
  assert.match(indexHtml, /id="analysisToolsButton"[^>]*aria-expanded="false"/);
  assert.match(indexHtml, /id="analysisToolsMenu"[^>]*role="menu"[^>]*hidden/);
  assert.equal((indexHtml.match(/role="menuitem" data-mode=/g) || []).length, 4);
  assert.match(indexHtml, /id="userManualButton"/);
  assert.match(indexHtml, /id="faqButton"/);
  assert.match(indexHtml, /id="languageSelect"/);
  assert.match(indexHtml, /id="helpDrawer"[^>]*role="dialog"/);
  assert.doesNotMatch(indexHtml, /data-mode="faq"/);
  assert.match(appSource, /createHelpDrawer/);
  assert.match(appSource, /function setAnalysisToolsOpen/);
});

test("drawer supports Escape, overlay close, focus containment, and accessible FAQ expansion", () => {
  assert.match(drawerSource, /event\.key === "Escape"/);
  assert.match(drawerSource, /overlay\.addEventListener\("click", close\)/);
  assert.match(drawerSource, /event\.key !== "Tab"/);
  assert.match(drawerSource, /aria-expanded=/);
  assert.match(drawerSource, /aria-controls=/);
  assert.match(drawerSource, /type="search"/);
});
