import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';

const root = new URL('../web-dist/', import.meta.url).pathname;
const htmlFiles = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (extname(path) === '.html') htmlFiles.push(path);
  }
}

function targetFor(href) {
  const pathname = href.split(/[?#]/, 1)[0];
  if (pathname === '/') return join(root, 'index.html');
  const trimmed = pathname.replace(/^\//, '').replace(/\/$/, '');
  return extname(trimmed) ? join(root, trimmed) : join(root, trimmed, 'index.html');
}

walk(root);
const failures = [];
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    if (!existsSync(targetFor(href))) failures.push(`${relative(root, file)} -> ${href}`);
  }
}

if (failures.length) throw new Error(`Broken internal links:\n${failures.join('\n')}`);
process.stdout.write(`Checked ${htmlFiles.length} pages; all internal links resolve.\n`);
