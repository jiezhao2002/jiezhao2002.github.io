import assert from "node:assert/strict";
import test from "node:test";
import {
  activePageId,
  baseWorks,
  cardClassForWork,
  createStressWorks,
  featuredWork,
  markdownToHtml,
  orderedPages,
  pageForWork,
  pages,
  routeFromHash,
  worksForPage,
  worksFromSearch,
} from "../site-core.mjs";

test("routes known pages, details, and unknown hashes", () => {
  assert.deepEqual(routeFromHash("#visuals", pages), { type: "page", id: "visuals" });
  assert.deepEqual(routeFromHash("#post/narrate", pages), { type: "detail", id: "narrate" });
  assert.deepEqual(routeFromHash("#missing", pages), { type: "page", id: "home" });
});

test("detail routes resolve to the owning page", () => {
  assert.equal(pageForWork("interface-notes", baseWorks), "visuals");
  assert.equal(activePageId({ type: "detail", id: "field-card" }, baseWorks), "travel");
});

test("active page slip is sorted to the front", () => {
  assert.equal(orderedPages("travel", pages)[0].id, "travel");
  assert.equal(orderedPages("home", pages)[0].id, "experiments");
});

test("showcase helpers pick page work and featured work", () => {
  const experimentsWorks = worksForPage("experiments", baseWorks);
  assert.equal(experimentsWorks.length, 2);
  assert.equal(featuredWork("experiments", baseWorks).id, "narrate");
});

test("stress mode creates a large mixed shelf for browsing tests", () => {
  const manyWorks = createStressWorks(baseWorks, 30);
  assert.equal(manyWorks.length, 30);
  assert.ok(worksForPage("experiments", manyWorks).length > baseWorks.filter((work) => work.page === "experiments").length);
  assert.ok(worksForPage("visuals", manyWorks).length > 1);
  assert.ok(worksForPage("travel", manyWorks).length > 1);
});

test("URL search opts into stress data", () => {
  assert.equal(worksFromSearch("?stress=18", baseWorks).length, 18);
  assert.equal(worksFromSearch("", baseWorks), baseWorks);
});

test("card classes preserve shape and assign tones", () => {
  assert.equal(cardClassForWork({ shape: "panorama" }, 6), "work-card panorama tone-1");
});

test("markdown renderer handles headings, images, line breaks, and escaping", () => {
  const html = markdownToHtml(`# Hello <x>\n\n## Next\n\nline one\nline two\n\n![alt <tag>](image.png)`);
  assert.match(html, /<h2>Hello &lt;x&gt;<\/h2>/);
  assert.match(html, /<h3>Next<\/h3>/);
  assert.match(html, /line one<br \/>line two/);
  assert.match(html, /alt="alt &lt;tag&gt;"/);
});
