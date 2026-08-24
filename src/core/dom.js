/**
 * dom.js — Minimal DOM helpers.
 *
 * Deliberately tiny: no framework means no hydration step, which is what keeps
 * the rendered DOM a stable automation target.
 */

/**
 * Create an element.
 * `testid` is hoisted to a real attribute so callers never hand-write it.
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'testid') node.setAttribute('data-testid', v);
    else if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') for (const [dk, dv] of Object.entries(v)) {
      if (dv !== null && dv !== undefined) node.dataset[dk] = dv;
    }
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'for') node.htmlFor = v;
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
export const byTestId = (id, root = document) => root.querySelector(`[data-testid="${id}"]`);

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(node, ...children) {
  clear(node).append(...children.flat().filter(Boolean));
  return node;
}

/**
 * Signal to automation that the page has finished its initial render.
 * Waiting on this beats waiting on arbitrary timeouts.
 */
export function markReady(extra = {}) {
  document.body.dataset.appReady = 'true';
  for (const [k, v] of Object.entries(extra)) document.body.dataset[k] = String(v);
  document.dispatchEvent(new CustomEvent('app:ready', { detail: extra }));
}

export function markError(message) {
  document.body.dataset.appReady = 'error';
  document.body.dataset.appError = message;
}

/** Query parameters, used for reproducible automation runs (?seed=1&noanim=1). */
export const params = new URLSearchParams(location.search);

export const formatClock = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

export const slug = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
