// Projects / Core Values tabs. Without JS both panels simply show in order.
(() => {
  const list = document.querySelector('.tabs');
  if (!list) return;
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
  let current = -1;

  function select(i, { focus = false, url = false } = {}) {
    if (i === current) return false;
    current = i;
    tabs.forEach((t, j) => {
      const on = j === i;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      panels[j].hidden = !on;
    });
    // the hero legend lists whatever the open tab holds
    document.querySelectorAll('.legend [data-for]').forEach(el => { el.hidden = el.dataset.for !== panels[i].id; });
    list.dataset.active = i;
    if (focus) tabs[i].focus();
    if (url) history.replaceState(null, '', i ? '#' + panels[i].id : location.pathname + location.search);
    return true;
  }

  // Open the panel that holds the #target (station links, legend, shared URLs).
  function follow(behavior) {
    const id = decodeURIComponent(location.hash.slice(1));
    const el = id && document.getElementById(id);
    const i = el ? panels.findIndex(p => p.contains(el)) : -1;
    if (i < 0) return select(current < 0 ? 0 : current);
    if (select(i) || behavior === 'instant') el.scrollIntoView({ behavior });
  }

  tabs.forEach((t, i) => t.addEventListener('click', () => select(i, { url: true })));
  list.addEventListener('keydown', e => {
    const k = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    const n = tabs.length;
    const i = k === 'first' ? 0 : k === 'last' ? n - 1 : (current + k + n) % n;
    select(i, { focus: true, url: true });
  });
  window.addEventListener('hashchange', () => follow('smooth'));

  list.hidden = false;
  follow(location.hash ? 'instant' : undefined);
})();
