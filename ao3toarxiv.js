// ==UserScript==
// @name         AO3 to arXiv Paper Reader with Zoom
// @namespace    local.ao3.arxiv.paper.reader.zoom
// @version      0.7
// @description  Convert AO3 work pages into an arXiv-like local paper layout with paged two-column rendering, side stamp, header, and zoom controls
// @match        https://archiveofourown.org/works/*
// @match        https://www.archiveofourown.org/works/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const STYLE_ID = "ao3-arxiv-paper-style";
    const VIEW_ID = "ao3-arxiv-paper-view";
    const TOOLBAR_ID = "ao3-arxiv-paper-toolbar";
    const BUTTON_ID = "ao3-arxiv-paper-toggle-button";
    const STORAGE_KEY = "ao3_arxiv_paper_reader_enabled";
    const ZOOM_STORAGE_KEY = "ao3_arxiv_paper_zoom";

    const FONT_SIZE_PX = 16;
    const LINE_HEIGHT = 1.25;
    const LINES_PER_COLUMN = 80;
    const PAGE_WIDTH_PX = 1120;
    const COLUMN_GAP_PX = 38;

    const DEFAULT_ZOOM = 1.0;
    const MIN_ZOOM = 0.65;
    const MAX_ZOOM = 1.35;
    const ZOOM_STEP = 0.05;

    const SHOW_DEBUG = false;
    const SHOW_ABSTRACT = true;
    const SHOW_RUNNING_HEADER = true;
    const SHOW_SIDE_STAMP = true;

    const JOURNAL_TEXT = "JOURNAL OF LOCAL AO3 CLASS FILES, VOL. 1, NO. 1";
    const SUBJECT_TEXT = "[AO3]";
    const ABSTRACT_TITLE = "Abstract";

    const PAGE_CONTENT_HEIGHT_PX = Math.round(
        FONT_SIZE_PX * LINE_HEIGHT * LINES_PER_COLUMN
    );

    function getCleanText(el) {
        if (!el) return "";
        return el.textContent.replace(/\s+/g, " ").trim();
    }

    function findDtValue(labelPattern) {
        const dts = Array.from(document.querySelectorAll("dt"));

        for (const dt of dts) {
            const label = getCleanText(dt);
            if (!labelPattern.test(label)) continue;

            let next = dt.nextElementSibling;

            while (next) {
                if (next.tagName && next.tagName.toLowerCase() === "dd") {
                    const value = getCleanText(next);
                    if (value) return value;
                }

                if (next.tagName && next.tagName.toLowerCase() === "dt") {
                    break;
                }

                next = next.nextElementSibling;
            }
        }

        return "";
    }

    function getAO3Meta() {
        const title =
            getCleanText(document.querySelector(".preface .title.heading")) ||
            getCleanText(document.querySelector("h2.title.heading")) ||
            getCleanText(document.querySelector(".work .title")) ||
            getCleanText(document.querySelector("title")) ||
            "AO3 Work";

        const author =
            getCleanText(document.querySelector(".byline.heading")) ||
            getCleanText(document.querySelector("h3.byline")) ||
            getCleanText(document.querySelector(".byline")) ||
            "Unknown Author";

        const statsText = getCleanText(document.querySelector(".stats"));

        let published =
            getCleanText(document.querySelector("dd.published")) ||
            getCleanText(document.querySelector(".stats .published")) ||
            findDtValue(/^Published/i);

        let updated =
            getCleanText(document.querySelector("dd.status")) ||
            getCleanText(document.querySelector(".stats .status")) ||
            findDtValue(/^Updated/i);

        const publishedMatch =
            statsText.match(/Published\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i) ||
            statsText.match(/Published\s*:?\s*([0-9]{1,2}\s+\w+\s+[0-9]{4})/i);

        const updatedMatch =
            statsText.match(/Updated\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i) ||
            statsText.match(/Updated\s*:?\s*([0-9]{1,2}\s+\w+\s+[0-9]{4})/i);

        if (!published && publishedMatch) published = publishedMatch[1];
        if (!updated && updatedMatch) updated = updatedMatch[1];

        const workId = (location.pathname.match(/\/works\/(\d+)/) || [])[1] || "";
        const chapterId = (location.pathname.match(/\/chapters\/(\d+)/) || [])[1] || "";

        return {
            title,
            author,
            published,
            updated,
            workId,
            chapterId
        };
    }

    function formatDateForStamp(dateStr) {
        if (!dateStr) return "Unknown Date";

        const iso = dateStr.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
        if (iso) {
            const year = iso[1];
            const month = Number(iso[2]);
            const day = Number(iso[3]);

            const months = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ];

            return `${day} ${months[month - 1] || ""} ${year}`.trim();
        }

        return dateStr;
    }

    function extractAbstractText() {
        const candidates = [
            ".summary .userstuff",
            ".summary blockquote",
            ".summary",
            ".chapter.preface .notes .userstuff",
            ".preface .notes .userstuff",
            ".notes .userstuff"
        ];

        for (const selector of candidates) {
            const el = document.querySelector(selector);
            const text = getCleanText(el);
            if (text.length > 40) {
                return text;
            }
        }

        return "";
    }

    function addStyle() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;

        style.textContent = `
      body.ao3-arxiv-paper-mode {
        background: #e8e8e8 !important;
        color: #111 !important;
        font-family: "Times New Roman", Times, serif !important;
      }

      body.ao3-arxiv-paper-mode #header,
      body.ao3-arxiv-paper-mode #footer,
      body.ao3-arxiv-paper-mode #dashboard,
      body.ao3-arxiv-paper-mode .landmark,
      body.ao3-arxiv-paper-mode .navigation,
      body.ao3-arxiv-paper-mode .actions,
      body.ao3-arxiv-paper-mode .kudos,
      body.ao3-arxiv-paper-mode .share,
      body.ao3-arxiv-paper-mode .comment,
      body.ao3-arxiv-paper-mode #comments,
      body.ao3-arxiv-paper-mode .feedback {
        display: none !important;
      }

      body.ao3-arxiv-paper-mode #main {
        max-width: ${PAGE_WIDTH_PX + 160}px !important;
        margin: 24px auto 80px auto !important;
        padding: 0 !important;
        background: transparent !important;
      }

      body.ao3-arxiv-paper-mode #workskin,
      body.ao3-arxiv-paper-mode .preface,
      body.ao3-arxiv-paper-mode .meta {
        display: none !important;
      }

      #${VIEW_ID} {
        max-width: ${PAGE_WIDTH_PX}px;
        margin: 0 auto;
        transform-origin: top center;
      }

      body.ao3-arxiv-paper-mode #${VIEW_ID} {
        zoom: var(--ao3-paper-zoom, 1);
      }

      .ao3-paper-debug {
        max-width: ${PAGE_WIDTH_PX}px;
        margin: 0 auto 12px auto;
        padding: 8px 12px;
        background: #fff8dc;
        border: 1px solid #d0c27a;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        color: #333;
      }

      .ao3-paper-page {
        width: ${PAGE_WIDTH_PX}px;
        height: ${PAGE_CONTENT_HEIGHT_PX + 122}px;
        margin: 0 auto 22px auto;
        padding: 70px 46px 52px 92px;
        background: #ffffff;
        border: 1px solid #d0d0d0;
        box-shadow: 0 1px 10px rgba(0, 0, 0, 0.08);
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
      }

      .ao3-paper-running-header {
        position: absolute;
        top: 18px;
        left: 92px;
        right: 46px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        color: #222;
        text-transform: uppercase;
        letter-spacing: 0.2px;
        white-space: nowrap;
      }

      .ao3-paper-side-stamp {
        position: absolute;
        left: 24px;
        top: 170px;
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        font-family: "Times New Roman", Times, serif;
        font-size: 28px;
        color: #8a8a8a;
        letter-spacing: 1px;
        line-height: 1.1;
        pointer-events: none;
        user-select: none;
      }

      .ao3-paper-page:not(.first-page) .ao3-paper-side-stamp {
        display: none;
      }

      .ao3-paper-content {
        height: ${PAGE_CONTENT_HEIGHT_PX}px;
        column-count: 2;
        column-gap: ${COLUMN_GAP_PX}px;
        column-rule: 1px solid #d8d8d8;
        overflow: hidden;
        font-family: "Times New Roman", Times, serif;
        font-size: ${FONT_SIZE_PX}px;
        line-height: ${LINE_HEIGHT};
        color: #111;
        text-align: justify;
      }

      .ao3-paper-frontmatter {
        column-span: all;
        margin: 0 0 22px 0;
        padding: 0;
        text-align: center;
        break-after: avoid;
      }

      .ao3-paper-title {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 38px;
        line-height: 1.12;
        font-weight: 400;
        color: #000;
        margin: 0 0 22px 0;
        text-align: center;
      }

      .ao3-paper-author {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 18px;
        line-height: 1.35;
        font-weight: 400;
        color: #000;
        margin: 0 0 28px 0;
        text-align: center;
      }

      .ao3-paper-abstract {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 14px;
        line-height: 1.35;
        text-align: left;
        margin: 0 auto 18px auto;
        max-width: 900px;
      }

      .ao3-paper-abstract b {
        font-weight: 700;
      }

      .ao3-paper-index {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 14px;
        line-height: 1.35;
        text-align: left;
        margin: 0 auto 18px auto;
        max-width: 900px;
      }

      .ao3-paper-divider {
        width: 520px;
        max-width: 70%;
        height: 1px;
        background: #555;
        margin: 18px auto 12px auto;
        position: relative;
      }

      .ao3-paper-divider::after {
        content: "◆";
        position: absolute;
        left: 50%;
        top: -10px;
        transform: translateX(-50%);
        background: #fff;
        padding: 0 14px;
        font-size: 14px;
        color: #111;
      }

      .ao3-paper-content p {
        margin: 0 0 0.62em 0;
        text-indent: 1.45em;
        font-family: "Times New Roman", Times, serif;
        font-size: ${FONT_SIZE_PX}px;
        line-height: ${LINE_HEIGHT};
        font-style: normal;
        font-weight: 400;
        text-align: justify;
      }

      .ao3-paper-content p:first-child {
        text-indent: 0;
      }

      .ao3-paper-content em,
      .ao3-paper-content i {
        font-style: normal;
      }

      .ao3-paper-content strong,
      .ao3-paper-content b {
        font-weight: 700;
      }

      .ao3-paper-content h1,
      .ao3-paper-content h2,
      .ao3-paper-content h3,
      .ao3-paper-content h4 {
        column-span: all;
        font-family: Arial, Helvetica, sans-serif;
        font-style: normal;
        font-weight: 700;
        color: #000;
        margin: 1.1em 0 0.55em 0;
        break-after: avoid;
      }

      .ao3-paper-content h1 {
        font-size: 22px;
      }

      .ao3-paper-content h2 {
        font-size: 20px;
      }

      .ao3-paper-content h3,
      .ao3-paper-content h4 {
        font-size: 18px;
      }

      .ao3-paper-content blockquote {
        margin: 0.8em 1.2em;
        padding-left: 1em;
        border-left: 3px solid #aaa;
        break-inside: avoid;
      }

      .ao3-paper-content ul,
      .ao3-paper-content ol {
        margin: 0.8em 0 0.8em 1.6em;
        padding: 0;
      }

      .ao3-paper-content li {
        margin: 0.25em 0;
      }

      .ao3-paper-content hr {
        column-span: all;
        border: none;
        border-top: 1px solid #999;
        margin: 1em 0;
      }

      .ao3-paper-number {
        position: absolute;
        bottom: 16px;
        left: 0;
        right: 0;
        text-align: center;
        font-family: "Times New Roman", Times, serif;
        font-size: 13px;
        color: #555;
      }

      #${TOOLBAR_ID} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 7px 8px;
        border: 1px solid #999;
        border-radius: 8px;
        background: #ffffff;
        color: #111;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
      }

      #${TOOLBAR_ID} button {
        border: 1px solid #aaa;
        border-radius: 5px;
        background: #f8f8f8;
        color: #111;
        padding: 5px 8px;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        cursor: pointer;
      }

      #${TOOLBAR_ID} button:hover {
        background: #eeeeee;
      }

      #ao3-paper-zoom-label {
        min-width: 46px;
        text-align: center;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        color: #111;
      }

      @media (max-width: 1200px) {
        body.ao3-arxiv-paper-mode #main {
          max-width: 100% !important;
        }

        #${VIEW_ID} {
          max-width: calc(100vw - 32px);
        }

        .ao3-paper-page {
          width: calc(100vw - 32px);
          padding-left: 30px;
          padding-right: 30px;
        }

        .ao3-paper-title {
          font-size: 30px;
        }

        .ao3-paper-side-stamp {
          display: none;
        }

        .ao3-paper-running-header {
          left: 30px;
          right: 30px;
        }
      }

      @media print {
        body.ao3-arxiv-paper-mode {
          background: #ffffff !important;
        }

        .ao3-paper-page {
          box-shadow: none;
          border: none;
          page-break-after: always;
        }

        #${TOOLBAR_ID} {
          display: none;
        }
      }
    `;

        document.head.appendChild(style);
    }

    function makeRunningHeader(pageIndex) {
        const header = document.createElement("div");
        header.className = "ao3-paper-running-header";

        const left = document.createElement("div");
        left.textContent = JOURNAL_TEXT;

        const right = document.createElement("div");
        right.textContent = String(pageIndex);

        header.appendChild(left);
        header.appendChild(right);

        return header;
    }

    function makeSideStamp(meta) {
        const stamp = document.createElement("div");
        stamp.className = "ao3-paper-side-stamp";

        const dateBase = meta.published || meta.updated;
        const dateText = formatDateForStamp(dateBase);
        const idText = meta.workId ? `${SUBJECT_TEXT} work ${meta.workId}` : SUBJECT_TEXT;

        stamp.textContent = `${dateText}   ${idText}`;

        return stamp;
    }

    function makeFrontMatter(meta) {
        const wrapper = document.createElement("div");
        wrapper.className = "ao3-paper-frontmatter";

        const title = document.createElement("div");
        title.className = "ao3-paper-title";
        title.textContent = meta.title;

        const author = document.createElement("div");
        author.className = "ao3-paper-author";
        author.textContent = meta.author;

        wrapper.appendChild(title);
        wrapper.appendChild(author);

        if (SHOW_ABSTRACT) {
            const abstractText = extractAbstractText();

            if (abstractText) {
                const abstract = document.createElement("div");
                abstract.className = "ao3-paper-abstract";

                const label = document.createElement("b");
                label.textContent = `${ABSTRACT_TITLE}—`;

                const body = document.createTextNode(abstractText);

                abstract.appendChild(label);
                abstract.appendChild(body);

                wrapper.appendChild(abstract);
            }
        }

        const index = document.createElement("div");
        index.className = "ao3-paper-index";

        const indexLabel = document.createElement("b");
        indexLabel.textContent = "Index Terms—";

        const indexText = document.createTextNode(
            "Local Reading Mode, Web Fiction, Archive Layout, Two-Column Typesetting."
        );

        index.appendChild(indexLabel);
        index.appendChild(indexText);

        wrapper.appendChild(index);

        const divider = document.createElement("div");
        divider.className = "ao3-paper-divider";
        wrapper.appendChild(divider);

        return wrapper;
    }

    function shouldSkipElement(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

        const selector =
            ".notes, .summary, .meta, .preface, .landmark, .navigation, .actions, #header, #footer, #comments";

        if (el.matches(selector)) return true;
        if (el.closest(selector)) return true;

        return false;
    }

    function findChapterRoot() {
        const candidates = [
            "#chapters",
            "#workskin",
            ".chapter",
            ".userstuff"
        ];

        for (const selector of candidates) {
            const el = document.querySelector(selector);
            if (!el) continue;

            const text = getCleanText(el);
            if (text.length > 200) {
                return el;
            }
        }

        return null;
    }

    function cleanClone(node) {
        const clone = node.cloneNode(true);

        if (clone.nodeType !== Node.ELEMENT_NODE) {
            return clone;
        }

        clone.querySelectorAll("script, style, iframe, noscript").forEach((el) => el.remove());

        clone.querySelectorAll("*").forEach((el) => {
            el.removeAttribute("style");
            el.removeAttribute("class");
            el.removeAttribute("id");
            el.removeAttribute("onclick");
            el.removeAttribute("onmouseover");
            el.removeAttribute("onmouseout");
        });

        clone.removeAttribute("style");
        clone.removeAttribute("class");
        clone.removeAttribute("id");

        return clone;
    }

    function paragraphFromText(text) {
        const p = document.createElement("p");
        p.textContent = text.replace(/\s+/g, " ").trim();
        return p;
    }

    function headingFromText(text, level) {
        const tag = level || "h2";
        const h = document.createElement(tag);
        h.textContent = text.replace(/\s+/g, " ").trim();
        return h;
    }

    function collectBlocksFromNode(node, blocks) {
        if (!node) return;

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.replace(/\s+/g, " ").trim();
            if (text.length > 0) {
                blocks.push(paragraphFromText(text));
            }
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        if (shouldSkipElement(node)) return;

        const tag = node.tagName.toLowerCase();

        if (["script", "style", "iframe", "noscript"].includes(tag)) return;
        if (tag === "br") return;

        if (["p", "blockquote", "ul", "ol", "hr"].includes(tag)) {
            const cloned = cleanClone(node);
            const text = getCleanText(cloned);

            if (tag === "hr" || text.length > 0) {
                blocks.push(cloned);
            }

            return;
        }

        if (["h1", "h2", "h3", "h4"].includes(tag)) {
            const text = getCleanText(node);
            if (text.length > 0) {
                blocks.push(headingFromText(text, tag));
            }
            return;
        }

        Array.from(node.childNodes).forEach((child) => collectBlocksFromNode(child, blocks));
    }

    function collectContentBlocks() {
        const root = findChapterRoot();
        if (!root) return [];

        const blocks = [];
        collectBlocksFromNode(root, blocks);

        return blocks.filter((block) => {
            const tag = block.tagName ? block.tagName.toLowerCase() : "";
            if (tag === "hr") return true;

            const text = getCleanText(block);
            if (text.length === 0) return false;

            const lower = text.toLowerCase();

            if (lower === "notes") return false;
            if (lower === "chapter text") return false;
            if (lower === "end notes") return false;

            return true;
        });
    }

    function splitParagraphNode(p) {
        const text = getCleanText(p);
        const words = text.split(/\s+/);
        const chunks = [];
        const WORDS_PER_CHUNK = 90;

        for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
            chunks.push(paragraphFromText(words.slice(i, i + WORDS_PER_CHUNK).join(" ")));
        }

        return chunks;
    }

    function createPage(pageIndex, meta) {
        const page = document.createElement("div");
        page.className = "ao3-paper-page";

        if (pageIndex === 1) {
            page.classList.add("first-page");
        }

        if (SHOW_RUNNING_HEADER) {
            page.appendChild(makeRunningHeader(pageIndex));
        }

        if (SHOW_SIDE_STAMP) {
            page.appendChild(makeSideStamp(meta));
        }

        const content = document.createElement("div");
        content.className = "ao3-paper-content";

        const number = document.createElement("div");
        number.className = "ao3-paper-number";
        number.textContent = String(pageIndex);

        page.appendChild(content);
        page.appendChild(number);

        return { page, content };
    }

    function pageOverflow(content) {
        return content.scrollWidth > content.clientWidth + 4;
    }

    function buildPages(blocks, view, meta) {
        let pageIndex = 1;
        let current = createPage(pageIndex, meta);

        view.appendChild(current.page);

        const frontMatter = makeFrontMatter(meta);
        current.content.appendChild(frontMatter);

        function newPage() {
            pageIndex += 1;
            current = createPage(pageIndex, meta);
            view.appendChild(current.page);
        }

        for (const block of blocks) {
            current.content.appendChild(block);

            if (!pageOverflow(current.content)) {
                continue;
            }

            current.content.removeChild(block);

            const tag = block.tagName ? block.tagName.toLowerCase() : "";
            const wordCount = getCleanText(block).split(/\s+/).length;
            const isLongParagraph = tag === "p" && wordCount > 100;

            if (isLongParagraph) {
                const chunks = splitParagraphNode(block);

                for (const chunk of chunks) {
                    current.content.appendChild(chunk);

                    if (pageOverflow(current.content)) {
                        current.content.removeChild(chunk);
                        newPage();
                        current.content.appendChild(chunk);
                    }
                }
            } else {
                newPage();
                current.content.appendChild(block);

                if (pageOverflow(current.content)) {
                    block.style.fontSize = "95%";
                }
            }
        }

        return pageIndex;
    }

    function buildView() {
        const oldView = document.getElementById(VIEW_ID);
        if (oldView) oldView.remove();

        const meta = getAO3Meta();
        const blocks = collectContentBlocks();

        if (blocks.length === 0) {
            alert("没有提取到正文。请确认页面已经完整加载，或关闭其他 AO3 样式脚本后再刷新。");
            return false;
        }

        const view = document.createElement("div");
        view.id = VIEW_ID;

        if (SHOW_DEBUG) {
            const debug = document.createElement("div");
            debug.className = "ao3-paper-debug";
            debug.textContent = `paper mode loaded, paragraphs ${blocks.length}`;
            view.appendChild(debug);
        }

        const main = document.querySelector("#main") || document.body;
        main.appendChild(view);

        buildPages(blocks, view, meta);

        return true;
    }

    function clampZoom(value) {
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    }

    function getSavedZoom() {
        const raw = localStorage.getItem(ZOOM_STORAGE_KEY);
        const value = Number(raw);

        if (!Number.isFinite(value)) {
            return DEFAULT_ZOOM;
        }

        return clampZoom(value);
    }

    function setPaperZoom(value) {
        const zoom = clampZoom(value);

        document.documentElement.style.setProperty(
            "--ao3-paper-zoom",
            String(zoom)
        );

        localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));

        const label = document.getElementById("ao3-paper-zoom-label");
        if (label) {
            label.textContent = `${Math.round(zoom * 100)}%`;
        }
    }

    function zoomIn() {
        setPaperZoom(getSavedZoom() + ZOOM_STEP);
    }

    function zoomOut() {
        setPaperZoom(getSavedZoom() - ZOOM_STEP);
    }

    function resetZoom() {
        setPaperZoom(DEFAULT_ZOOM);
    }

    function enableMode() {
        addStyle();

        const ok = buildView();

        if (!ok) {
            document.body.classList.remove("ao3-arxiv-paper-mode");
            localStorage.setItem(STORAGE_KEY, "0");
            return;
        }

        document.body.classList.add("ao3-arxiv-paper-mode");
        localStorage.setItem(STORAGE_KEY, "1");
        setPaperZoom(getSavedZoom());
    }

    function disableMode() {
        document.body.classList.remove("ao3-arxiv-paper-mode");
        localStorage.setItem(STORAGE_KEY, "0");

        const view = document.getElementById(VIEW_ID);
        if (view) view.remove();
    }

    function toggleMode() {
        if (document.body.classList.contains("ao3-arxiv-paper-mode")) {
            disableMode();
        } else {
            enableMode();
        }
    }

    function addFloatingToolbar() {
        if (document.getElementById(TOOLBAR_ID)) return;

        const toolbar = document.createElement("div");
        toolbar.id = TOOLBAR_ID;

        const zoomOutBtn = document.createElement("button");
        zoomOutBtn.textContent = "A−";
        zoomOutBtn.title = "Zoom out";
        zoomOutBtn.addEventListener("click", zoomOut);

        const zoomLabel = document.createElement("span");
        zoomLabel.id = "ao3-paper-zoom-label";

        const zoomInBtn = document.createElement("button");
        zoomInBtn.textContent = "A+";
        zoomInBtn.title = "Zoom in";
        zoomInBtn.addEventListener("click", zoomIn);

        const resetBtn = document.createElement("button");
        resetBtn.textContent = "Reset";
        resetBtn.title = "Reset zoom";
        resetBtn.addEventListener("click", resetZoom);

        const paperBtn = document.createElement("button");
        paperBtn.id = BUTTON_ID;
        paperBtn.textContent = "Paper";
        paperBtn.title = "Toggle paper mode";
        paperBtn.addEventListener("click", toggleMode);

        toolbar.appendChild(zoomOutBtn);
        toolbar.appendChild(zoomLabel);
        toolbar.appendChild(zoomInBtn);
        toolbar.appendChild(resetBtn);
        toolbar.appendChild(paperBtn);

        document.body.appendChild(toolbar);

        setPaperZoom(getSavedZoom());
    }

    document.addEventListener("keydown", function (event) {
        if (event.altKey && event.code === "KeyP") {
            event.preventDefault();
            toggleMode();
        }

        if (event.altKey && event.code === "Equal") {
            event.preventDefault();
            zoomIn();
        }

        if (event.altKey && event.code === "Minus") {
            event.preventDefault();
            zoomOut();
        }

        if (event.altKey && event.code === "Digit0") {
            event.preventDefault();
            resetZoom();
        }
    });

    function boot() {
        addStyle();
        addFloatingToolbar();

        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved !== "0") {
            enableMode();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();