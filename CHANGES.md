Changes

Demographic filtering (new)
Filter bar above charts (Philosophy + Demographics pages)
1 dropdown per demographic, checkbox multi-select w/ counts
OR within a demographic, AND across
Live "Showing N of M" + per-dropdown count badge + Reset
Composes w/ PhilPapers compare (TPC side reflects filter)
Empty result shows warning message

Dropdown z-index fix
Open menus were hidden behind cards below
Cause: card hover transform trap + z-index auto
Fix: filter-bar z-index 1030, kill hover transform, filter-menu z-index 1031

Anti-AI scraping
robots.txt - disallow ~25 AI/LLM crawlers, allow rest
robots meta tag (noai, noimageai) all pages
Footer opt-out notice all pages

Comments / cleanup
Slimmed added comments to 1-liners
Commented tricky original code (dual-mode input, label wrap, Other bucket, compare branch)
Removed no-op Object.assign(philpapersQuestionMap)

Files touched
js/app.js, css/components.css (edited)
robots.txt, CHANGES.md (new)
all 6 html pages (meta + footer)
