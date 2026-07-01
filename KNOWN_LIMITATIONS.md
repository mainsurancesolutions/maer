# Known limitations (to revisit)

- **Hover popups don't trigger on rich-text inline elements.** `popupScript.wrapWords`
  (scripts/popup.js) only handles `P`, `SPAN`, `INS`, `DEL` elements. Hovering a defined
  term or section reference that sits inside a `<strong>`, `<em>`, or `<a>` (produced by
  mammoth from the .docx) returns no popup. This contributes to popups feeling
  inconsistent on some documents. Fix would extend the `wrapWords` switch (or use a
  `.closest()`-style walk up to the containing paragraph) to handle nested inline tags.
  Flagged 2026-06-30; out of scope at the time.
