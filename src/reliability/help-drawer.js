import { filterFaqContent, getFaqContent, getManualContent } from "./help-content.js";

const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export function createHelpDrawer({ lang = "en", onOpenChange = () => {} } = {}) {
  const drawer = document.getElementById("helpDrawer");
  const overlay = document.getElementById("helpOverlay");
  const content = document.getElementById("helpDrawerContent");
  const title = document.getElementById("helpDrawerTitle");
  const subtitle = document.getElementById("helpDrawerSubtitle");
  const closeButton = document.getElementById("helpDrawerClose");
  let currentLang = lang === "zh" ? "zh" : "en";
  let currentPanel = null;
  let returnFocus = null;
  let faqQuery = "";
  const expandedFaq = new Set();

  if (!drawer || !overlay || !content || !title || !subtitle || !closeButton) {
    return { open() {}, close() {}, setLanguage() {}, getState: () => ({ open: false, panel: null }) };
  }

  function open(panel, trigger = document.activeElement) {
    const nextPanel = panel === "faq" ? "faq" : "manual";
    if (nextPanel === "faq" && currentPanel !== "faq") expandedFaq.clear();
    currentPanel = nextPanel;
    returnFocus = trigger instanceof HTMLElement ? trigger : returnFocus;
    render();
    drawer.hidden = false;
    overlay.hidden = false;
    document.body.classList.add("help-open");
    requestAnimationFrame(() => {
      drawer.classList.add("open");
      overlay.classList.add("open");
      const initialFocus = currentPanel === "faq"
        ? content.querySelector("#faqSearch")
        : closeButton;
      initialFocus?.focus();
    });
    onOpenChange({ open: true, panel: currentPanel });
  }

  function close() {
    if (drawer.hidden) return;
    drawer.classList.remove("open");
    overlay.classList.remove("open");
    document.body.classList.remove("help-open");
    window.setTimeout(() => {
      drawer.hidden = true;
      overlay.hidden = true;
    }, 180);
    const focusTarget = returnFocus;
    currentPanel = null;
    onOpenChange({ open: false, panel: null });
    focusTarget?.focus();
  }

  function setLanguage(nextLang) {
    currentLang = nextLang === "zh" ? "zh" : "en";
    closeButton.setAttribute("aria-label", currentLang === "zh" ? "关闭" : "Close");
    if (!drawer.hidden && currentPanel) render();
  }

  function render() {
    if (currentPanel === "faq") renderFaq();
    else renderManual();
  }

  function renderManual() {
    const manual = getManualContent(currentLang);
    title.textContent = manual.title;
    subtitle.textContent = manual.subtitle;
    content.innerHTML = `
      <div class="manual-layout">
        <nav class="manual-toc" aria-label="${escapeHtml(manual.contentsLabel)}">
          <strong>${escapeHtml(manual.contentsLabel)}</strong>
          ${manual.chapters.map((chapter, index) => `
            <button class="manual-toc-link ${index === 0 ? "active" : ""}" type="button" data-manual-target="${escapeHtml(chapter.id)}">
              ${escapeHtml(chapter.title)}
            </button>`).join("")}
        </nav>
        <article class="manual-article" id="manualArticle">
          ${manual.chapters.map(chapter => renderChapter(chapter)).join("")}
        </article>
      </div>`;
    const article = content.querySelector("#manualArticle");
    content.querySelectorAll("[data-manual-target]").forEach(button => {
      button.addEventListener("click", () => {
        const section = content.querySelector(`#manual-${CSS.escape(button.dataset.manualTarget)}`);
        if (!section || !article) return;
        article.scrollTo({ top: section.offsetTop - 8, behavior: "smooth" });
        setActiveManualLink(button.dataset.manualTarget);
      });
    });
    article?.addEventListener("scroll", () => updateActiveManualChapter(article), { passive: true });
  }

  function renderFaq() {
    const faq = getFaqContent(currentLang);
    title.textContent = faq.title;
    subtitle.textContent = faq.subtitle;
    const categories = filterFaqContent(faq, faqQuery);
    content.innerHTML = `
      <div class="faq-layout">
        <label class="faq-search-label" for="faqSearch">${escapeHtml(faq.searchLabel)}</label>
        <div class="faq-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input id="faqSearch" type="search" value="${escapeHtml(faqQuery)}" placeholder="${escapeHtml(faq.searchPlaceholder)}" autocomplete="off" />
        </div>
        <div class="faq-results" id="faqResults" aria-live="polite">
          ${categories.length ? categories.map(renderFaqCategory).join("") : `<div class="faq-empty">${escapeHtml(faq.empty)}</div>`}
        </div>
      </div>`;
    const search = content.querySelector("#faqSearch");
    search?.addEventListener("input", event => {
      faqQuery = event.target.value;
      renderFaqResults();
    });
    bindFaqButtons();
  }

  function renderFaqResults() {
    const faq = getFaqContent(currentLang);
    const categories = filterFaqContent(faq, faqQuery);
    const results = content.querySelector("#faqResults");
    if (!results) return;
    results.innerHTML = categories.length
      ? categories.map(renderFaqCategory).join("")
      : `<div class="faq-empty">${escapeHtml(faq.empty)}</div>`;
    bindFaqButtons();
  }

  function renderFaqCategory(category) {
    return `<section class="faq-category">
      <h3>${escapeHtml(category.title)}</h3>
      <div class="faq-items">
        ${category.items.map(item => {
          const open = expandedFaq.has(item.id);
          const answerId = `faq-answer-${item.id}`;
          return `<div class="faq-item">
            <button class="faq-question" type="button" aria-expanded="${open}" aria-controls="${answerId}" data-faq-id="${escapeHtml(item.id)}">
              <span>${escapeHtml(item.question)}</span><span class="faq-toggle" aria-hidden="true">${open ? "−" : "+"}</span>
            </button>
            <div class="faq-answer" id="${answerId}" role="region" ${open ? "" : "hidden"}>${escapeHtml(item.answer)}</div>
          </div>`;
        }).join("")}
      </div>
    </section>`;
  }

  function bindFaqButtons() {
    content.querySelectorAll("[data-faq-id]").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.faqId;
        if (expandedFaq.has(id)) expandedFaq.delete(id);
        else expandedFaq.add(id);
        const answer = content.querySelector(`#faq-answer-${CSS.escape(id)}`);
        const open = expandedFaq.has(id);
        button.setAttribute("aria-expanded", String(open));
        button.querySelector(".faq-toggle").textContent = open ? "−" : "+";
        if (answer) answer.hidden = !open;
      });
    });
  }

  function renderChapter(chapter) {
    return `<section class="manual-chapter" id="manual-${escapeHtml(chapter.id)}" data-manual-section="${escapeHtml(chapter.id)}">
      <h3>${escapeHtml(chapter.title)}</h3>
      ${chapter.sections.map(section => `
        <div class="manual-section">
          ${section.heading ? `<h4>${escapeHtml(section.heading)}</h4>` : ""}
          ${section.text ? `<p>${escapeHtml(section.text)}</p>` : ""}
          ${section.steps ? `<ol>${section.steps.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>` : ""}
          ${section.bullets ? `<ul>${section.bullets.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
          ${section.sample ? `<pre><code>${escapeHtml(section.sample)}</code></pre>` : ""}
        </div>`).join("")}
    </section>`;
  }

  function updateActiveManualChapter(article) {
    const sections = Array.from(article.querySelectorAll("[data-manual-section]"));
    const active = sections.reduce((current, section) =>
      section.offsetTop <= article.scrollTop + 44 ? section : current, sections[0]);
    if (active) setActiveManualLink(active.dataset.manualSection);
  }

  function setActiveManualLink(id) {
    content.querySelectorAll("[data-manual-target]").forEach(button => {
      button.classList.toggle("active", button.dataset.manualTarget === id);
    });
  }

  function handleKeydown(event) {
    if (drawer.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(drawer.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )).filter(element => !element.hidden && element.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", handleKeydown);
  setLanguage(currentLang);

  return {
    open,
    close,
    setLanguage,
    getState: () => ({ open: !drawer.hidden, panel: currentPanel })
  };
}
