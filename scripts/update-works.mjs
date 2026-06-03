import { readdirSync, readFileSync, writeFileSync, existsSync, watch } from 'fs';
import { join, relative } from 'path';

const BLOG_DIR = './blog';
const SITE_CORE_PATH = './site-core.mjs';

// Helper to extract first paragraph as summary
function extractSummary(content) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('#') && !line.startsWith('![')) {
      // Remove basic markdown links/bold for summary
      const cleanLine = line.replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/(\*\*|__)(.*?)\1/g, '$2');
      return cleanLine.length > 140 ? cleanLine.substring(0, 137) + '...' : cleanLine;
    }
  }
  return '';
}

function update() {
  console.log('Syncing blog content...');
  const pages = existsSync(BLOG_DIR) 
    ? readdirSync(BLOG_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
    : [];

  const baseWorks = [];

  for (const page of pages) {
    const pagePath = join(BLOG_DIR, page);
    const files = readdirSync(pagePath)
      .filter(file => file.endsWith('.md'));

    for (const file of files) {
      const filePath = join(pagePath, file);
      const content = readFileSync(filePath, 'utf-8');
      
      const titleMatch = content.match(/^#\s+(.*)/m);
      const title = titleMatch ? titleMatch[1].trim() : file.replace('.md', '');
      
      const id = file.replace('.md', '').replace(/\s+/g, '-').toLowerCase();
      const summary = extractSummary(content) || `A collection of notes and fragments from ${page}.`;
      
      // Look for the first image in markdown: ![alt](url)
      const imageMatch = content.match(/!\[.*?\]\((.*?)\)/);
      let cover = `linear-gradient(${110 + (baseWorks.length % 6) * 18}deg, #d2d2d2 0 36%, #eeeeee 36% 70%, #c7c7c7 70%)`;
      
      if (imageMatch) {
        const imageUrl = imageMatch[1];
        // If the URL is relative, make it relative to the root
        cover = imageUrl.startsWith('http') ? imageUrl : join('blog', page, imageUrl);
      }

      baseWorks.push({
        id,
        page,
        title,
        summary,
        cover,
        md: relative('.', filePath)
      });
    }
  }

  let siteCoreContent = readFileSync(SITE_CORE_PATH, 'utf-8');

  // Find existing baseWorks and replace it
  const regex = /export let baseWorks = \[[\s\S]*?\];/;
  const replacement = `export let baseWorks = ${JSON.stringify(baseWorks, null, 2)};`;
  
  if (regex.test(siteCoreContent)) {
    siteCoreContent = siteCoreContent.replace(regex, replacement);
  } else {
    // If not found, look for const version as fallback
    siteCoreContent = siteCoreContent.replace(/export const baseWorks = \[[\s\S]*?\];/, replacement);
  }

  writeFileSync(SITE_CORE_PATH, siteCoreContent);
  console.log(`Successfully updated baseWorks in site-core.mjs with ${baseWorks.length} items.`);
}

// Initial run
update();

// Watch mode
if (process.argv.includes('--watch')) {
  console.log(`Watching ${BLOG_DIR} for changes...`);
  watch(BLOG_DIR, { recursive: true }, (event, filename) => {
    if (filename && filename.endsWith('.md')) {
      console.log(`File ${filename} changed (${event}), re-syncing...`);
      update();
    }
  });
}
