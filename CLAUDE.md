# CLAUDE.md — solarbuild

Solar + Battery Discovery → Design Tool (Ireland, 2026). A static web app: a homeowner fills a
questionnaire, clicks **Generate**, and gets an indicative PV/battery design, product shortlist,
costing (SEAI grant + 0% VAT), payback, and an install plan.

## Structure (no build step)
- `index.html` — markup only.
- `css/styles.css` — all styles.
- `js/app.js` — the whole design engine + the SVG diagram. The editable `PRICING` object is at the top.
- Loaded via relative paths, so double-clicking `index.html` works offline. Only network call is Google Fonts (optional).

## Working here
- Run: open `index.html` in a browser (or serve the folder). No install, no dependencies.
- Deploy: static host (see `README.md`). Nothing to build.
- **Tuning prices** is the most common edit — change `PRICING` in `js/app.js`. See `DOCUMENTATION.md` §6 & §12.
- Full technical reference: [`DOCUMENTATION.md`](DOCUMENTATION.md). User-facing overview: [`README.md`](README.md).

## Guardrails
- Keep it dependency-free and build-free — don't introduce a bundler or framework.
- It's an indicative planning aid, **not a quote**. Keep that disclaimer intact in the output and docs.
