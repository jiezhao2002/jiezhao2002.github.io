import assert from "node:assert/strict";
import test from "node:test";
import {
  activePageId,
  appHref,
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
  workHref,
} from "../site-core.mjs";

test("routes known pages, details, and unknown hashes", () => {
  assert.deepEqual(routeFromHash("#visuals", pages), { type: "page", id: "visuals" });
  assert.deepEqual(routeFromHash("#post/narrate", pages), { type: "detail", id: "narrate" });
  assert.deepEqual(routeFromHash("#missing", pages), { type: "page", id: "home" });
});

test("detail routes resolve to the owning page", () => {
  const fixtures = [{ id: "interface-notes", page: "visuals" }, { id: "field-card", page: "travel" }];
  assert.equal(pageForWork("interface-notes", fixtures), "visuals");
  assert.equal(activePageId({ type: "detail", id: "field-card" }, fixtures), "travel");
});

test("active page slip is sorted to the front", () => {
  assert.equal(orderedPages("travel", pages)[0].id, "travel");
  assert.equal(orderedPages("home", pages)[0].id, "experiments");
});

test("showcase helpers pick page work and featured work", () => {
  const experimentsWorks = worksForPage("experiments", baseWorks);
  assert(experimentsWorks.some((work) => work.id === "tree"));
  assert.equal(featuredWork("experiments", baseWorks), experimentsWorks[0]);
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
  assert.equal(cardClassForWork({ id: "test", shape: "panorama" }, 6), "work-card panorama tone-3");
});

test("Tree opens the application from Experiments without changing other project routes", () => {
  const tree = baseWorks.find((work) => work.id === "tree");
  assert.equal(tree.page, "experiments");
  assert.equal(workHref(tree), "tree/");
  assert.equal(appHref(tree), "tree/");
  assert.equal(workHref({ id: "narrate" }), "#post/narrate");
  assert.equal(appHref({ id: "narrate" }), null);
});

test("markdown renderer handles headings, images, line breaks, and escaping", () => {
  const html = markdownToHtml(`# Hello <x>\n\n## Next\n\nline one\nline two\n\n![alt <tag>](image.png)`);
  assert.match(html, /<h2>Hello &lt;x&gt;<\/h2>/);
  assert.match(html, /<h3>Next<\/h3>/);
  assert.match(html, /line one<br \/>line two/);
  assert.match(html, /alt="alt &lt;tag&gt;"/);
});
