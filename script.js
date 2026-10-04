import {
  activePageId as resolveActivePageId,
  baseWorks,
  cardClassForWork,
  featuredWork,
  markdownToHtml,
  orderedPages as orderPages,
  pageForWork as resolvePageForWork,
  pages,
  routeFromHash,
  worksForPage,
  worksFromSearch,
} from "./site-core.mjs";

let works = worksFromSearch(window.location.search, baseWorks);
const shell = document.querySelector(".site-shell");
const records = document.querySelector(".records");
const title = document.querySelector(".showcase-title");
const showcaseCount = document.querySelector(".showcase-count");
const wall = document.querySelector(".wall");
const projectNote = document.querySelector(".project-note p");
const readMore = document.querySelector(".read-more");
const detailBack = document.querySelector(".detail-back");
const detailCover = document.querySelector(".detail-cover");
const detailKicker = document.querySelector(".detail-kicker");
const detailTitle = document.querySelector(".detail-title");
const detailSummary = document.querySelector(".detail-summary");
const detailBody = document.querySelector(".detail-body");
let selectedId = null;

function route() {
  return routeFromHash(window.location.hash, pages);
}

function pageForWork(workId) {
  return resolvePageForWork(workId, works);
}

function activePageId(currentRoute = route()) {
  return resolveActivePageId(currentRoute, works);
}

function setPage(currentRoute = route()) {
  const pageId = activePageId(currentRoute);
  const page = pages.find((item) => item.id === pageId) || pages.find((item) => item.id === "home");
  shell.dataset.page = currentRoute.type === "detail" ? "detail" : page.id;
  title.innerHTML = page.title;
  document.querySelectorAll(".record").forEach((record) => {
    record.classList.toggle("is-active", record.dataset.id === page.id && page.id !== "home");
  });

  if (currentRoute.type === "detail") {
    renderDetail(currentRoute.id);
    return;
  }

  if (page.id !== "home") renderShowcase(page.id);
}

function renderRecords() {
  const currentRoute = route();
  const pageId = activePageId(currentRoute);
  records.innerHTML = "";
  orderPages(pageId, pages).forEach((page, index) => {
    const record = document.createElement("a");
    record.href = page.id === "home" ? "#" : `#${page.id}`;
    record.className = "record";
    record.dataset.id = page.id;
    record.style.setProperty("--i", index);
    record.style.setProperty("--stack", pages.length - 1 - index);
    record.style.setProperty("--depth", pages.length - index);
    record.style.setProperty("--z", pages.length - index);
    record.style.setProperty("--angle", `${page.angle || 0}deg`);

    const label = document.createElement("span");
    label.textContent = page.label;
    record.append(label);

    record.addEventListener("pointerdown", (event) => {
      if ((event.pointerType === "touch" || event.pointerType === "pen") && selectedId !== page.id) {
        event.preventDefault();
        record.dataset.armTap = "true";
        selectedId = page.id;
        document.querySelectorAll(".record").forEach((item) => {
          item.classList.toggle("is-selected", item.dataset.id === page.id);
        });
      }
    });

    record.addEventListener("click", (event) => {
      if (record.dataset.armTap === "true") {
        event.preventDefault();
        delete record.dataset.armTap;
        return;
      }
      const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (!canHover && selectedId !== page.id) {
        event.preventDefault();
        selectedId = page.id;
        document.querySelectorAll(".record").forEach((item) => {
          item.classList.toggle("is-selected", item.dataset.id === page.id);
        });
      }
    });

    records.append(record);
  });
  setPage(currentRoute);
}

function renderShowcase(pageId) {
  const pageWorks = worksForPage(pageId, works);
  const featured = featuredWork(pageId, works);
  const page = pages.find((item) => item.id === pageId);
  wall.innerHTML = "";
  wall.dataset.count = String(pageWorks.length);

  pageWorks.forEach((work, index) => {
    const card = document.createElement("a");
    card.href = `#post/${work.id}`;
    card.className = cardClassForWork(work, index);
    
    // Handle image vs gradient background
    if (work.cover.startsWith('linear-gradient')) {
      card.style.background = work.cover;
    } else {
      card.style.backgroundImage = `url('${work.cover}')`;
      card.style.backgroundSize = 'cover';
      card.style.backgroundPosition = 'center';
    }
    
    card.style.setProperty("--n", index);

    const cardTitle = document.createElement("span");
    cardTitle.className = "work-card-title";
    cardTitle.textContent = work.title;
    card.append(cardTitle);

    wall.append(card);
  });

  if (!featured) {
    projectNote.textContent = "This shelf is waiting for its first folder.";
    readMore.removeAttribute("href");
    return;
  }

  projectNote.textContent = "";
  const featuredTitle = document.createElement("strong");
  featuredTitle.textContent = featured.title;
  projectNote.append(featuredTitle, document.createElement("br"), featured.summary);
  readMore.href = `#post/${featured.id}`;
  readMore.textContent = `→ What is this about?`;
}

async function renderDetail(workId) {
  const work = works.find((item) => item.id === workId) || works[0];
  detailBack.href = `#${work.page}`;
  
  if (work.cover.startsWith('linear-gradient')) {
    detailCover.style.background = work.cover;
    detailCover.style.backgroundImage = 'none';
  } else {
    detailCover.style.backgroundImage = `url('${work.cover}')`;
    detailCover.style.backgroundSize = 'cover';
    detailCover.style.backgroundPosition = 'center';
  }
  
  detailKicker.textContent = pages.find((page) => page.id === work.page)?.label || "";
  detailTitle.textContent = work.title;
  detailSummary.textContent = work.summary;
  detailBody.innerHTML = "<p>Loading...</p>";

  try {
    const response = await fetch(work.md);
    if (!response.ok) throw new Error("Missing markdown");
    const markdown = await response.text();
    
    // Convert markdown to HTML and fix image paths
    let html = markdownToHtml(markdown);
    
    // If the post has a relative image like <img src="image.png">, 
    // it needs to be prefixed with the blog category path
    const blogPath = `blog/${work.page}/`;
    html = html.replace(/<img src="(?!http)(.*?)"/g, `<img src="${blogPath}$1"`);
    
    detailBody.innerHTML = html;
  } catch {
    detailBody.innerHTML = "<p>This folder is ready for a markdown file and image assets.</p>";
  }
}

window.addEventListener("hashchange", () => {
  selectedId = null;
  renderRecords();
});

document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".record")) {
    selectedId = null;
    document.querySelectorAll(".record").forEach((record) => record.classList.remove("is-selected"));
  }
});

window.__jieSite = {
  renderShowcase,
  renderRecords,
  get works() { return works; },
};

async function init() {
  console.log("Initializing site...");
  try {
    await discoverAllWorks();
    // Re-evaluate works after discovery to sync data
    works = worksFromSearch(window.location.search, baseWorks);
    console.log("Discovery finished, total works found:", works.length);
  } catch (e) {
    console.error("Discovery failed:", e);
  }
  renderRecords();
}

init();
