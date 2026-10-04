export const pages = [
  { id: "experiments", label: "Experiments", title: "Projects", angle: -32 },
  { id: "visuals", label: "Visuals", title: "Visual Stuffs", angle: -10 },
  { id: "travel", label: "Travel?", title: "Travel Notes", angle: 13 },
  { id: "writing", label: "Blog", title: "Blog", angle: 24 },
  { id: "home", label: "Home", title: "", angle: 35 },
];

// This will be populated dynamically in development
export let baseWorks = [
  {
    "id": "amigo",
    "page": "experiments",
    "title": "Amigo",
    "summary": "Still building it. Basically it's a companion 'amigo' for my pathetic friends who are going through tough breakups.",
    "cover": "linear-gradient(110deg, #d2d2d2 0 36%, #eeeeee 36% 70%, #c7c7c7 70%)",
    "md": "blog/experiments/amigo.md"
  },
  {
    "id": "narrate",
    "page": "experiments",
    "title": "Narrate",
    "summary": "_(:з」∠) I made a text-based game editor called Narrate.",
    "cover": "blog/experiments/en_interface_2.png",
    "md": "blog/experiments/narrate.md"
  },
  {
    "id": "home-cookin",
    "page": "visuals",
    "title": "家常音乐",
    "summary": "The title song in Soft Lipa's 2020 Album 'Home Cookin'. Got the beats on repeat for months then vibed this banner - screenshots from the ...",
    "cover": "blog/visuals/home_cookin.png",
    "md": "blog/visuals/home-cookin.md"
  },
  {
    "id": "sheena-ringo",
    "page": "visuals",
    "title": "Sheena Ringo",
    "summary": "Well I used to be a huge fan of Ringo - got dozens of this queen's photo on my walls.",
    "cover": "blog/visuals/ringo.png",
    "md": "blog/visuals/sheena-ringo.md"
  },
  {
    "id": "shrimps-remain",
    "page": "visuals",
    "title": "Remains of a Shrimp",
    "summary": "Back in 2021, my favorite music player Xiami stopped its service, I still think they had the best recommendation algorithms. Xiami == 虾米 ...",
    "cover": "blog/visuals/shrimp.png",
    "md": "blog/visuals/shrimps-remain.md"
  },
  {
    "id": "moral-machine-en",
    "page": "writing",
    "title": "The Moral Machine",
    "summary": "I've never finished a single book by ___, but I feel that these thoughts circling in my head may also have flowed through his. A person i...",
    "cover": "linear-gradient(200deg, #d2d2d2 0 36%, #eeeeee 36% 70%, #c7c7c7 70%)",
    "md": "blog/writing/moral-machine-en.md"
  },
  {
    "id": "moral-machine",
    "page": "writing",
    "title": "道德机器",
    "summary": "我从来没读完过___的一本书，但我觉得我脑子里围绕着打转的这些想法可能也流经过他的脑子。人是一扇扇门墙组成的网络，是苏州园林，或者白鼠迷宫，思维在这里移步换景地流窜。游击、逃亡、捕获、计算。",
    "cover": "linear-gradient(110deg, #d2d2d2 0 36%, #eeeeee 36% 70%, #c7c7c7 70%)",
    "md": "blog/writing/moral-machine.md"
  },
  {
    "id": "personality-magnification-and-spiral-carving-en",
    "page": "writing",
    "title": "Personality, Magnification, and a Mirror Carved in Spirals.",
    "summary": "I really do love parallel phrases in threes!",
    "cover": "linear-gradient(128deg, #d2d2d2 0 36%, #eeeeee 36% 70%, #c7c7c7 70%)",
    "md": "blog/writing/personality-magnification-and-spiral-carving-en.md"
  },
  {
    "id": "personality-magnification-and-spiral-carving",
    "page": "writing",
    "title": "人格，倍率，与螺旋雕刻的镜像。",
    "summary": "我真是太喜欢三段式排比了！",
    "cover": "linear-gradient(146deg, #d2d2d2 0 36%, #eeeeee 36% 70%, #c7c7c7 70%)",
    "md": "blog/writing/personality-magnification-and-spiral-carving.md"
  }
];

/**
 * Automatically discovers markdown files by fetching directory listings from the server.
 * This works with servers that provide directory indexing (like python -m http.server).
 */
export async function discoverAllWorks() {
  // If we're not on localhost, and we already have baked data, don't try to discover
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (!isLocal && baseWorks.length > 0) {
    return baseWorks;
  }

  const discovered = [];
  const contentPages = pages.filter((p) => p.id !== "home");

  for (const page of contentPages) {
    try {
      const response = await fetch(`./blog/${page.id}/`);
      if (!response.ok) continue;

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      
      // Find all links ending in .md
      const links = Array.from(doc.querySelectorAll("a"))
        .map(a => a.getAttribute("href"))
        .filter(href => href && href.toLowerCase().endsWith(".md"));

      for (const href of links) {
        const fileName = decodeURIComponent(href).split("/").pop();
        if (!fileName.endsWith(".md")) continue;
        
        const id = fileName.replace(".md", "").replace(/\s+/g, "-").toLowerCase();
        const mdPath = `blog/${page.id}/${fileName}`;
        
        const mdRes = await fetch(mdPath);
        if (!mdRes.ok) continue;
        
        const content = await mdRes.text();
        const titleMatch = content.match(/^#\s+(.*)/m);
        const title = titleMatch ? titleMatch[1].trim() : fileName.replace(".md", "");
        
        // Look for the first image in markdown
        const imageMatch = content.match(/!\[.*?\]\((.*?)\)/);
        let cover = `linear-gradient(${110 + (discovered.length % 6) * 18}deg, #d2d2d2 0 36%, #eeeeee 36% 70%, #c7c7c7 70%)`;
        
        if (imageMatch) {
          const imageUrl = imageMatch[1];
          cover = imageUrl.startsWith('http') ? imageUrl : `./blog/${page.id}/${imageUrl}`;
        }

        // Extract first paragraph as summary
        const summary = content.split("\n")
          .map(l => l.trim())
          .find(l => l && !l.startsWith("#") && !l.startsWith("![")) || "No summary available.";

        discovered.push({
          id,
          page: page.id,
          title,
          summary: summary.length > 120 ? summary.substring(0, 117) + "..." : summary,
          cover: cover,
          md: mdPath
        });
      }
    } catch (e) {
      console.warn(`Could not auto-discover items for ${page.id}:`, e);
    }
  }
  
  // Only update if we found something (prevents wiping out data on GH Pages)
  if (discovered.length > 0) {
    baseWorks = discovered;
  }
  return baseWorks;
}

const shapes = ["wide", "square", "tall", "poster", "panorama"];
const stressNames = [
  "Community Tool",
  "Archive Sketch",
  "Small Interface",
  "Field Receipt",
  "Memory Cabinet",
  "Language Note",
  "Prototype Log",
  "Research Card",
  "Photo Walk",
  "Debug Diary",
  "Workshop Page",
  "Tiny System",
];

export function routeFromHash(hash = "", allPages = pages) {
  const value = hash.replace(/^#/, "");
  if (value.startsWith("post/")) return { type: "detail", id: value.slice(5) };
  if (allPages.some((page) => page.id === value)) return { type: "page", id: value };
  return { type: "page", id: "home" };
}

export function pageForWork(workId, allWorks = baseWorks) {
  return allWorks.find((work) => work.id === workId)?.page || "experiments";
}

export function activePageId(currentRoute, allWorks = baseWorks) {
  if (currentRoute.type === "detail") return pageForWork(currentRoute.id, allWorks);
  return currentRoute.id;
}

export function orderedPages(pageId, allPages = pages) {
  if (pageId === "home") return allPages;
  const active = allPages.find((page) => page.id === pageId);
  const others = allPages.filter((page) => page.id !== pageId);
  return active ? [active, ...others] : allPages;
}

export function worksForPage(pageId, allWorks = baseWorks) {
  return allWorks.filter((work) => work.page === pageId);
}

export function featuredWork(pageId, allWorks = baseWorks) {
  return worksForPage(pageId, allWorks)[0] || null;
}

export function createStressWorks(sourceWorks = baseWorks, targetCount = 24) {
  const count = Math.max(sourceWorks.length, targetCount);
  const pageIds = pages.filter((page) => page.id !== "home").map((page) => page.id);
  const generated = [];

  for (let index = 0; index < count; index += 1) {
    const source = sourceWorks[index % sourceWorks.length];
    const isOriginal = index < sourceWorks.length;
    const page = isOriginal ? source.page : pageIds[index % pageIds.length];
    generated.push({
      ...source,
      id: isOriginal ? source.id : `stress-${page}-${index}`,
      page,
      title: isOriginal ? source.title : `${stressNames[index % stressNames.length]} ${index + 1}`,
      summary: isOriginal
        ? source.summary
        : "A placeholder entry used to test browsing density, card rhythm, and long-page scanning.",
      shape: isOriginal ? source.shape : shapes[index % shapes.length],
      cover: isOriginal
        ? source.cover
        : `linear-gradient(${110 + (index % 6) * 18}deg, #d2d2d2 0 36%, #eeeeee 36% 70%, #c7c7c7 70%)`,
      md: isOriginal ? source.md : sourceWorks[index % sourceWorks.length].md,
    });
  }

  return generated;
}

export function worksFromSearch(search = "", sourceWorks = baseWorks) {
  const params = new URLSearchParams(search);
  if (!params.has("stress") && !params.has("many")) return sourceWorks;
  const requested = Number(params.get("stress") || params.get("many") || 24);
  return createStressWorks(sourceWorks, Number.isFinite(requested) ? requested : 24);
}

export function cardClassForWork(work, index) {
  // Use the item ID to derive a stable but "random" shape and tone
  const hash = work.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const shape = work.shape || shapes[hash % shapes.length];
  const tone = hash % 5;
  return `work-card ${shape} tone-${tone}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function markdownToHtml(markdown) {
  return markdown
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      if (block.startsWith("> ")) {
        const quoted = block.split("\n").map((line) => line.replace(/^> ?/, "")).join("\n");
        const speaker = /^(我：|Me:)/.test(quoted) ? "dialogue-me" : "dialogue-ai";
        return `<blockquote class="dialogue ${speaker}">${markdownToHtml(quoted)}</blockquote>`;
      }
      if (block.startsWith("# ")) return `<h2>${escapeHtml(block.slice(2))}</h2>`;
      if (block.startsWith("## ")) return `<h3>${escapeHtml(block.slice(3))}</h3>`;
      if (block.startsWith("![")) {
        const match = block.match(/!\[(.*?)\]\((.*?)\)/);
        return match ? `<img src="${escapeHtml(match[2])}" alt="${escapeHtml(match[1])}" />` : "";
      }
      return `<p>${escapeHtml(block).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}
