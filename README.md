# ao3-to-arxiv
# AO3 arXiv Paper Reader

AO3 arXiv Paper Reader is a Tampermonkey userscript that turns AO3 work pages into a local paper style reading view.

It gives AO3 chapters a layout similar to academic PDF pages, with a running header, title block, author line, abstract area, two column body text, page numbers, side date stamp, and zoom controls.

This script only changes how the page looks in your own browser. It does not download, copy, repost, or modify AO3 content.

## Preview

The script changes an AO3 work page into a paper like reading page.

Main visual changes include

- Paper style page container
- Running header at the top
- Work title and author in the first page
- Abstract style note area
- Two column chapter text
- Page numbers
- Side date stamp like arXiv PDF pages
- Zoom controls in the bottom right corner

## Features

- Local browser only rendering
- AO3 work page support
- Paper style first page
- Two column layout
- Page based layout
- Upright serif body font
- Running header
- Side date stamp
- Page numbers
- Zoom in, zoom out, and reset
- Floating toolbar
- Mac friendly keyboard shortcuts
- No external server
- No content scraping
- No account data collection

## Installation

Install a userscript manager first.

Recommended option

- Tampermonkey

Then install the script manually.

Steps

1. Open Tampermonkey
2. Create a new script
3. Delete the default template
4. Paste the full script into the editor
5. Save the script
6. Open an AO3 work or chapter page
7. Click the Paper button in the bottom right corner

## Usage

After installation, open any AO3 work page.

The script adds a floating toolbar in the bottom right corner.

Toolbar buttons

| Button | Function |
| --- | --- |
| A− | Zoom out |
| 100% | Current zoom level |
| A+ | Zoom in |
| Reset | Reset zoom |
| Paper | Toggle paper mode |

Keyboard shortcuts

| Shortcut | Function |
| --- | --- |
| Option + P | Toggle paper mode |
| Option + = | Zoom in |
| Option + - | Zoom out |
| Option + 0 | Reset zoom |


## Configuration

You can edit the constants near the top of the script.

```javascript
const FONT_SIZE_PX = 16;
const LINE_HEIGHT = 1.25;
const LINES_PER_COLUMN = 40;
const PAGE_WIDTH_PX = 1120;
const COLUMN_GAP_PX = 38;
