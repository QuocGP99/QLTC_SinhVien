// dom.js - DOM helper functions

// Query selector shortcuts
export const qs = (selector, parent = document) => parent.querySelector(selector);
export const qsa = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

// Create element from HTML string
export function renderHTML(htmlString) {
  const template = document.createElement('template');
  template.innerHTML = htmlString.trim();
  return template.content.firstChild;
}

// Show/hide elements
export function show(element) {
  if (typeof element === 'string') element = qs(element);
  if (element) element.style.display = '';
}

export function hide(element) {
  if (typeof element === 'string') element = qs(element);
  if (element) element.style.display = 'none';
}

export function toggle(element) {
  if (typeof element === 'string') element = qs(element);
  if (element) {
    element.style.display = element.style.display === 'none' ? '' : 'none';
  }
}

// Add/remove classes
export function addClass(element, className) {
  if (typeof element === 'string') element = qs(element);
  if (element) element.classList.add(className);
}

export function removeClass(element, className) {
  if (typeof element === 'string') element = qs(element);
  if (element) element.classList.remove(className);
}

export function toggleClass(element, className) {
  if (typeof element === 'string') element = qs(element);
  if (element) element.classList.toggle(className);
}

// Set attributes
export function setAttr(element, attrs) {
  if (typeof element === 'string') element = qs(element);
  if (element) {
    Object.entries(attrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
}

// Event delegation
export function delegate(parent, eventType, selector, handler) {
  parent.addEventListener(eventType, (e) => {
    const target = e.target.closest(selector);
    if (target) {
      handler.call(target, e);
    }
  });
}

// Wait for DOM ready
export function ready(fn) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}
