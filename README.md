# AO3 Paper Reader Userscripts

两个 Tampermonkey 用户脚本，把 AO3 作品页面转换成本地的学术论文式阅读视图。

Two Tampermonkey userscripts that turn AO3 work pages into local academic-paper-style reading views.

| 文件 File                              | 风格 Style        |
| -------------------------------------- | ----------------- |
| `ao3toarxiv.js`                        | arXiv             |
| `ao3-biorxiv-style-pdf-reader.user.js` | bioRxiv-style PDF |

---

# 中文版

## AI 使用说明

本项目的代码和文档是在 ChatGPT 和 Claude 的协助下编写的。

## 概述

两个脚本都只在你自己的浏览器里改变显示效果，不会下载、转载、修改 AO3 内容，也不会发送任何网络请求。

- `ao3toarxiv.js`：arXiv 风格，双栏正文、Index Terms 区、页眉页码、每页左侧日期标记
- `ao3-biorxiv-style-pdf-reader.user.js`：bioRxiv PDF 风格，单栏双倍行距、预印本声明横幅、左侧连续行号、上一章/下一章链接

## 安装方法（两个脚本通用）

先安装用户脚本管理器，推荐使用 Tampermonkey。

1. 打开 Tampermonkey
2. 新建脚本
3. 删除默认模板
4. 粘贴你想用的那个脚本的完整内容（`ao3toarxiv.js` 或 `ao3-biorxiv-style-pdf-reader.user.js`）
5. 保存脚本
6. 打开 AO3 作品页面
7. 点击右下角的工具按钮

在 macOS 上，Option 键就是 Alt 键。

## 隐私说明（两个脚本通用）

脚本只在你的浏览器中运行，不会把任何数据发送到外部服务器，不会记录阅读行为，不会把 AO3 内容保存到页面外部，不会修改 AO3 服务器上的内容，不会转载、导出或复制作品。脚本只在 localStorage 中保存本地界面状态（阅读模式是否开启、当前缩放比例）。

## 项目边界与法律声明（两个脚本通用）

本项目只是本地视觉阅读工具，不隶属于 AO3、Organization for Transformative Works、arXiv、bioRxiv 或任何出版机构。arXiv / bioRxiv 风格只作为本地阅读的视觉参考。

AO3 作品属于各自作者。这个脚本不授予复制、转载、再分发或训练任何作品的权限。用户需要自行遵守 AO3 服务条款和作者声明的授权范围。

## AO3 arXiv Paper Reader (`ao3toarxiv.js`)

### 概述

AO3 arXiv Paper Reader 是一个 Tampermonkey 用户脚本。它可以把 AO3 作品页面转换成本地论文阅读视图。

脚本会在浏览器本地生成类似论文 PDF 的页面，包括首页标题、作者行、摘要区、双栏正文、分页、页眉、页码、每页左侧日期标记和缩放工具条。

### 主要功能

- 本地浏览器渲染
- 支持 AO3 work 和 chapter 页面
- 首页论文式标题区
- 作者行
- 摘要区
- Index Terms 区
- 双栏正文
- 分页式阅读
- 顶部页眉
- 底部页码
- 每页左侧日期标记
- 右下角缩放工具条
- 支持放大、缩小和重置
- 支持 macOS 快捷键
- 更稳定的段落提取
- 保留作者 note 和正文之间的分割线

### 推荐文件名

```text
ao3-arxiv-paper-reader.user.js
```

`.user.js` 后缀有助于用户脚本管理器识别脚本。

### 使用方法

打开 AO3 作品页面后，页面右下角会出现工具条。

工具条按钮说明如下。

| 按钮   | 作用               |
| ------ | ------------------ |
| A−     | 缩小页面           |
| 百分比 | 显示当前缩放比例   |
| A+     | 放大页面           |
| Reset  | 重置缩放           |
| Paper  | 打开或关闭论文模式 |

快捷键如下。

| 快捷键          | 作用               |
| --------------- | ------------------ |
| Option 加 P     | 打开或关闭论文模式 |
| Option 加 Equal | 放大页面           |
| Option 加 Minus | 缩小页面           |
| Option 加 0     | 重置缩放           |

在 macOS 上，Option 键就是 Alt 键。

### 推荐参数

脚本顶部有一组排版参数。

```javascript
const FONT_SIZE_PX = 16;
const LINE_HEIGHT = 1.25;
const LINES_PER_COLUMN = 40;
const PAGE_WIDTH_PX = 1120;
const COLUMN_GAP_PX = 38;
```

这些参数的含义如下。

| 参数             | 含义           |
| ---------------- | -------------- |
| FONT_SIZE_PX     | 正文字号       |
| LINE_HEIGHT      | 行间距         |
| LINES_PER_COLUMN | 每栏大约行数   |
| PAGE_WIDTH_PX    | 页面宽度       |
| COLUMN_GAP_PX    | 两栏之间的距离 |

### 缩放说明

缩放只改变视觉大小，不改变分页逻辑。

如果想让每页显示更多或更少内容，需要调整下面这些参数。

```javascript
const FONT_SIZE_PX = 16;
const LINE_HEIGHT = 1.25;
const LINES_PER_COLUMN = 40;
```

缩放状态会保存在浏览器 localStorage 中。刷新页面后会保留上次缩放比例。

### 分页说明

脚本不是 PDF 渲染器。它通过浏览器布局结果估计每页能放多少内容。

长段落会被切成较小文本块，方便跨页显示。

不同浏览器、缩放比例、字体设置和 AO3 work skin 都可能影响分页结果。

### 日期标记说明

脚本会尝试读取 AO3 页面中的 Published 或 Updated 字段。

默认左侧日期标记使用 Published。如果没有读取到 Published，会尝试使用 Updated。

每一页都会显示左侧日期标记和 work id。

如果日期显示为 Unknown Date，说明当前 AO3 页面使用了脚本尚未识别的日期格式。正文阅读功能不受影响。

### 摘要区说明

脚本会优先读取 AO3 summary 作为 Abstract。

如果没有 summary，脚本会读取作者 note 作为 Abstract。

当前版本会保留作者 note 和正文之间的分割线，使首页更接近 0.7 版的排版效果。

### 已知限制

- 部分 AO3 作品使用特殊 work skin，可能影响正文提取
- 很复杂的 HTML 结构可能需要调整选择器
- 分页是浏览器估计结果，不会完全等同于正式 PDF
- 缩放不会重新计算分页
- 摘要区可能过长，需要用户根据作品情况调整
- 日期解析可能无法覆盖所有 AO3 日期格式

### 常见问题

#### Paper 按钮没有出现

请检查 Tampermonkey 中脚本是否已经启用，然后刷新 AO3 页面。

#### 只显示 note，没有显示正文

请先关闭其他 AO3 样式脚本，然后刷新页面。

某些作品的 work skin 结构比较特殊，需要针对页面结构调整选择器。

#### 正文句子粘在一起

当前版本已经加入基础修复，会在英文句号、问号、感叹号后补空格。

如果作品原文 HTML 本身没有清楚的段落边界，仍可能出现少量粘连。

#### 页面里有奇怪的大空隙

这通常和分页估计或长段落切分有关。

可以尝试减小 `LINES_PER_COLUMN`，或调小 `FONT_SIZE_PX`。

#### macOS 快捷键没有反应

先点击网页正文区域，再按快捷键。

也可以直接使用右下角工具条。

## AO3 bioRxiv-style PDF Paper Reader (`ao3-biorxiv-style-pdf-reader.user.js`)

### 风格外观

分页显示，每页顶部有仿 bioRxiv 预印本声明横幅（注明这是本地阅读副本、非官方 DOI），正文双倍行距、无衬线字体（Carlito / Lato / Segoe UI 等系统字体，取决于你电脑上装了哪个），左侧 margin 有连续行号，最后一页底部有上一章 / 下一章链接。

### 使用方法

| 按钮   | 快捷键     | 作用                    |
| ------ | ---------- | ----------------------- |
| A−     | Option + [ | 缩小页面                |
| 百分比 | —          | 显示当前缩放比例        |
| A+     | Option + ] | 放大页面                |
| Reset  | —          | 重置缩放                |
| PDF    | Option + O | 打开或关闭 PDF 阅读模式 |

### 已知限制

- 部分 AO3 作品使用特殊 work skin，可能影响正文提取
- bioRxiv 并不强制要求任何字体，脚本字体只是尽量贴近参考样本，不保证完全一致，取决于电脑预装字体
- 上一章 / 下一章链接依赖文字匹配或章节下拉框，AO3 改版可能会失效
- 分页 / 行号是浏览器估算结果，不是真正的 PDF 排版引擎
- Kudos 和评论是 AO3 自己的 AJAX 交互，脚本不会在页面内伪造这些操作

---

# English

## AI assistance disclosure

This project's code and documentation were written with the assistance of ChatGPT and Claude.

## Overview

Both scripts only change what you see in your own browser — neither downloads, reposts, modifies AO3 content, nor makes any network requests.

- `ao3toarxiv.js`: arXiv style, two-column body, Index Terms area, running header, page numbers, side date stamp
- `ao3-biorxiv-style-pdf-reader.user.js`: bioRxiv PDF style, single-column double-spaced, preprint notice banner, continuous line numbers, previous/next chapter links

## Installation (same for both scripts)

Install a userscript manager first. Tampermonkey is recommended.

1. Open Tampermonkey
2. Create a new script
3. Delete the default template
4. Paste the full contents of whichever script you want (`ao3toarxiv.js` or `ao3-biorxiv-style-pdf-reader.user.js`)
5. Save the script
6. Open an AO3 work page
7. Click the toolbar button in the bottom-right corner

On macOS, Option is the Alt key.

## Privacy (same for both scripts)

The script runs only in your browser. It does not send data to external servers, does not track reading behavior, does not save AO3 content outside the page, does not modify AO3 server content, and does not repost, export, or copy works. It only stores local UI state in localStorage (whether reading mode is on, and the current zoom level).

## Project scope and legal notice (same for both scripts)

This project is only a local visual reading tool. It is not affiliated with AO3, the Organization for Transformative Works, arXiv, bioRxiv, or any publisher. The arXiv/bioRxiv-like styles are only a visual reference for local reading.

AO3 works belong to their respective authors. This script does not give permission to copy, repost, redistribute, or train on any work. Users are responsible for following AO3 terms of service and each author's stated permissions.

## AO3 arXiv Paper Reader (`ao3toarxiv.js`)

### Overview

AO3 arXiv Paper Reader is a Tampermonkey userscript that turns AO3 work pages into a local paper style reading view.

It creates a paper like page view in your browser, with a title block, author line, abstract area, two column text, page breaks, running header, page numbers, side date stamp on every page, and zoom controls.

### Features

- Local browser rendering
- AO3 work and chapter page support
- Paper style first page
- Author line
- Abstract area
- Index Terms area
- Two column body text
- Page based reading
- Running header
- Page numbers
- Side date stamp on every page
- Floating zoom toolbar
- Zoom in, zoom out, and reset
- macOS friendly keyboard shortcuts
- Improved paragraph extraction
- Separator line between author notes and chapter text

### Recommended script file name

```text
ao3-arxiv-paper-reader.user.js
```

The `.user.js` suffix helps userscript managers detect the script.

### Usage

After opening an AO3 work page, a toolbar appears in the bottom right corner.

| Button        | Action            |
| ------------- | ----------------- |
| A−            | Zoom out          |
| Percent label | Show current zoom |
| A+            | Zoom in           |
| Reset         | Reset zoom        |
| Paper         | Toggle paper mode |

Keyboard shortcuts.

| Shortcut          | Action            |
| ----------------- | ----------------- |
| Option plus P     | Toggle paper mode |
| Option plus Equal | Zoom in           |
| Option plus Minus | Zoom out          |
| Option plus 0     | Reset zoom        |

On macOS, Option is the Alt key.

### Configuration

The main layout settings are near the top of the script.

```javascript
const FONT_SIZE_PX = 16;
const LINE_HEIGHT = 1.25;
const LINES_PER_COLUMN = 40;
const PAGE_WIDTH_PX = 1120;
const COLUMN_GAP_PX = 38;
```

| Setting          | Meaning                               |
| ---------------- | ------------------------------------- |
| FONT_SIZE_PX     | Body font size                        |
| LINE_HEIGHT      | Line spacing                          |
| LINES_PER_COLUMN | Approximate line count in each column |
| PAGE_WIDTH_PX    | Paper page width                      |
| COLUMN_GAP_PX    | Gap between the two columns           |

### Zoom behavior

Zoom changes visual size only. It does not recalculate page breaks.

To change how much text fits on each page, edit these settings.

```javascript
const FONT_SIZE_PX = 16;
const LINE_HEIGHT = 1.25;
const LINES_PER_COLUMN = 40;
```

Zoom state is saved in browser localStorage.

### Pagination behavior

This script is not a PDF renderer. It estimates page breaks using browser layout measurements.

Long paragraphs may be split into smaller text chunks so text can continue across pages.

Browser, zoom level, font rendering, and AO3 work skin can all affect the page result.

### Date stamp

The script tries to read Published or Updated from the AO3 page.

The side date stamp prefers Published. If Published is unavailable, it tries Updated.

Each page shows the side date stamp and work id.

If the stamp shows Unknown Date, the AO3 page may use a date format not yet covered by the script. Reading still works.

### Abstract area

The script tries to use AO3 summary as Abstract.

If summary is missing, it uses author notes as Abstract.

The current version keeps the separator line between author notes and chapter text, matching the 0.7 style more closely.

### Limitations

- Some AO3 works use custom work skins that may affect text extraction
- Complex HTML structures may need selector changes
- Page breaks are browser estimates, not real PDF layout
- Zoom does not recalculate page breaks
- Abstract text may be long for some works
- Date parsing may not cover every AO3 date format

### Troubleshooting

#### Paper button does not appear

Check whether the script is enabled in Tampermonkey, then refresh the AO3 page.

#### Only notes appear, but chapter text is missing

Disable other AO3 style scripts, then refresh the page.

Some custom work skins may need selector changes.

#### Sentences are glued together

The current version includes a basic fix that inserts spacing after English sentence punctuation.

If the original HTML has weak paragraph boundaries, a few glued sentences may remain.

#### The page has large blank areas

This is usually caused by page estimation or long paragraph splitting.

Try reducing `LINES_PER_COLUMN`, or reducing `FONT_SIZE_PX`.

#### macOS shortcuts do not work

Click the page body first, then press the shortcut.

The floating toolbar is the safer control method.

## AO3 bioRxiv-style PDF Paper Reader (`ao3-biorxiv-style-pdf-reader.user.js`)

### What it looks like

Paginated, with a preprint-notice banner at the top of every page (clearly marked as a local reading copy with a fake DOI, not an official one), double-spaced sans-serif body text (Carlito / Lato / Segoe UI or whatever's installed on your system), continuous line numbers down the left margin, and previous/next chapter links at the bottom of the last page.

### Usage

| Button        | Shortcut   | Action                  |
| ------------- | ---------- | ----------------------- |
| A−            | Option + [ | Zoom out                |
| Percent label | —          | Show current zoom       |
| A+            | Option + ] | Zoom in                 |
| Reset         | —          | Reset zoom              |
| PDF           | Option + O | Toggle PDF reading mode |

### Known limitations

- Some AO3 works use custom work skins that may affect text extraction
- bioRxiv doesn't mandate a specific font; the font here is a best-effort visual match, not guaranteed, and depends on which fonts you have installed
- Previous/next chapter detection relies on link text matching or the chapter dropdown; it may stop working if AO3 changes its markup
- Pagination and line numbers are browser-estimated, not a real PDF layout engine
- Kudos and comments are AO3's own AJAX-driven interactions — the script doesn't try to fake those in place
