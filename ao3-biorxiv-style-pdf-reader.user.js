// ==UserScript==
// @name         AO3 bioRxiv-style PDF Paper Reader
// @namespace    local.ao3.biorxiv-style.pdf.reader
// @version      1.0
// @description  Convert AO3 work pages into a local reading view styled after bioRxiv preprint PDFs (visual style reference only; not affiliated with or endorsed by bioRxiv): paginated single-column manuscript layout with a local reading-copy notice banner and continuous margin line numbers.
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

    // Separate ids/keys from the "website style" reader script, so both can
    // be installed in Tampermonkey at the same time without clashing. Only
    // run one of the two reading modes at once, though - toggle the other
    // off first if you have both scripts enabled.
    const STYLE_ID = "ao3-biorxiv-style-pdf-style";
    const VIEW_ID = "ao3-biorxiv-style-pdf-view";
    const TOOLBAR_ID = "ao3-biorxiv-style-pdf-toolbar";
    const BUTTON_ID = "ao3-biorxiv-style-pdf-toggle-button";
    const STORAGE_KEY = "ao3_biorxiv_style_pdf_reader_enabled";
    const ZOOM_STORAGE_KEY = "ao3_biorxiv_style_pdf_zoom";
    const MODE_CLASS = "ao3-biorxiv-style-pdf-mode";

    // Academic preprint PDFs (e.g. bioRxiv) typically use a fixed-height page, double-spaced
    // single-column sans-serif body text, and continuous line numbers down
    // the left margin. LINE_HEIGHT_PX is a fixed pixel step (not a
    // unitless multiplier) so the line-number gutter can be aligned to
    // each wrapped line by simple math.
    const FONT_SIZE_PX = 15;
    const LINE_HEIGHT_PX = 30;
    const LINES_PER_PAGE = 28;
    const PAGE_WIDTH_PX = 850;
    const PAGE_TOP_PAD = 96;
    const PAGE_SIDE_PAD = 76;
    const PAGE_BOTTOM_PAD = 60;
    const PAGE_CONTENT_HEIGHT_PX = LINE_HEIGHT_PX * LINES_PER_PAGE;

    const DEFAULT_ZOOM = 1.0;
    const MIN_ZOOM = 0.65;
    const MAX_ZOOM = 1.35;
    const ZOOM_STEP = 0.05;

    const SHOW_DEBUG = false;
    const SHOW_ABSTRACT = true;
    const SHOW_NOTES_AS_ABSTRACT = true;

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
        if (!el) return "";
        return normalizeText(el.textContent || "");
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

        const rating = getCleanText(document.querySelector("dd.rating")) || findDtValue(/^Rating/i);
        const fandom = getCleanText(document.querySelector("dd.fandom")) || findDtValue(/^Fandom/i);

        return { title, author, published, updated, workId, chapterId, rating, fandom };
    }

    function formatDateForStamp(dateStr) {
        if (!dateStr) return "an unknown date";

        const iso = dateStr.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
        if (iso) {
            const year = iso[1];
            const month = Number(iso[2]);
            const day = Number(iso[3]);

            const months = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];

            return `${months[month - 1] || ""} ${day}, ${year}`.trim();
        }

        return dateStr;
    }

    function buildBannerLines(meta) {
        const doiStub = meta.workId ? `local/ao3.${meta.workId}` : "local/ao3.unknown";
        const dateText = formatDateForStamp(meta.published || meta.updated);

        return [
            `AO3 reading copy doi: https://doi.org/${doiStub} (not a real DOI); this local reading copy was generated ${dateText}.`,
            "This work is fan fiction hosted on Archive of Our Own. It has not been reviewed or endorsed by any preprint server, journal, or publisher. All rights belong to the original author."
        ];
    }

    // Same hide list as the website-style reader: skip AO3's own chrome
    // (kudos, comments, share, chapter nav, site header/footer) as well as
    // the elements we rebuild ourselves (title/byline/summary).
    function shouldSkipElement(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

        const selector =
            ".summary, .meta, .preface, .landmark, .navigation, .actions, " +
            ".kudos, .share, .comment, #comments, .feedback, #header, #footer";

        if (el.matches(selector)) return true;
        if (el.closest(selector)) return true;

        return false;
    }

    function shouldSkipForAbstract(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

        const selector =
            ".meta, .landmark, .navigation, .actions, .kudos, .share, " +
            ".comment, #comments, .feedback, #header, #footer";

        if (el.matches(selector)) return true;
        if (el.closest(selector)) return true;

        return false;
    }

    function htmlToTextParts(el, options = {}) {
        if (!el) return [];

        const keepNotes = Boolean(options.keepNotes);
        const clone = el.cloneNode(true);

        const removeSelector = keepNotes
            ? "script, style, iframe, noscript, .summary, .meta, .preface, .landmark, #comments"
            : "script, style, iframe, noscript, .notes, .summary, .meta, .preface, .landmark, #comments";

        clone.querySelectorAll(removeSelector).forEach((node) => node.remove());

        let html = clone.innerHTML || "";

        html = html
            .replace(/<hr[^>]*>/gi, "\n[[AO3_HR]]\n")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n")
            .replace(/<\/div>/gi, "\n")
            .replace(/<\/blockquote>/gi, "\n")
            .replace(/<\/li>/gi, "\n")
            .replace(/<\/h[1-4]>/gi, "\n");

        const temp = document.createElement("div");
        temp.innerHTML = html;

        const text = temp.textContent || "";

        return text
            .split(/\n+/)
            .map((part) => normalizeText(part))
            .filter((part) => part.length > 0);
    }

    function extractAbstractParagraphs() {
        const summaryCandidates = [".summary .userstuff", ".summary blockquote", ".summary"];

        for (const selector of summaryCandidates) {
            const el = document.querySelector(selector);
            const parts = htmlToTextParts(el, { keepNotes: false }).filter((p) => p !== "[[AO3_HR]]");
            if (parts.join(" ").length > 40) return parts;
        }

        if (!SHOW_NOTES_AS_ABSTRACT) return [];

        const noteCandidates = [
            ".chapter.preface .notes .userstuff",
            ".preface .notes .userstuff",
            ".notes .userstuff"
        ];

        for (const selector of noteCandidates) {
            const el = document.querySelector(selector);
            if (!el || shouldSkipForAbstract(el)) continue;

            const parts = htmlToTextParts(el, { keepNotes: true }).filter((p) => p !== "[[AO3_HR]]");
            if (parts.join(" ").length > 40) return parts;
        }

        return [];
    }

    function addStyle() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;

        style.textContent = `
      body.${MODE_CLASS} {
        background: #e4e4e4 !important;
        color: #1a1a1a !important;
        font-family: Carlito, "Lato", "Segoe UI", "Helvetica Neue", Arial, sans-serif !important;
      }

      body.${MODE_CLASS} #header,
      body.${MODE_CLASS} #footer,
      body.${MODE_CLASS} #dashboard,
      body.${MODE_CLASS} .landmark,
      body.${MODE_CLASS} .navigation,
      body.${MODE_CLASS} .actions,
      body.${MODE_CLASS} .kudos,
      body.${MODE_CLASS} .share,
      body.${MODE_CLASS} .comment,
      body.${MODE_CLASS} #comments,
      body.${MODE_CLASS} .feedback {
        display: none !important;
      }

      body.${MODE_CLASS} #main {
        max-width: none !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: transparent !important;
      }

      body.${MODE_CLASS} #workskin,
      body.${MODE_CLASS} .preface,
      body.${MODE_CLASS} .meta {
        display: none !important;
      }

      #${VIEW_ID} {
        width: 100%;
        margin: 24px auto 60px auto;
        transform-origin: top center;
      }

      body.${MODE_CLASS} #${VIEW_ID} {
        zoom: var(--ao3-pdf-zoom, 1);
      }

      .ao3pdf-debug {
        max-width: ${PAGE_WIDTH_PX}px;
        margin: 0 auto 12px auto;
        padding: 8px 12px;
        background: #fff8dc;
        border: 1px solid #d0c27a;
        font-size: 13px;
        color: #333;
      }

      .ao3pdf-page {
        position: relative;
        width: min(96vw, ${PAGE_WIDTH_PX}px);
        height: ${PAGE_CONTENT_HEIGHT_PX + PAGE_TOP_PAD + PAGE_BOTTOM_PAD}px;
        margin: 0 auto 26px auto;
        padding: ${PAGE_TOP_PAD}px ${PAGE_SIDE_PAD}px ${PAGE_BOTTOM_PAD}px ${PAGE_SIDE_PAD}px;
        background: #ffffff;
        border: 1px solid #ccc;
        box-shadow: 0 1px 8px rgba(0, 0, 0, 0.12);
        box-sizing: border-box;
        overflow: hidden;
      }

      .ao3pdf-banner {
        position: absolute;
        top: 20px;
        left: 40px;
        right: 40px;
        text-align: center;
        font-size: 10.5px;
        line-height: 1.5;
        color: #333;
      }

      .ao3pdf-banner .ao3pdf-doi {
        color: #1155cc;
      }

      .ao3pdf-gutter {
        position: absolute;
        top: ${PAGE_TOP_PAD}px;
        left: 34px;
        width: 34px;
        height: ${PAGE_CONTENT_HEIGHT_PX}px;
      }

      .ao3pdf-lineno {
        position: absolute;
        left: 0;
        right: 0;
        height: ${LINE_HEIGHT_PX}px;
        line-height: ${LINE_HEIGHT_PX}px;
        text-align: left;
        font-size: ${FONT_SIZE_PX}px;
        color: #4d4d4d;
      }

      .ao3pdf-content {
        position: relative;
        height: ${PAGE_CONTENT_HEIGHT_PX}px;
        overflow: hidden;
        font-size: ${FONT_SIZE_PX}px;
        line-height: ${LINE_HEIGHT_PX}px;
        color: #1a1a1a;
        text-align: left;
      }

      .ao3pdf-content p {
        margin: 0 0 ${LINE_HEIGHT_PX}px 0;
        line-height: ${LINE_HEIGHT_PX}px;
      }

      .ao3pdf-content p:last-child {
        margin-bottom: 0;
      }

      .ao3pdf-content strong,
      .ao3pdf-content b {
        font-weight: 700;
      }

      .ao3pdf-content em,
      .ao3pdf-content i {
        font-style: italic;
      }

      .ao3pdf-content h1,
      .ao3pdf-content h2,
      .ao3pdf-content h3,
      .ao3pdf-content h4 {
        font-family: Carlito, "Lato", "Segoe UI", "Helvetica Neue", Arial, sans-serif !important;
        font-weight: 700;
        font-size: ${FONT_SIZE_PX}px;
        line-height: ${LINE_HEIGHT_PX}px;
        margin: ${LINE_HEIGHT_PX}px 0 ${LINE_HEIGHT_PX}px 0;
      }

      .ao3pdf-content hr {
        border: none;
        border-top: 1px solid #ccc;
        margin: ${LINE_HEIGHT_PX}px 0;
        height: 0;
      }

      .ao3pdf-label {
        font-weight: 700;
      }

      .ao3pdf-frontmatter p {
        margin: 0 0 ${LINE_HEIGHT_PX}px 0;
      }

      .ao3pdf-number {
        position: absolute;
        bottom: 18px;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 11px;
        color: #999;
      }

      .ao3pdf-chapternav {
        position: absolute;
        bottom: 46px;
        left: ${PAGE_SIDE_PAD}px;
        right: ${PAGE_SIDE_PAD}px;
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        border-top: 1px solid #e2e2e2;
        padding-top: 12px;
      }

      .ao3pdf-chapternav a {
        color: #1155cc;
        text-decoration: none;
        font-weight: 600;
      }

      .ao3pdf-chapternav a:hover {
        text-decoration: underline;
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
        font-family: Carlito, "Lato", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
      }

      #${TOOLBAR_ID} button {
        border: 1px solid #aaa;
        border-radius: 5px;
        background: #f8f8f8;
        color: #111;
        padding: 5px 8px;
        font-family: Carlito, "Lato", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        font-size: 13px;
        cursor: pointer;
      }

      #${TOOLBAR_ID} button:hover {
        background: #eeeeee;
      }

      #ao3pdf-zoom-label {
        min-width: 46px;
        text-align: center;
        font-family: Carlito, "Lato", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        font-size: 13px;
        color: #111;
      }

      @media (max-width: 950px) {
        .ao3pdf-gutter {
          display: none;
        }

        .ao3pdf-page {
          padding-left: 32px;
          padding-right: 32px;
        }
      }

      @media print {
        body.${MODE_CLASS} {
          background: #ffffff !important;
        }

        .ao3pdf-page {
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

    function makeHorizontalRule() {
        return document.createElement("hr");
    }

    function findChapterTextRoots() {
        const roots = [];

        const selectors = ["#chapters .userstuff", "#workskin .userstuff", ".chapter .userstuff", ".userstuff"];

        for (const selector of selectors) {
            const nodes = Array.from(document.querySelectorAll(selector)).filter((el) => {
                if (shouldSkipElement(el)) return false;
                return getCleanText(el).length > 120;
            });

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

        if (fallback && getCleanText(fallback).length > 200) return [fallback];

        return [];
    }

    function paragraphFromText(text) {
        const p = document.createElement("p");
        p.textContent = normalizeText(text);
        return p;
    }

    function headingFromText(text, level) {
        const tag = level || "h2";
        const h = document.createElement(tag);
        h.textContent = normalizeText(text);
        return h;
    }

    function collectBlocksFromParagraphs(root) {
        const blocks = [];
        const children = Array.from(root.childNodes);

        for (const node of children) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = normalizeText(node.textContent);
                if (text.length > 0) blocks.push(paragraphFromText(text));
                continue;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (shouldSkipElement(node)) continue;

            const tag = node.tagName.toLowerCase();

            if (["script", "style", "iframe", "noscript"].includes(tag)) continue;

            if (tag === "hr") {
                blocks.push(makeHorizontalRule());
                continue;
            }

            if (tag === "br") continue;

            if (tag === "p") {
                const parts = htmlToTextParts(node, { keepNotes: true });

                for (const part of parts) {
                    if (part === "[[AO3_HR]]") {
                        blocks.push(makeHorizontalRule());
                        continue;
                    }
                    if (part.length > 0) blocks.push(paragraphFromText(part));
                }

                continue;
            }

            if (["h1", "h2", "h3", "h4"].includes(tag)) {
                const text = getCleanText(node);
                if (text.length > 0) blocks.push(headingFromText(text, tag));
                continue;
            }

            const nested = collectBlocksFromParagraphs(node);
            for (const item of nested) blocks.push(item);
        }

        return blocks;
    }

    function collectBlocksFromBreakText(root) {
        const blocks = [];
        const parts = htmlToTextParts(root, { keepNotes: true });

        for (const part of parts) {
            const lower = part.toLowerCase();

            if (part === "[[AO3_HR]]") {
                blocks.push(makeHorizontalRule());
                continue;
            }

            if (lower === "notes") continue;
            if (lower === "chapter text") continue;
            if (lower === "end notes") continue;

            blocks.push(paragraphFromText(part));
        }

        return blocks;
    }

    function collectContentBlocks() {
        const roots = findChapterTextRoots();
        const allBlocks = [];

        for (const root of roots) {
            let blocks = collectBlocksFromParagraphs(root);
            if (blocks.length === 0) blocks = collectBlocksFromBreakText(root);

            for (const block of blocks) {
                const tag = block.tagName ? block.tagName.toLowerCase() : "";

                if (tag === "hr") {
                    allBlocks.push(block);
                    continue;
                }

                const text = getCleanText(block);
                const lower = text.toLowerCase();

                if (!text) continue;
                if (lower === "notes") continue;
                if (lower === "chapter text") continue;
                if (lower === "end notes") continue;

                allBlocks.push(block);
            }
        }

        return allBlocks;
    }

    function splitParagraphNode(p) {
        const text = getCleanText(p);
        const words = text.split(/\s+/);
        const chunks = [];
        const WORDS_PER_CHUNK = 70;

        for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
            chunks.push(paragraphFromText(words.slice(i, i + WORDS_PER_CHUNK).join(" ")));
        }

        return chunks;
    }

    function makeFrontMatter(meta) {
        const wrapper = document.createElement("div");
        wrapper.className = "ao3pdf-frontmatter";

        const titleP = document.createElement("p");
        titleP.innerHTML = `<span class="ao3pdf-label">Title:</span> ${escapeHtml(meta.title)}`;

        const authorP = document.createElement("p");
        authorP.innerHTML = `<span class="ao3pdf-label">Author:</span> ${escapeHtml(meta.author)}`;

        const dateBase = meta.published || meta.updated;
        const infoP = document.createElement("p");
        infoP.innerHTML =
            `<span class="ao3pdf-label">Work info:</span> AO3 work ${escapeHtml(meta.workId || "unknown")}` +
            ` &middot; posted ${escapeHtml(formatDateForStamp(dateBase))}` +
            (meta.rating ? ` &middot; ${escapeHtml(meta.rating)}` : "") +
            (meta.fandom ? ` &middot; ${escapeHtml(meta.fandom)}` : "");

        wrapper.appendChild(titleP);
        wrapper.appendChild(authorP);
        wrapper.appendChild(infoP);

        const blocks = [wrapper];

        if (SHOW_ABSTRACT) {
            const paragraphs = extractAbstractParagraphs();

            if (paragraphs.length > 0) {
                const abstractHeading = document.createElement("h2");
                abstractHeading.textContent = "Abstract";
                blocks.push(abstractHeading);

                paragraphs.forEach((text) => blocks.push(paragraphFromText(text)));
            }
        }

        return blocks;
    }

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = String(text || "");
        return div.innerHTML;
    }

    function createPage(pageIndex, meta) {
        const page = document.createElement("div");
        page.className = "ao3pdf-page";

        const banner = document.createElement("div");
        banner.className = "ao3pdf-banner";
        const [line1, line2] = buildBannerLines(meta);
        banner.innerHTML = `<span class="ao3pdf-doi">${escapeHtml(line1)}</span><br>${escapeHtml(line2)}`;
        page.appendChild(banner);

        const gutter = document.createElement("div");
        gutter.className = "ao3pdf-gutter";
        page.appendChild(gutter);

        const content = document.createElement("div");
        content.className = "ao3pdf-content";
        page.appendChild(content);

        const number = document.createElement("div");
        number.className = "ao3pdf-number";
        number.textContent = String(pageIndex);
        page.appendChild(number);

        return { page, content, gutter };
    }

    function contentOverflow(content) {
        return content.scrollHeight > content.clientHeight + 4;
    }

    // Walks each finished page's content and fills the left-margin gutter
    // with continuously-numbered line labels, one per rendered wrapped
    // line (measured from each block's real offsetHeight), matching real
    // academic preprint manuscript formatting.
    function numberPages(pages) {
        let counter = 1;

        pages.forEach(({ content, gutter }) => {
            Array.from(content.children).forEach((block) => {
                if (block.tagName && block.tagName.toLowerCase() === "hr") return;

                const lineCount = Math.max(1, Math.round(block.offsetHeight / LINE_HEIGHT_PX));

                for (let i = 0; i < lineCount; i++) {
                    const label = document.createElement("div");
                    label.className = "ao3pdf-lineno";
                    label.style.top = `${block.offsetTop + i * LINE_HEIGHT_PX}px`;
                    label.textContent = String(counter);
                    gutter.appendChild(label);
                    counter += 1;
                }
            });
        });
    }

    function buildPages(frontMatterBlocks, bodyBlocks, meta, view) {
        const pages = [];
        let pageIndex = 1;
        let current = createPage(pageIndex, meta);
        pages.push(current);
        view.appendChild(current.page);

        function newPage() {
            pageIndex += 1;
            current = createPage(pageIndex, meta);
            pages.push(current);
            view.appendChild(current.page);
        }

        const allBlocks = [...frontMatterBlocks, ...bodyBlocks];

        for (const block of allBlocks) {
            current.content.appendChild(block);

            if (!contentOverflow(current.content)) continue;

            current.content.removeChild(block);

            const tag = block.tagName ? block.tagName.toLowerCase() : "";
            const wordCount = getCleanText(block).split(/\s+/).length;
            const isLongParagraph = tag === "p" && wordCount > 80 && !block.querySelector(".ao3pdf-label");

            if (isLongParagraph) {
                const chunks = splitParagraphNode(block);

                for (const chunk of chunks) {
                    current.content.appendChild(chunk);

                    if (contentOverflow(current.content)) {
                        current.content.removeChild(chunk);
                        newPage();
                        current.content.appendChild(chunk);
                    }
                }
            } else {
                newPage();
                current.content.appendChild(block);
            }
        }

        numberPages(pages);

        return pages;
    }

    // Reads (does not move) AO3's own previous/next chapter link hrefs and
    // rebuilds them as plain anchors, so this stays a simple, safe read of
    // real navigation rather than moving live nodes around.
    // AO3 doesn't always render literal "Previous Chapter" / "Next Chapter"
    // link text (the wording, icons, or markup can vary), so this tries a
    // few strategies in order: loose text match on any anchor, then rel
    // attributes, then falling back to the chapter <select> dropdown (which
    // the sidebar version already relies on) by reading the option before
    // and after the currently selected one.
    function resolveChapterHref(value, workId) {
        if (!value) return null;

        if (/^https?:\/\//i.test(value)) return value;
        if (value.startsWith("/")) return `${location.origin}${value}`;
        if (/^\d+$/.test(value) && workId) {
            return `${location.origin}/works/${workId}/chapters/${value}`;
        }

        return null;
    }

    function findChapterHrefs(meta) {
        const anchors = Array.from(document.querySelectorAll("#main a[href]"));

        let prevHref =
            (anchors.find((a) => /previous\s*chapter/i.test(getCleanText(a))) || {}).href ||
            (anchors.find((a) => a.getAttribute("rel") === "prev") || {}).href ||
            null;

        let nextHref =
            (anchors.find((a) => /next\s*chapter/i.test(getCleanText(a))) || {}).href ||
            (anchors.find((a) => a.getAttribute("rel") === "next") || {}).href ||
            null;

        if (prevHref && nextHref) return { prevHref, nextHref };

        const select =
            document.querySelector("#main select#selected_id") ||
            document.querySelector('#main select[id*="chapter" i]') ||
            document.querySelector('#main select[name*="chapter" i]');

        if (select) {
            const options = Array.from(select.options);
            const selectedIndex = options.findIndex((o) => o.selected);

            if (selectedIndex > -1) {
                if (!prevHref && selectedIndex > 0) {
                    prevHref = resolveChapterHref(options[selectedIndex - 1].value, meta.workId);
                }
                if (!nextHref && selectedIndex < options.length - 1) {
                    nextHref = resolveChapterHref(options[selectedIndex + 1].value, meta.workId);
                }
            }
        }

        return { prevHref, nextHref };
    }

    function makeChapterNav(meta) {
        const { prevHref, nextHref } = findChapterHrefs(meta);

        if (!prevHref && !nextHref) return null;

        const nav = document.createElement("div");
        nav.className = "ao3pdf-chapternav";

        const left = document.createElement("div");
        if (prevHref) {
            const a = document.createElement("a");
            a.href = prevHref;
            a.textContent = "← Previous Chapter";
            left.appendChild(a);
        }

        const right = document.createElement("div");
        if (nextHref) {
            const a = document.createElement("a");
            a.href = nextHref;
            a.textContent = "Next Chapter →";
            right.appendChild(a);
        }

        nav.appendChild(left);
        nav.appendChild(right);

        return nav;
    }

    function buildView() {
        const oldView = document.getElementById(VIEW_ID);
        if (oldView) oldView.remove();

        const meta = getAO3Meta();
        const bodyBlocks = collectContentBlocks();

        if (bodyBlocks.length === 0) {
            alert("没有提取到正文。请确认页面已经完整加载，或关闭其他 AO3 样式脚本后再刷新。");
            return false;
        }

        const view = document.createElement("div");
        view.id = VIEW_ID;

        if (SHOW_DEBUG) {
            const debug = document.createElement("div");
            debug.className = "ao3pdf-debug";
            debug.textContent = `pdf mode loaded, blocks ${bodyBlocks.length}`;
            view.appendChild(debug);
        }

        // Attach the (still empty) view to the live document BEFORE
        // building pages. contentOverflow() below reads scrollHeight /
        // clientHeight to decide when a page is full, and both are stuck
        // at 0 for elements that aren't actually in the rendered document
        // yet - building pages first and attaching afterward meant every
        // page silently measured as "not full", so everything piled into
        // page 1 and the rest was clipped off by overflow:hidden.
        const mainRoot = document.querySelector("#main") || document.body;
        mainRoot.appendChild(view);

        const frontMatterBlocks = makeFrontMatter(meta);
        const pages = buildPages(frontMatterBlocks, bodyBlocks, meta, view);

        const chapterNav = makeChapterNav(meta);
        if (chapterNav && pages.length > 0) {
            const lastPage = pages[pages.length - 1].page;
            // Grow just this page's fixed height to make room for the nav
            // row instead of risking it overlapping the page number.
            const currentHeight = parseInt(lastPage.style.height || getComputedStyle(lastPage).height, 10) || 0;
            lastPage.style.height = `${currentHeight + 50}px`;
            lastPage.appendChild(chapterNav);
        }

        return true;
    }

    function clampZoom(value) {
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    }

    function getSavedZoom() {
        const raw = localStorage.getItem(ZOOM_STORAGE_KEY);
        const value = Number(raw);
        if (!Number.isFinite(value)) return DEFAULT_ZOOM;
        return clampZoom(value);
    }

    function setPaperZoom(value) {
        const zoom = clampZoom(value);
        document.documentElement.style.setProperty("--ao3-pdf-zoom", String(zoom));
        localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));

        const label = document.getElementById("ao3pdf-zoom-label");
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

    function enableMode() {
        addStyle();
        const ok = buildView();

        if (!ok) {
            document.body.classList.remove(MODE_CLASS);
            localStorage.setItem(STORAGE_KEY, "0");
            return;
        }

        document.body.classList.add(MODE_CLASS);
        localStorage.setItem(STORAGE_KEY, "1");
        setPaperZoom(getSavedZoom());
    }

    function disableMode() {
        document.body.classList.remove(MODE_CLASS);
        localStorage.setItem(STORAGE_KEY, "0");

        const view = document.getElementById(VIEW_ID);
        if (view) view.remove();
    }

    function toggleMode() {
        if (document.body.classList.contains(MODE_CLASS)) {
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
        zoomLabel.id = "ao3pdf-zoom-label";

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
        paperBtn.textContent = "PDF";
        paperBtn.title = "Toggle PDF-style paper mode";
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
        if (event.altKey && event.code === "KeyO") {
            event.preventDefault();
            toggleMode();
        }

        if (event.altKey && event.code === "BracketRight") {
            event.preventDefault();
            zoomIn();
        }

        if (event.altKey && event.code === "BracketLeft") {
            event.preventDefault();
            zoomOut();
        }
    });

    function boot() {
        addStyle();
        addFloatingToolbar();

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== "0") enableMode();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
