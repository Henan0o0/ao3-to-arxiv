# AO3 arXiv Paper Reader

## 中文说明

AO3 arXiv Paper Reader 是一个 Tampermonkey 用户脚本。它可以把 AO3 作品页面转换成本地论文阅读视图。

脚本会在浏览器本地生成类似论文 PDF 的页面，包括首页标题、作者行、摘要区、双栏正文、分页、页眉、页码、每页左侧日期标记和缩放工具条。

脚本只改变你自己浏览器里的显示效果。它不会下载作品，不会转载作品，不会修改 AO3 服务器上的内容，也不会收集账号数据。

## 主要功能

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

## 安装方法

先安装用户脚本管理器。

推荐使用 Tampermonkey。

安装步骤如下。

1. 打开 Tampermonkey
2. 新建脚本
3. 删除默认模板
4. 粘贴完整脚本
5. 保存脚本
6. 打开 AO3 作品页面
7. 点击右下角 Paper 按钮

## 使用方法

打开 AO3 作品页面后，页面右下角会出现工具条。

工具条按钮说明如下。

| 按钮 | 作用 |
| --- | --- |
| A− | 缩小页面 |
| 百分比 | 显示当前缩放比例 |
| A+ | 放大页面 |
| Reset | 重置缩放 |
| Paper | 打开或关闭论文模式 |

快捷键如下。

| 快捷键 | 作用 |
| --- | --- |
| Option 加 P | 打开或关闭论文模式 |
| Option 加 Equal | 放大页面 |
| Option 加 Minus | 缩小页面 |
| Option 加 0 | 重置缩放 |

在 macOS 上，Option 键就是 Alt 键。

## 推荐参数

脚本顶部有一组排版参数。

```javascript
const FONT_SIZE_PX = 16;
const LINE_HEIGHT = 1.25;
const LINES_PER_COLUMN = 40;
const PAGE_WIDTH_PX = 1120;
const COLUMN_GAP_PX = 38;
```

这些参数的含义如下。

| 参数 | 含义 |
| --- | --- |
| FONT_SIZE_PX | 正文字号 |
| LINE_HEIGHT | 行间距 |
| LINES_PER_COLUMN | 每栏大约行数 |
| PAGE_WIDTH_PX | 页面宽度 |
| COLUMN_GAP_PX | 两栏之间的距离 |


## 缩放说明

缩放只改变视觉大小，不改变分页逻辑。

如果想让每页显示更多或更少内容，需要调整下面这些参数。

```javascript
const FONT_SIZE_PX = 16;
const LINE_HEIGHT = 1.25;
const LINES_PER_COLUMN = 40;
```

缩放状态会保存在浏览器 localStorage 中。刷新页面后会保留上次缩放比例。

## 分页说明

脚本不是 PDF 渲染器。它通过浏览器布局结果估计每页能放多少内容。

长段落会被切成较小文本块，方便跨页显示。

不同浏览器、缩放比例、字体设置和 AO3 work skin 都可能影响分页结果。

## 日期标记说明

脚本会尝试读取 AO3 页面中的 Published 或 Updated 字段。

默认左侧日期标记使用 Published。如果没有读取到 Published，会尝试使用 Updated。

每一页都会显示左侧日期标记和 work id。

如果日期显示为 Unknown Date，说明当前 AO3 页面使用了脚本尚未识别的日期格式。正文阅读功能不受影响。

## 摘要区说明

脚本会优先读取 AO3 summary 作为 Abstract。

如果没有 summary，脚本会读取作者 note 作为 Abstract。

当前版本会保留作者 note 和正文之间的分割线，使首页更接近 0.7 版的排版效果。

## 已知限制

- 部分 AO3 作品使用特殊 work skin，可能影响正文提取
- 很复杂的 HTML 结构可能需要调整选择器
- 分页是浏览器估计结果，不会完全等同于正式 PDF
- 缩放不会重新计算分页
- 摘要区可能过长，需要用户根据作品情况调整
- 日期解析可能无法覆盖所有 AO3 日期格式

## 常见问题

### Paper 按钮没有出现

请检查 Tampermonkey 中脚本是否已经启用，然后刷新 AO3 页面。

### 只显示 note，没有显示正文

请先关闭其他 AO3 样式脚本，然后刷新页面。

某些作品的 work skin 结构比较特殊，需要针对页面结构调整选择器。

### 正文句子粘在一起

当前版本已经加入基础修复，会在英文句号、问号、感叹号后补空格。

如果作品原文 HTML 本身没有清楚的段落边界，仍可能出现少量粘连。

### 页面里有奇怪的大空隙

这通常和分页估计或长段落切分有关。

可以尝试减小 `LINES_PER_COLUMN`，或调小 `FONT_SIZE_PX`。

### macOS 快捷键没有反应

先点击网页正文区域，再按快捷键。

也可以直接使用右下角工具条。

## 隐私说明

脚本只在你的浏览器中运行。

它不会把任何数据发送到外部服务器。

它不会记录阅读行为。

它不会把 AO3 内容保存到页面外部。

它不会修改 AO3 服务器上的内容。

它不会转载、导出或复制作品。

脚本只在 localStorage 中保存下面两项本地界面状态。

- 论文模式是否开启
- 缩放比例

## 项目边界

本项目只是本地视觉阅读工具。

它不隶属于 AO3、Organization for Transformative Works、arXiv 或任何出版机构。

arXiv 风格只作为本地阅读的视觉参考。

## 法律和内容说明

AO3 作品属于各自作者。

这个脚本不授予复制、转载、再分发或训练任何作品的权限。

用户需要自行遵守 AO3 服务条款和作者声明的授权范围。

## English guide

## Overview

AO3 arXiv Paper Reader is a Tampermonkey userscript that turns AO3 work pages into a local paper style reading view.

It creates a paper like page view in your browser, with a title block, author line, abstract area, two column text, page breaks, running header, page numbers, side date stamp on every page, and zoom controls.

The script only changes local page display in your own browser. It does not download, repost, modify, or collect AO3 content.

## Features

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

## Installation

Install a userscript manager first.

Tampermonkey is recommended.

Steps.

1. Open Tampermonkey
2. Create a new script
3. Delete the default template
4. Paste the full script
5. Save the script
6. Open an AO3 work page
7. Click the Paper button in the bottom right corner

Recommended script file name.

```text
ao3-arxiv-paper-reader.user.js
```

The `.user.js` suffix helps userscript managers detect the script.

## Usage

After opening an AO3 work page, a toolbar appears in the bottom right corner.

| Button | Action |
| --- | --- |
| A− | Zoom out |
| Percent label | Show current zoom |
| A+ | Zoom in |
| Reset | Reset zoom |
| Paper | Toggle paper mode |

Keyboard shortcuts.

| Shortcut | Action |
| --- | --- |
| Option plus P | Toggle paper mode |
| Option plus Equal | Zoom in |
| Option plus Minus | Zoom out |
| Option plus 0 | Reset zoom |

On macOS, Option is the Alt key.

## Configuration

The main layout settings are near the top of the script.

```javascript
const FONT_SIZE_PX = 16;
const LINE_HEIGHT = 1.25;
const LINES_PER_COLUMN = 40;
const PAGE_WIDTH_PX = 1120;
const COLUMN_GAP_PX = 38;
```

| Setting | Meaning |
| --- | --- |
| FONT_SIZE_PX | Body font size |
| LINE_HEIGHT | Line spacing |
| LINES_PER_COLUMN | Approximate line count in each column |
| PAGE_WIDTH_PX | Paper page width |
| COLUMN_GAP_PX | Gap between the two columns |


## Zoom behavior

Zoom changes visual size only. It does not recalculate page breaks.

To change how much text fits on each page, edit these settings.

```javascript
const FONT_SIZE_PX = 16;
const LINE_HEIGHT = 1.25;
const LINES_PER_COLUMN = 40;
```

Zoom state is saved in browser localStorage.

## Pagination behavior

This script is not a PDF renderer. It estimates page breaks using browser layout measurements.

Long paragraphs may be split into smaller text chunks so text can continue across pages.

Browser, zoom level, font rendering, and AO3 work skin can all affect the page result.

## Date stamp

The script tries to read Published or Updated from the AO3 page.

The side date stamp prefers Published. If Published is unavailable, it tries Updated.

Each page shows the side date stamp and work id.

If the stamp shows Unknown Date, the AO3 page may use a date format not yet covered by the script. Reading still works.

## Abstract area

The script tries to use AO3 summary as Abstract.

If summary is missing, it uses author notes as Abstract.

The current version keeps the separator line between author notes and chapter text, matching the 0.7 style more closely.

## Limitations

- Some AO3 works use custom work skins that may affect text extraction
- Complex HTML structures may need selector changes
- Page breaks are browser estimates, not real PDF layout
- Zoom does not recalculate page breaks
- Abstract text may be long for some works
- Date parsing may not cover every AO3 date format

## Troubleshooting

### Paper button does not appear

Check whether the script is enabled in Tampermonkey, then refresh the AO3 page.

### Only notes appear, but chapter text is missing

Disable other AO3 style scripts, then refresh the page.

Some custom work skins may need selector changes.

### Sentences are glued together

The current version includes a basic fix that inserts spacing after English sentence punctuation.

If the original HTML has weak paragraph boundaries, a few glued sentences may remain.

### The page has large blank areas

This is usually caused by page estimation or long paragraph splitting.

Try reducing `LINES_PER_COLUMN`, or reducing `FONT_SIZE_PX`.

### macOS shortcuts do not work

Click the page body first, then press the shortcut.

The floating toolbar is the safer control method.

## Privacy

The script runs only in your browser.

It does not send data to external servers.

It does not track reading behavior.

It does not save AO3 content outside the page.

It does not modify AO3 server content.

It does not repost, export, or copy works.

It only stores local interface state in localStorage.

- Paper mode on or off
- Zoom level

## Project scope

This project is only a local visual reading tool.

It is not affiliated with AO3, the Organization for Transformative Works, arXiv, or any publisher.

The arXiv like style is only a visual reference for local reading.

## Legal and content notice

AO3 works belong to their respective authors.

This script does not give permission to copy, repost, redistribute, or train on any work.

Users are responsible for following AO3 terms of service and each author's stated permissions.
