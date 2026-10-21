/* global document, navigator, window, IntersectionObserver */
const menu = document.querySelector('[data-menu]');
const nav = document.querySelector('[data-nav]');
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') === 'true';
  menu.setAttribute('aria-expanded', String(!open));
  nav?.toggleAttribute('data-open', !open);
});

const docsMenu = document.querySelector('[data-docs-menu]');
const docsNav = document.querySelector('[data-docs-nav]');
docsMenu?.addEventListener('click', () => {
  const open = docsMenu.getAttribute('aria-expanded') === 'true';
  docsMenu.setAttribute('aria-expanded', String(!open));
  docsNav?.toggleAttribute('data-open', !open);
});

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const code = button.closest('.code-shell')?.querySelector('code')?.textContent ?? '';
    await navigator.clipboard.writeText(code);
    button.textContent = 'Copied';
    window.setTimeout(() => (button.textContent = 'Copy'), 1600);
  });
});

const search = document.querySelector('[data-search]');
const results = document.querySelector('[data-results]');
search?.addEventListener('input', () => {
  const query = search.value.trim().toLowerCase();
  document.querySelectorAll('[data-doc-link]').forEach((link) => {
    const match = !query || link.textContent.toLowerCase().includes(query);
    link.toggleAttribute('hidden', !match);
  });
  if (results) results.textContent = query ? `Filtered documentation for “${search.value}”` : '';
});

const flow = document.querySelector('[data-flow]');
if (flow && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) flow.setAttribute('data-active', '');
    },
    { threshold: 0.35 },
  );
  observer.observe(flow);
}
