# 📺 Excalidraw — Fire TV Edition

> **A fork of [Excalidraw](https://github.com/excalidraw/excalidraw) adapted for Amazon Fire TV remotes.**  
> Draw, sketch, and whiteboard entirely with your Fire TV D-pad — no mouse or keyboard needed.

[![Forked from Excalidraw](https://img.shields.io/badge/forked%20from-excalidraw%2Fexcalidraw-blue?logo=github)](https://github.com/excalidraw/excalidraw)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 🔥 What's New in This Fork

This fork adds a `FireTVController` layer on top of Excalidraw that translates Fire TV remote button presses into pointer/keyboard events, giving you full drawing capability with just the D-pad remote.

### ✨ Fire TV Features

| Feature | Details |
|---|---|
| **Virtual cursor** | Blue crosshair follows D-pad movement; turns red while drawing |
| **D-pad movement** | Arrow keys move the cursor smoothly with acceleration (hold = faster) |
| **Click / Place** | OK (Select) button = left click |
| **Undo** | Short-press **Back** = Ctrl+Z |
| **Help overlay** | Hold **Back** for 0.6 s → full control reference screen |
| **Tool cycling** | **Rewind ⏪** / **Fast Forward ⏩** step through all tools |
| **Tool ring** | **Menu ☰** opens a visual tool picker overlay |
| **Select All** | **Play/Pause ⏯** when already on the Selection tool = Ctrl+A |
| **Mode switch** | **Play/Pause ⏯** on any other tool = switch to Selection |
| **✏️ Pencil auto-draw** | In Freedraw mode, just move the D-pad — the pen is always down. No OK press needed to start a stroke |
| **Lift pen** | In Freedraw mode, OK ends the current stroke and starts a fresh one |
| **Input field bypass** | Keyboard events pass through normally when a text input is focused |

### 🎮 Full Remote Control Map

| Button | Action |
|---|---|
| ⬆ ⬇ ⬅ ➡ D-pad | Move virtual cursor |
| OK / Select | Click — place shape, confirm, select element |
| OK (in ✏️ Pencil) | Lift pen · start new stroke |
| Back (short press) | Undo |
| Back (hold 0.6 s) | Open Help overlay |
| ⏪ Rewind | Previous tool |
| ⏩ Fast Forward | Next tool |
| ☰ Menu | Open tool ring picker |
| ⏯ Play/Pause | Select All (if on Selection) · otherwise switch to Selection |

### 🛠️ Tools Available

| # | Tool | Notes |
|---|---|---|
| 1 | 👆 Selection | Click, drag to multi-select, Play/Pause = Select All |
| 2 | ⬜ Rectangle | OK starts, D-pad sizes, OK confirms |
| 3 | ◇ Diamond | Same as Rectangle |
| 4 | ⭕ Ellipse | Same as Rectangle |
| 5 | ➡️ Arrow | OK starts, D-pad draws the line, OK places end |
| 6 | ⁄ Line | Same as Arrow |
| 7 | ✏️ Freedraw | Move D-pad to draw continuously |
| 8 | T Text | OK places text box |
| 9 | 🧹 Eraser | Move over elements, OK to erase |

---

## 🚀 Setup & Running

```bash
# Install dependencies
yarn

# Start dev server (accessible on your local network for TV testing)
yarn start:app --host

# Build for production
yarn build:app
```

**Testing on a real Fire TV:**
1. Run `yarn start:app --host` — note your machine's local IP (e.g. `192.168.1.x`)
2. On the Fire TV, open Silk Browser and navigate to `http://<your-ip>:3001`
3. Fire TV is auto-detected via the Silk user-agent string
4. To force Fire TV mode in a desktop browser, add `?firetv=1` to the URL

---

## 🔧 Implementation Details

New files added in `excalidraw-app/firetv/`:

- **`FireTVController.tsx`** — Main controller component (~1,014 lines). Wraps Excalidraw, captures `keydown`/`keyup` at window capture phase, dispatches synthetic `PointerEvent`s to the canvas, renders virtual cursor, ToolHUD, ToolRing, and HelpOverlay.
- **`detect.ts`** — Fire TV detection utility. Checks `navigator.userAgent` for `Silk/`, `AFT*`, `KFFOWI` strings plus `?firetv=1` dev override.
- **`index.ts`** — Barrel exports.

`excalidraw-app/App.tsx` is modified to conditionally wrap Excalidraw in `<FireTVController>` when Fire TV is detected.

---

## 📜 Credits & Attribution

This project is a fork of **[Excalidraw](https://github.com/excalidraw/excalidraw)** — an amazing open-source virtual whiteboard by [@excalidraw](https://github.com/excalidraw) and contributors.

All original Excalidraw code, MIT license, and contributor work is preserved and unmodified except for:
- `excalidraw-app/App.tsx` — minor wrapper addition
- `excalidraw-app/firetv/` — new directory (all new code)

> **Original project:** https://github.com/excalidraw/excalidraw  
> **Original license:** MIT  
> **Original authors:** Excalidraw contributors — see [CONTRIBUTORS.md](https://github.com/excalidraw/excalidraw/graphs/contributors)

---

## 📄 Original Excalidraw README

<a href="https://excalidraw.com/" target="_blank" rel="noopener">
  <picture>
    <source media="(prefers-color-scheme: dark)" alt="Excalidraw" srcset="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github/excalidraw_github_cover_2_dark.png" />
    <img alt="Excalidraw" src="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github/excalidraw_github_cover_2.png" />
  </picture>
</a>

<h4 align="center">
  <a href="https://excalidraw.com">Excalidraw Editor</a> |
  <a href="https://plus.excalidraw.com/blog">Blog</a> |
  <a href="https://docs.excalidraw.com">Documentation</a> |
  <a href="https://plus.excalidraw.com">Excalidraw+</a>
</h4>

<div align="center">
  <h2>
    An open source virtual hand-drawn style whiteboard. </br>
    Collaborative and end-to-end encrypted. </br>
  <br />
  </h2>
</div>

<br />
<p align="center">
  <a href="https://github.com/excalidraw/excalidraw/blob/master/LICENSE">
    <img alt="Excalidraw is released under the MIT license." src="https://img.shields.io/badge/license-MIT-blue.svg"  /></a>
  <a href="https://www.npmjs.com/package/@excalidraw/excalidraw">
    <img alt="npm downloads/month" src="https://img.shields.io/npm/dm/@excalidraw/excalidraw"  /></a>
  <a href="https://docs.excalidraw.com/docs/introduction/contributing">
    <img alt="PRs welcome!" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat"  /></a>
  <a href="https://discord.gg/UexuTaE">
    <img alt="Chat on Discord" src="https://img.shields.io/discord/723672430744174682?color=738ad6&label=Chat%20on%20Discord&logo=discord&logoColor=ffffff&widget=false"/></a>
  <a href="https://deepwiki.com/excalidraw/excalidraw">
    <img alt="Ask DeepWiki" src="https://deepwiki.com/badge.svg" /></a>
  <a href="https://twitter.com/excalidraw">
    <img alt="Follow Excalidraw on Twitter" src="https://img.shields.io/twitter/follow/excalidraw.svg?label=follow+@excalidraw&style=social&logo=twitter"/></a>
</p>

<div align="center">
  <figure>
    <a href="https://excalidraw.com" target="_blank" rel="noopener">
      <img src="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github%2Fproduct_showcase.png" alt="Product showcase" />
    </a>
    <figcaption>
      <p align="center">
        Create beautiful hand-drawn like diagrams, wireframes, or whatever you like.
      </p>
    </figcaption>
  </figure>
</div>

## Features

The Excalidraw editor (npm package) supports:

- 💯&nbsp;Free & open-source.
- 🎨&nbsp;Infinite, canvas-based whiteboard.
- ✍️&nbsp;Hand-drawn like style.
- 🌓&nbsp;Dark mode.
- 🏗️&nbsp;Customizable.
- 📷&nbsp;Image support.
- 😀&nbsp;Shape libraries support.
- 🌐&nbsp;Localization (i18n) support.
- 🖼️&nbsp;Export to PNG, SVG & clipboard.
- 💾&nbsp;Open format - export drawings as an `.excalidraw` json file.
- ⚒️&nbsp;Wide range of tools - rectangle, circle, diamond, arrow, line, free-draw, eraser...
- ➡️&nbsp;Arrow-binding & labeled arrows.
- 🔙&nbsp;Undo / Redo.
- 🔍&nbsp;Zoom and panning support.

## Excalidraw.com

The app hosted at [excalidraw.com](https://excalidraw.com) is a minimal showcase of what you can build with Excalidraw. Its [source code](https://github.com/excalidraw/excalidraw/tree/master/excalidraw-app) is part of this repository as well, and the app features:

- 📡&nbsp;PWA support (works offline).
- 🤼&nbsp;Real-time collaboration.
- 🔒&nbsp;End-to-end encryption.
- 💾&nbsp;Local-first support (autosaves to the browser).
- 🔗&nbsp;Shareable links (export to a readonly link you can share with others).

We'll be adding these features as drop-in plugins for the npm package in the future.

## Quick start

**Note:** following instructions are for installing the Excalidraw [npm package](https://www.npmjs.com/package/@excalidraw/excalidraw) when integrating Excalidraw into your own app. To run the repository locally for development, please refer to our [Development Guide](https://docs.excalidraw.com/docs/introduction/development).

Use `npm` or `yarn` to install the package.

```bash
npm install react react-dom @excalidraw/excalidraw
# or
yarn add react react-dom @excalidraw/excalidraw
```

Check out our [documentation](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/installation) for more details!

## Contributing

- Missing something or found a bug? [Report here](https://github.com/excalidraw/excalidraw/issues).
- Want to contribute? Check out our [contribution guide](https://docs.excalidraw.com/docs/introduction/contributing) or let us know on [Discord](https://discord.gg/UexuTaE).
- Want to help with translations? See the [translation guide](https://docs.excalidraw.com/docs/introduction/contributing#translating).

## Integrations

- [VScode extension](https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor)
- [npm package](https://www.npmjs.com/package/@excalidraw/excalidraw)

## Who's integrating Excalidraw

[Google Cloud](https://googlecloudcheatsheet.withgoogle.com/architecture) • [Meta](https://meta.com/) • [CodeSandbox](https://codesandbox.io/) • [Obsidian Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin) • [Replit](https://replit.com/) • [Slite](https://slite.com/) • [Notion](https://notion.so/) • [HackerRank](https://www.hackerrank.com/) • and many others

## Sponsors & support

If you like the project, you can become a sponsor at [Open Collective](https://opencollective.com/excalidraw) or use [Excalidraw+](https://plus.excalidraw.com/).

## Thank you for supporting Excalidraw

[<img src="https://opencollective.com/excalidraw/tiers/sponsors/0/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/0/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/1/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/1/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/2/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/2/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/3/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/3/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/4/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/4/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/5/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/5/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/6/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/6/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/7/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/7/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/8/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/8/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/9/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/9/website) [<img src="https://opencollective.com/excalidraw/tiers/sponsors/10/avatar.svg?avatarHeight=120"/>](https://opencollective.com/excalidraw/tiers/sponsors/10/website)

<a href="https://opencollective.com/excalidraw#category-CONTRIBUTE" target="_blank"><img src="https://opencollective.com/excalidraw/tiers/backers.svg?avatarHeight=32"/></a>

Last but not least, we're thankful to these companies for offering their services for free:

[![Vercel](./.github/assets/vercel.svg)](https://vercel.com) [![Sentry](./.github/assets/sentry.svg)](https://sentry.io) [![Crowdin](./.github/assets/crowdin.svg)](https://crowdin.com)
