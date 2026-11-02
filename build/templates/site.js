// Press "/" anywhere to jump to the search field
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
