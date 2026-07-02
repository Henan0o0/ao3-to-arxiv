// ==UserScript==
// @name         AO3 to arXiv Paper Reader with Zoom
// @namespace    local.ao3.arxiv.paper.reader.zoom
// @version      1.0.0
// @description  Convert AO3 work pages into an arXiv-like paper layout with zoom, dynamic index terms, and comment references.
// @match        https://archiveofourown.org/works/*
// @match        https://www.archiveofourown.org/works/*
// @match        https://archiveofourown.gay/works/*
// @match        https://www.archiveofourown.gay/works/*
// @match        https://archive.transformativeworks.org/works/*
// @match        https://www.archive.transformativeworks.org/works/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    const STYLE_ID = "ao3-arxiv-paper-style";
    const VIEW_ID = "ao3-arxiv-paper-view";
    const TOOLBAR_ID = "ao3-arxiv-paper-toolbar";
    const STORAGE_KEY = "ao3_arxiv_paper_reader_enabled";
    const ZOOM_STORAGE_KEY = "ao3_arxiv_paper_zoom";

    const FONT_SIZE_PX = 16;
    const LINE_HEIGHT = 1.05;
    const LINES_PER_COLUMN = 80;
    const PAGE_WIDTH_PX = 1120;
    const COLUMN_GAP_PX = 38;

    const DEFAULT_ZOOM = 1.0;
    const MIN_ZOOM = 0.65;
    const MAX_ZOOM = 1.35;
    const ZOOM_STEP = 0.05;

    // Set to true if you need the yellow debug banner and console logs.
    const SHOW_DEBUG = false;
    const SHOW_ABSTRACT = true;
    const SHOW_NOTES_AS_ABSTRACT = true;
    const SHOW_RUNNING_HEADER = true;

    const SHOW_SIDE_STAMP = true;
    const SIDE_STAMP_EVERY_PAGE = false;
    const SIDE_STAMP_FONT_SIZE_PX = 30;

    const SHOW_COMMENT_REFERENCES = true;
    const COMMENT_REFERENCE_LIMIT = 100;
    const COMMENT_REFERENCE_MAX_CHARS = 220;
    const FETCH_COMMENTS_IF_MISSING = true;

    // Maximum count for each Index Terms section.
    const INDEX_RELATIONSHIP_LIMIT = 12;
    const INDEX_ADDITIONAL_TAG_LIMIT = 18;

    const JOURNAL_TEXT = "JOURNAL OF LOCAL AO3 CLASS FILES, VOL. 1, NO. 1";
    const SUBJECT_TEXT = "[AO3]";
    const ABSTRACT_TITLE = "Abstract";

    const SIDE_STAMP_WIDTH_PX = 20;
    const PAGE_HEADER_HEIGHT_PX = 24;
    const PAGE_FOOTER_HEIGHT_PX = 18;
    const PAGE_ROW_GAP_PX = 12;
    const PAGE_CONTENT_HEIGHT_PX = Math.round(FONT_SIZE_PX * LINE_HEIGHT * LINES_PER_COLUMN);
    const PAGE_HEIGHT_PX = PAGE_HEADER_HEIGHT_PX + PAGE_CONTENT_HEIGHT_PX + PAGE_FOOTER_HEIGHT_PX + PAGE_ROW_GAP_PX * 2 + 34;

    const COMMENT_WRAPPER_SELECTOR = "li.comment, div.comment, li[id^='comment_'], div[id^='comment_'], li[id*='comment_'], div[id*='comment_']";

    function normalizeText(text) {
        return String(text || "")
            .replace(/\u00a0/g, " ")
            .replace(/\r/g, "\n")
            .replace(/[ \t\f\v]+/g, " ")
            .replace(/\n[ \t]+/g, "\n")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/([.!?])(?=[A-Z])/g, "$1 ")
            .replace(/([。！？])(?=\S)/g, "$1 ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function getCleanText(el) {
        return el ? normalizeText(el.textContent || "") : "";
    }

    function unique(items) {
        return Array.from(new Set(items.filter(Boolean)));
    }

    function findDtValue(labelPattern) {
        for (const dt of Array.from(document.querySelectorAll("dt"))) {
            if (!labelPattern.test(getCleanText(dt))) continue;

            let next = dt.nextElementSibling;

            while (next) {
                if (next.tagName?.toLowerCase() === "dd") {
                    const value = getCleanText(next);
                    if (value) return value;
                }

                if (next.tagName?.toLowerCase() === "dt") break;
                next = next.nextElementSibling;
            }
        }

        return "";
    }

    function findDtValues(labelPattern) {
        const values = [];

        for (const dt of Array.from(document.querySelectorAll("dt"))) {
            if (!labelPattern.test(getCleanText(dt))) continue;

            let next = dt.nextElementSibling;

            while (next) {
                if (next.tagName?.toLowerCase() === "dd") {
                    const links = Array.from(next.querySelectorAll("a"))
                        .map(getCleanText)
                        .filter(Boolean);

                    if (links.length) {
                        values.push(...links);
                    } else {
                        const text = getCleanText(next);
                        if (text) values.push(text);
                    }
                }

                if (next.tagName?.toLowerCase() === "dt") break;
                next = next.nextElementSibling;
            }
        }

        return unique(values);
    }

    function getAO3IndexTerms() {
        const relationships = findDtValues(/^Relationships?:?/i).slice(0, INDEX_RELATIONSHIP_LIMIT);
        const additionalTags = findDtValues(/^Additional Tags?:?/i).slice(0, INDEX_ADDITIONAL_TAG_LIMIT);
        const parts = [];

        if (relationships.length) parts.push(`Relationships: ${relationships.join(", ")}`);
        if (additionalTags.length) parts.push(`Additional Tags: ${additionalTags.join(", ")}`);

        return parts.length ? parts.join("; ") + "." : "AO3 Work, Web Fiction, Archive Layout.";
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

        return { title, author, published, updated, workId, chapterId };
    }

    function formatDateForStamp(dateStr) {
        if (!dateStr) return "Unknown Date";

        const iso = dateStr.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);

        if (!iso) return dateStr;

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${Number(iso[3])} ${months[Number(iso[2]) - 1] || ""} ${iso[1]}`.trim();
    }

    function shouldSkipElement(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

        const selector = ".summary, .meta, .preface, .landmark, .navigation, .actions, #header, #footer, #comments, #feedback";
        return el.matches(selector) || Boolean(el.closest(selector));
    }

    function shouldSkipForAbstract(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

        const selector = ".meta, .landmark, .navigation, .actions, #header, #footer, #comments, #feedback";
        return el.matches(selector) || Boolean(el.closest(selector));
    }

    function htmlToTextParts(el, options = {}) {
        if (!el) return [];

        const clone = el.cloneNode(true);
        const removeSelector = options.keepNotes
            ? "script, style, iframe, noscript, .summary, .meta, .preface, .landmark, .navigation, .actions, #comments, #feedback"
            : "script, style, iframe, noscript, .notes, .summary, .meta, .preface, .landmark, .navigation, .actions, #comments, #feedback";

        clone.querySelectorAll(removeSelector).forEach((node) => node.remove());

        const html = (clone.innerHTML || "")
            .replace(/<hr[^>]*>/gi, "\n[[AO3_HR]]\n")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<\/div>/gi, "\n")
            .replace(/<\/blockquote>/gi, "\n")
            .replace(/<\/li>/gi, "\n")
            .replace(/<\/h[1-4]>/gi, "\n");

        const temp = document.createElement("div");
        temp.innerHTML = html;

        return (temp.textContent || "")
            .split(/\n+/)
            .map(normalizeText)
            .filter(Boolean);
    }

    function extractAbstractText() {
        for (const selector of [".summary .userstuff", ".summary blockquote", ".summary"]) {
            const text = htmlToTextParts(document.querySelector(selector), { keepNotes: false })
                .filter((p) => p !== "[[AO3_HR]]")
                .join(" ");

            if (text.length > 40) return text;
        }

        if (!SHOW_NOTES_AS_ABSTRACT) return "";

        for (const selector of [".chapter.preface .notes .userstuff", ".preface .notes .userstuff", ".notes .userstuff"]) {
            const el = document.querySelector(selector);
            if (!el || shouldSkipForAbstract(el)) continue;

            const text = htmlToTextParts(el, { keepNotes: true })
                .filter((p) => p !== "[[AO3_HR]]")
                .join(" ");

            if (text.length > 40) return text;
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
      body.ao3-arxiv-paper-mode #feedback,
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
        height: ${PAGE_HEIGHT_PX}px;
        margin: 0 auto 22px auto;
        padding: 18px 46px 16px 22px;
        background: #fff;
        border: 1px solid #d0d0d0;
        box-shadow: 0 1px 10px rgba(0,0,0,.08);
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: ${SIDE_STAMP_WIDTH_PX}px minmax(0,1fr);
        grid-template-rows: ${PAGE_HEADER_HEIGHT_PX}px ${PAGE_CONTENT_HEIGHT_PX}px ${PAGE_FOOTER_HEIGHT_PX}px;
        column-gap: 18px;
        row-gap: ${PAGE_ROW_GAP_PX}px;
      }

      .ao3-paper-running-header {
        grid-column: 2;
        grid-row: 1;
        position: static;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        color: #222;
        text-transform: uppercase;
        letter-spacing: .2px;
        white-space: nowrap;
        min-width: 0;
      }

      .ao3-paper-side-stamp {
        grid-column: 1;
        grid-row: 2;
        position: static;
        align-self: center;
        justify-self: center;
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        font-family: "Times New Roman", Times, serif;
        font-size: ${SIDE_STAMP_FONT_SIZE_PX}px;
        color: #8a8a8a;
        letter-spacing: 1px;
        line-height: 1.1;
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
        max-height: ${PAGE_CONTENT_HEIGHT_PX}px;
        overflow: hidden;
      }

      .ao3-paper-content {
        grid-column: 2;
        grid-row: 2;
        min-width: 0;
        height: ${PAGE_CONTENT_HEIGHT_PX}px;
        column-count: 2;
        column-gap: ${COLUMN_GAP_PX}px;
        column-rule: 1px solid #d8d8d8;
        overflow: hidden;
        font-family: "Times New Roman", Times, serif;
        font-size: ${FONT_SIZE_PX}px;
        line-height: ${LINE_HEIGHT};
        color: #111;
        text-align: left;
        white-space: normal;
        word-break: normal;
        overflow-wrap: normal;
        hyphens: manual;
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

      .ao3-paper-abstract,
      .ao3-paper-index {
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
        margin: 0 0 .62em 0;
        text-indent: 1.45em;
        font-family: "Times New Roman", Times, serif;
        font-size: ${FONT_SIZE_PX}px;
        line-height: ${LINE_HEIGHT};
        font-style: normal;
        font-weight: 400;
        text-align: left;
        white-space: normal;
        word-break: normal;
        overflow-wrap: normal;
        hyphens: manual;
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
        margin: 1.1em 0 .55em 0;
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
        margin: .8em 1.2em;
        padding-left: 1em;
        border-left: 3px solid #aaa;
        break-inside: avoid;
      }

      .ao3-paper-content ul,
      .ao3-paper-content ol {
        margin: .8em 0 .8em 1.6em;
        padding: 0;
      }

      .ao3-paper-content li {
        margin: .25em 0;
      }

      .ao3-paper-content hr {
        column-span: all;
        border: none;
        border-top: 1px solid #888;
        margin: 1.15em 0;
        height: 0;
      }

      .ao3-reference-title {
        column-span: all;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 19px;
        font-weight: 700;
        margin: .8em 0 .5em 0;
        text-align: left;
        break-after: avoid;
      }

      .ao3-paper-content p.ao3-reference {
        font-family: "Times New Roman", Times, serif;
        font-size: calc(${FONT_SIZE_PX}px * .82);
        line-height: 1.12;
        text-indent: 0;
        padding-left: 0;
        margin: 0 0 .32em 0;
        text-align: left;
        break-inside: auto;
        overflow-wrap: anywhere;
        word-break: normal;
      }

      .ao3-paper-number {
        grid-column: 1 / 3;
        grid-row: 3;
        position: static;
        text-align: center;
        font-family: "Times New Roman", Times, serif;
        font-size: 13px;
        color: #555;
        align-self: end;
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
        background: #fff;
        color: #111;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0,0,0,.18);
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
        background: #eee;
      }

      #ao3-paper-zoom-label {
        min-width: 46px;
        text-align: center;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        color: #111;
      }

      @media(max-width:1200px) {
        body.ao3-arxiv-paper-mode #main {
          max-width: 100% !important;
        }

        #${VIEW_ID} {
          max-width: calc(100vw - 32px);
        }

        .ao3-paper-page {
          width: calc(100vw - 32px);
          padding: 18px 30px 16px 16px;
          grid-template-columns: 76px minmax(0,1fr);
          column-gap: 14px;
        }

        .ao3-paper-title {
          font-size: 30px;
        }

        .ao3-paper-side-stamp {
          display: block;
          font-size: calc(${SIDE_STAMP_FONT_SIZE_PX}px * .8);
        }

        .ao3-paper-running-header {
          font-size: 11px;
        }
      }

      @media(max-width:760px) {
        .ao3-paper-page {
          grid-template-columns: minmax(0,1fr);
          padding-left: 30px;
          padding-right: 30px;
        }

        .ao3-paper-side-stamp {
          display: none;
        }

        .ao3-paper-running-header,
        .ao3-paper-content {
          grid-column: 1;
        }

        .ao3-paper-number {
          grid-column: 1;
        }
      }

      @media print {
        body.ao3-arxiv-paper-mode {
          background: #fff !important;
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

        header.append(left, right);
        return header;
    }

    function makeSideStamp(meta) {
        const stamp = document.createElement("div");
        stamp.className = "ao3-paper-side-stamp";

        const dateText = formatDateForStamp(meta.published || meta.updated);
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

        wrapper.append(title, author);

        if (SHOW_ABSTRACT) {
            const abstractText = extractAbstractText();

            if (abstractText) {
                const abstract = document.createElement("div");
                abstract.className = "ao3-paper-abstract";

                const label = document.createElement("b");
                label.textContent = `${ABSTRACT_TITLE}—`;

                abstract.append(label, document.createTextNode(abstractText));
                wrapper.appendChild(abstract);
            }
        }

        const index = document.createElement("div");
        index.className = "ao3-paper-index";

        const indexLabel = document.createElement("b");
        indexLabel.textContent = "Index Terms—";

        index.append(indexLabel, document.createTextNode(getAO3IndexTerms()));
        wrapper.appendChild(index);

        const divider = document.createElement("div");
        divider.className = "ao3-paper-divider";
        wrapper.appendChild(divider);

        return wrapper;
    }

    function makeHorizontalRule() {
        return document.createElement("hr");
    }

    function normalizeCommentText(text) {
        return normalizeText(text).replace(/\s+/g, " ").trim();
    }

    function truncateText(text, maxChars) {
        const clean = normalizeCommentText(text);

        if (clean.length <= maxChars) return clean;

        return clean.slice(0, maxChars).replace(/\s+\S*$/, "") + "...";
    }

    function makeCommentReferenceTitle() {
        const h = document.createElement("h2");
        h.className = "ao3-reference-title";
        h.textContent = "References";
        return h;
    }

    function makeCommentReferenceItem(index, author, dateText, commentText) {
        const p = document.createElement("p");
        p.className = "ao3-reference";

        const safeAuthor = author || "Anonymous";
        const safeDate = dateText ? `, ${dateText}` : "";
        const excerpt = truncateText(commentText, COMMENT_REFERENCE_MAX_CHARS);

        p.textContent = `[${index}] ${safeAuthor}. “${excerpt}” AO3 comment${safeDate}.`;
        return p;
    }

    function getAbsoluteUrl(href) {
        try {
            return href ? new URL(href, location.href).href : "";
        } catch (_) {
            return "";
        }
    }

    function addShowCommentsParam(url) {
        try {
            const u = new URL(url, location.href);
            u.searchParams.set("show_comments", "true");

            if (!u.hash) u.hash = "comments";

            return u.href;
        } catch (_) {
            return "";
        }
    }

    function getCommentFetchUrls() {
        const urls = [];

        const add = (url) => {
            if (url && !urls.includes(url)) urls.push(url);
        };

        add(addShowCommentsParam(location.href));

        for (const a of Array.from(document.querySelectorAll("a"))) {
            const text = getCleanText(a).toLowerCase();
            const href = a.getAttribute("href") || "";

            if (
                !(
                    text.includes("comment") ||
                    href.includes("show_comments") ||
                    href.includes("#comments") ||
                    href.includes("/comments/")
                )
            ) {
                continue;
            }

            const abs = getAbsoluteUrl(href);
            if (!abs) continue;

            add(addShowCommentsParam(abs));
            add(abs);
        }

        const workId = (location.pathname.match(/\/works\/(\d+)/) || [])[1] || "";
        const chapterId = (location.pathname.match(/\/chapters\/(\d+)/) || [])[1] || "";

        if (workId && chapterId) {
            add(`${location.origin}/comments/show_comments?chapter_id=${chapterId}&show_comments=true`);
            add(`${location.origin}/works/${workId}/chapters/${chapterId}?show_comments=true&view_full_work=false#comments`);
        }

        if (workId) {
            add(`${location.origin}/works/${workId}?show_comments=true#comments`);
            add(`${location.origin}/works/${workId}?show_comments=true&view_full_work=true#comments`);
        }

        return urls;
    }

    function decodePossibleAo3RemoteHtml(rawText) {
        let text = String(rawText || "")
            .replace(/\\u003C/g, "<")
            .replace(/\\u003E/g, ">")
            .replace(/\\u0026/g, "&")
            .replace(/\\u002F/g, "/")
            .replace(/\\\//g, "/")
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\n")
            .replace(/\\t/g, " ");

        const textarea = document.createElement("textarea");
        textarea.innerHTML = text;

        return textarea.value;
    }

    function parseHtmlLikeDocuments(rawText) {
        const parser = new DOMParser();
        const raw = String(rawText || "");
        const decoded = decodePossibleAo3RemoteHtml(raw);
        const docs = [parser.parseFromString(raw, "text/html")];

        if (decoded !== raw) docs.push(parser.parseFromString(decoded, "text/html"));

        const firstTag = decoded.indexOf("<");
        const lastTag = decoded.lastIndexOf(">");

        if (firstTag >= 0 && lastTag > firstTag) {
            docs.push(parser.parseFromString(decoded.slice(firstTag, lastTag + 1), "text/html"));
        }

        return docs;
    }

    function isOwnedByThisComment(node, commentEl) {
        const owner = node.closest(COMMENT_WRAPPER_SELECTOR);
        return !owner || owner === commentEl;
    }

    function getOwnedDescendants(commentEl, selector) {
        return Array.from(commentEl.querySelectorAll(selector)).filter((node) =>
            isOwnedByThisComment(node, commentEl)
        );
    }

    function cloneCommentWithoutNestedReplies(commentEl) {
        const clone = commentEl.cloneNode(true);
        clone.querySelectorAll(COMMENT_WRAPPER_SELECTOR).forEach((node) => node.remove());
        return clone;
    }

    function getCommentCandidateElements(container) {
        if (!container) return [];

        const selector = [
            "li.comment",
            "div.comment",
            "li[id^='comment_']",
            "div[id^='comment_']",
            "li[id*='comment_']",
            "div[id*='comment_']",
            ".comment .userstuff"
        ].join(", ");

        const raw = [];

        if (container.nodeType === Node.ELEMENT_NODE && container.matches(selector)) raw.push(container);

        raw.push(...Array.from(container.querySelectorAll(selector)));

        const candidates = [];

        for (const el of raw) {
            const wrapper = el.closest(COMMENT_WRAPPER_SELECTOR) || el.closest(".comment") || el;

            if (!candidates.includes(wrapper)) candidates.push(wrapper);
        }

        return candidates;
    }

    function extractCommentAuthor(commentEl) {
        for (const selector of [
            ".byline a[rel='author']",
            ".byline .user",
            "h4.byline a",
            ".heading.byline a",
            ".commenter",
            ".user"
        ]) {
            for (const el of getOwnedDescendants(commentEl, selector)) {
                const text = getCleanText(el);
                if (text) return text;
            }
        }

        for (const node of getOwnedDescendants(commentEl, ".byline, h4, .heading")) {
            const byline = getCleanText(node);

            if (byline) {
                return byline
                    .replace(/\s+said:.*$/i, "")
                    .replace(/\s+on\s+.*$/i, "")
                    .replace(/\s+Chapter\s+\d+.*$/i, "")
                    .replace(/\s+commented:.*$/i, "")
                    .trim();
            }
        }

        return "Anonymous";
    }

    function extractCommentDate(commentEl) {
        for (const selector of ["time", ".datetime", ".posted", ".date"]) {
            for (const el of getOwnedDescendants(commentEl, selector)) {
                const datetime = el.getAttribute("datetime");

                if (datetime) return datetime.slice(0, 10);

                const text = getCleanText(el);
                if (text) return text;
            }
        }

        const text = getCleanText(cloneCommentWithoutNestedReplies(commentEl));

        const dateMatch =
            text.match(/\d{4}-\d{2}-\d{2}/) ||
            text.match(/\d{1,2}\s+\w+\s+\d{4}/) ||
            text.match(/\w{3}\s+\d{1,2}\s+\w{3}\s+\d{4}\s+\d{1,2}:\d{2}[AP]M\s+UTC/i);

        return dateMatch ? dateMatch[0] : "";
    }

    function extractCommentBody(commentEl) {
        for (const selector of [".userstuff", ".comment-text", ".comment-body", "blockquote"]) {
            for (const el of getOwnedDescendants(commentEl, selector)) {
                if (el.closest(".byline, .actions, .navigation, .landmark")) continue;

                const text = getCleanText(el);
                if (text.length > 0) return text;
            }
        }

        const clone = cloneCommentWithoutNestedReplies(commentEl);

        clone
            .querySelectorAll(
                ".byline, h4.byline, .heading.byline, .actions, .navigation, .landmark, script, style, iframe, noscript, form, input, button"
            )
            .forEach((node) => node.remove());

        return getCleanText(clone);
    }

    function isRealCommentElement(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

        if (el.closest(".summary, .notes, .meta, .preface, #chapters, #workskin, .chapter, .actions, .navigation, .landmark")) {
            return false;
        }

        const body = extractCommentBody(el);
        if (!body || body.length < 2) return false;

        const text = getCleanText(cloneCommentWithoutNestedReplies(el)).toLowerCase();

        if (
            text === "comments" ||
            text.startsWith("comments (") ||
            text.includes("post comment") ||
            text.includes("leave a comment") ||
            text.includes("summary") ||
            text.includes("notes")
        ) {
            return false;
        }

        const id = el.getAttribute("id") || "";
        const className = el.getAttribute("class") || "";

        const hasCommentIdentity = /comment_\d+/.test(id) || /\bcomment\b/.test(className);
        const hasByline = getOwnedDescendants(el, ".byline, h4.byline, .heading.byline, a[rel='author']").length > 0;
        const hasBody = getOwnedDescendants(el, ".userstuff, blockquote, .comment-text, .comment-body").length > 0;

        return hasCommentIdentity || (hasByline && hasBody);
    }

    function extractCommentElementsFromContainer(container) {
        const candidates = getCommentCandidateElements(container).filter(isRealCommentElement);
        const uniqueComments = [];
        const seenKeys = new Set();

        for (const el of candidates) {
            const body = extractCommentBody(el);
            const author = extractCommentAuthor(el);
            const dateText = extractCommentDate(el);

            if (body.length < 2) continue;

            const key = `${author}|${dateText}|${body.slice(0, 160)}`;

            if (seenKeys.has(key)) continue;

            seenKeys.add(key);
            uniqueComments.push(el);
        }

        return uniqueComments;
    }

    function extractCommentElementsFromDocument(doc) {
        if (!doc) return [];

        const roots = [
            doc.querySelector("#comments"),
            doc.querySelector("#comments_placeholder"),
            doc.querySelector("#feedback"),
            doc.querySelector("ol.thread"),
            doc.querySelector(".comments"),
            doc.querySelector(".feedback"),
            doc.body,
            doc.documentElement
        ].filter(Boolean);

        const all = [];
        const seenKeys = new Set();

        for (const root of roots) {
            for (const el of extractCommentElementsFromContainer(root)) {
                const body = extractCommentBody(el);
                const author = extractCommentAuthor(el);
                const dateText = extractCommentDate(el);
                const key = `${author}|${dateText}|${body.slice(0, 160)}`;

                if (seenKeys.has(key)) continue;

                seenKeys.add(key);
                all.push(el);
            }
        }

        return all;
    }

    async function fetchCommentsFromUrl(url) {
        try {
            if (SHOW_DEBUG) console.warn("[AO3 Paper] Trying comment URL:", url);

            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                cache: 'no-cache',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });

            if (!response.ok) {
                if (SHOW_DEBUG) console.warn("[AO3 Paper] Comment fetch failed:", response.status, url);
                return [];
            }

            const rawText = await response.text();

            if (!rawText || rawText.length < 50) return [];

            const docs = parseHtmlLikeDocuments(rawText);
            const all = [];
            const seenKeys = new Set();

            for (const doc of docs) {
                for (const el of extractCommentElementsFromDocument(doc)) {
                    const body = extractCommentBody(el);
                    const author = extractCommentAuthor(el);
                    const dateText = extractCommentDate(el);
                    const key = `${author}|${dateText}|${body.slice(0, 160)}`;

                    if (seenKeys.has(key)) continue;

                    seenKeys.add(key);
                    all.push(el);
                }
            }

            if (SHOW_DEBUG) console.warn("[AO3 Paper] Parsed comments from URL:", all.length, url);

            return all;
        } catch (err) {
            if (SHOW_DEBUG) console.warn("[AO3 Paper] Comment fetch error:", err, url);
            return [];
        }
    }

    async function fetchCommentElements() {
        if (!FETCH_COMMENTS_IF_MISSING) return [];

        const all = [];
        const seenKeys = new Set();

        for (const url of getCommentFetchUrls()) {
            const comments = await fetchCommentsFromUrl(url);

            for (const el of comments) {
                const body = extractCommentBody(el);
                const author = extractCommentAuthor(el);
                const dateText = extractCommentDate(el);
                const key = `${author}|${dateText}|${body.slice(0, 160)}`;

                if (seenKeys.has(key)) continue;

                seenKeys.add(key);
                all.push(el);
            }

            if (all.length > 0) break;
        }

        return all;
    }

    async function collectCommentReferenceBlocks() {
        if (!SHOW_COMMENT_REFERENCES) return [];

        let comments = extractCommentElementsFromDocument(document);

        if (SHOW_DEBUG) console.warn("[AO3 Paper] Comments from current DOM:", comments.length);

        if (comments.length === 0) comments = await fetchCommentElements();
        if (comments.length === 0) return [];

        const blocks = [makeHorizontalRule(), makeCommentReferenceTitle()];

        comments.slice(0, COMMENT_REFERENCE_LIMIT).forEach((commentEl, idx) => {
            blocks.push(
                makeCommentReferenceItem(
                    idx + 1,
                    extractCommentAuthor(commentEl),
                    extractCommentDate(commentEl),
                    extractCommentBody(commentEl)
                )
            );
        });

        if (comments.length > COMMENT_REFERENCE_LIMIT) {
            const p = document.createElement("p");
            p.className = "ao3-reference";
            p.textContent = `[${COMMENT_REFERENCE_LIMIT + 1}] Additional AO3 comments omitted. Total comments found ${comments.length}.`;
            blocks.push(p);
        }

        return blocks;
    }

    function findChapterTextRoots() {
        const roots = [];

        for (const selector of ["#chapters .userstuff", "#workskin .userstuff", ".chapter .userstuff", ".userstuff"]) {
            const nodes = Array.from(document.querySelectorAll(selector)).filter(
                (el) => !shouldSkipElement(el) && getCleanText(el).length > 120
            );

            if (nodes.length > 0) {
                for (const node of nodes) {
                    if (!roots.includes(node)) roots.push(node);
                }
                break;
            }
        }

        if (roots.length > 0) return roots;

        const fallback =
            document.querySelector("#chapters") ||
            document.querySelector("#workskin") ||
            document.querySelector(".chapter");

        return fallback && getCleanText(fallback).length > 200 ? [fallback] : [];
    }

    function paragraphFromText(text) {
        const p = document.createElement("p");
        p.textContent = normalizeText(text);
        return p;
    }

    function headingFromText(text, level) {
        const h = document.createElement(level || "h2");
        h.textContent = normalizeText(text);
        return h;
    }

    function collectBlocksFromParagraphs(root) {
        const blocks = [];

        for (const node of Array.from(root.childNodes)) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = normalizeText(node.textContent);

                if (text) blocks.push(paragraphFromText(text));
                continue;
            }

            if (node.nodeType !== Node.ELEMENT_NODE || shouldSkipElement(node)) continue;

            const tag = node.tagName.toLowerCase();

            if (["script", "style", "iframe", "noscript", "br"].includes(tag)) continue;

            if (tag === "hr") {
                blocks.push(makeHorizontalRule());
                continue;
            }

            if (tag === "p") {
                for (const part of htmlToTextParts(node, { keepNotes: true })) {
                    if (part === "[[AO3_HR]]") blocks.push(makeHorizontalRule());
                    else if (part) blocks.push(paragraphFromText(part));
                }
                continue;
            }

            if (["h1", "h2", "h3", "h4"].includes(tag)) {
                const text = getCleanText(node);

                if (text) blocks.push(headingFromText(text, tag));
                continue;
            }

            blocks.push(...collectBlocksFromParagraphs(node));
        }

        return blocks;
    }

    function collectBlocksFromBreakText(root) {
        const blocks = [];

        for (const part of htmlToTextParts(root, { keepNotes: true })) {
            const lower = part.toLowerCase();

            if (part === "[[AO3_HR]]") blocks.push(makeHorizontalRule());
            else if (!["notes", "chapter text", "end notes"].includes(lower)) blocks.push(paragraphFromText(part));
        }

        return blocks;
    }

    function collectContentBlocks() {
        const allBlocks = [];

        for (const root of findChapterTextRoots()) {
            const paragraphBlocks = collectBlocksFromParagraphs(root);
            const blocks = paragraphBlocks.length ? paragraphBlocks : collectBlocksFromBreakText(root);

            for (const block of blocks) {
                const tag = block.tagName?.toLowerCase() || "";

                if (tag === "hr") {
                    allBlocks.push(block);
                    continue;
                }

                const text = getCleanText(block);
                const lower = text.toLowerCase();

                if (text && !["notes", "chapter text", "end notes"].includes(lower)) allBlocks.push(block);
            }
        }

        return allBlocks;
    }

    function splitParagraphNode(p) {
        const words = getCleanText(p).split(/\s+/);
        const chunks = [];

        for (let i = 0; i < words.length; i += 90) {
            chunks.push(paragraphFromText(words.slice(i, i + 90).join(" ")));
        }

        return chunks;
    }

    function createPage(pageIndex, meta) {
        const page = document.createElement("div");
        page.className = "ao3-paper-page";

        if (pageIndex === 1) page.classList.add("first-page");
        if (SHOW_RUNNING_HEADER) page.appendChild(makeRunningHeader(pageIndex));
        if (SHOW_SIDE_STAMP && (SIDE_STAMP_EVERY_PAGE || pageIndex === 1)) page.appendChild(makeSideStamp(meta));

        const content = document.createElement("div");
        content.className = "ao3-paper-content";

        const number = document.createElement("div");
        number.className = "ao3-paper-number";
        number.textContent = String(pageIndex);

        page.append(content, number);

        return { page, content };
    }

    function pageOverflow(content) {
        const overflowBy = content.scrollWidth - content.clientWidth;
        const threshold = Math.max(80, content.clientWidth * 0.08);

        return overflowBy > threshold;
    }

    function buildPages(blocks, view, meta) {
        let pageIndex = 1;
        let current = createPage(pageIndex, meta);

        view.appendChild(current.page);
        current.content.appendChild(makeFrontMatter(meta));

        function newPage() {
            pageIndex += 1;
            current = createPage(pageIndex, meta);
            view.appendChild(current.page);
        }

        for (const block of blocks) {
            current.content.appendChild(block);

            if (!pageOverflow(current.content)) continue;

            current.content.removeChild(block);

            const tag = block.tagName?.toLowerCase() || "";
            const wordCount = getCleanText(block).split(/\s+/).length;

            if (tag === "p" && wordCount > 100) {
                for (const chunk of splitParagraphNode(block)) {
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

                if (pageOverflow(current.content)) block.style.fontSize = "95%";
            }
        }
    }

    async function buildView() {
        document.getElementById(VIEW_ID)?.remove();

        const meta = getAO3Meta();
        const blocks = collectContentBlocks();
        const refs = await collectCommentReferenceBlocks();

        if (blocks.length === 0) {
            alert("没有提取到正文。请确认页面已经完整加载，或关闭其他 AO3 样式脚本后再刷新。");
            return false;
        }

        const view = document.createElement("div");
        view.id = VIEW_ID;

        if (SHOW_DEBUG) {
            const debug = document.createElement("div");
            debug.className = "ao3-paper-debug";
            debug.textContent = `paper mode loaded, blocks ${blocks.length + refs.length}, references ${refs.length}`;
            view.appendChild(debug);
        }

        (document.querySelector("#main") || document.body).appendChild(view);
        buildPages(blocks.concat(refs), view, meta);

        return true;
    }

    function clampZoom(value) {
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    }

    function getSavedZoom() {
        const value = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
        return Number.isFinite(value) ? clampZoom(value) : DEFAULT_ZOOM;
    }

    function setPaperZoom(value) {
        const zoom = clampZoom(value);

        document.documentElement.style.setProperty("--ao3-paper-zoom", String(zoom));
        localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));

        const label = document.getElementById("ao3-paper-zoom-label");

        if (label) label.textContent = `${Math.round(zoom * 100)}%`;
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

    async function enableMode() {
        addStyle();

        const ok = await buildView();

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
        document.getElementById(VIEW_ID)?.remove();
    }

    function toggleMode() {
        if (document.body.classList.contains("ao3-arxiv-paper-mode")) disableMode();
        else enableMode();
    }

    function addFloatingToolbar() {
        if (document.getElementById(TOOLBAR_ID)) return;

        const toolbar = document.createElement("div");
        toolbar.id = TOOLBAR_ID;

        const out = document.createElement("button");
        out.textContent = "A−";
        out.title = "Zoom out";
        out.addEventListener("click", zoomOut);

        const label = document.createElement("span");
        label.id = "ao3-paper-zoom-label";

        const inn = document.createElement("button");
        inn.textContent = "A+";
        inn.title = "Zoom in";
        inn.addEventListener("click", zoomIn);

        const reset = document.createElement("button");
        reset.textContent = "Reset";
        reset.title = "Reset zoom";
        reset.addEventListener("click", resetZoom);

        const paper = document.createElement("button");
        paper.id = "ao3-arxiv-paper-toggle-button";
        paper.textContent = "Paper";
        paper.title = "Toggle paper mode";
        paper.addEventListener("click", toggleMode);

        toolbar.append(out, label, inn, reset, paper);
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

        if (localStorage.getItem(STORAGE_KEY) !== "0") enableMode();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
})();