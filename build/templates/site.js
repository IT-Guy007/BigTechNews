// Big Tech News — shared page behaviour

// ---------- "/" jumps to the search field ----------
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  const input = document.getElementById('q');
  if (!input) return;
  e.preventDefault();
  input.focus();
  input.select();
});

// ---------- New since your last visit ----------
// A "visit" ends after 30 minutes without opening a page. Stories published after the
// previous visit get a "New" badge; reloading during the same visit keeps the badges.
window.BTN = (function () {
  const KEY_SEEN = 'btn:seenUntil';   // stories published before this are "read"
  const KEY_LAST = 'btn:lastPageView';
  const SESSION_GAP = 30 * 60 * 1000;

  const store = {
    get(k) { try { const v = Number(localStorage.getItem(k)); return Number.isFinite(v) && v > 0 ? v : 0; } catch { return 0; } },
    set(k, v) { try { localStorage.setItem(k, String(v)); } catch { /* private mode: no markers */ } }
  };

  const now = Date.now();
  let seenUntil = store.get(KEY_SEEN);
  const lastView = store.get(KEY_LAST);
  if (lastView && now - lastView > SESSION_GAP) {
    // New visit: everything up to the end of the previous visit counts as read
    seenUntil = lastView;
    store.set(KEY_SEEN, seenUntil);
  }
  store.set(KEY_LAST, now);
  const firstVisit = !seenUntil;

  function isNew(published) {
    if (firstVisit || !published) return false;
    const t = new Date(published).getTime();
    return Number.isFinite(t) && t > seenUntil && t <= now + 5 * 60 * 1000;
  }

  function badge() {
    const b = document.createElement('span');
    b.className = 'badge badge-new';
    b.textContent = 'New';
    return b;
  }

  function mark(el) {
    if (el.classList.contains('is-new')) return;
    el.classList.add('is-new');
    const line = el.querySelector('.kicker, .meta, .result-date');
    if (line) line.prepend(badge(), ' ');
  }

  function markAll(root) {
    let count = 0;
    (root || document).querySelectorAll('[data-published]').forEach((el) => {
      if (isNew(el.dataset.published)) { mark(el); count++; }
    });
    return count;
  }

  function lastVisitLabel() {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
      .format(new Date(seenUntil));
  }

  function markAllRead() {
    seenUntil = now;
    store.set(KEY_SEEN, now);
    document.querySelectorAll('.is-new').forEach((el) => {
      el.classList.remove('is-new');
      el.querySelectorAll('.badge-new').forEach((b) => b.remove());
    });
    const banner = document.getElementById('new-banner');
    if (banner) banner.hidden = true;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const count = markAll(document);
    const banner = document.getElementById('new-banner');
    if (banner && count > 0) {
      document.getElementById('new-banner-text').textContent =
        `${count} new ${count === 1 ? 'story' : 'stories'} on this page since your last visit (${lastVisitLabel()})`;
      banner.hidden = false;
      document.getElementById('mark-read').addEventListener('click', markAllRead);
    }
  });

  return { isNew, badge };
})();
