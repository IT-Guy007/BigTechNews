#!/usr/bin/env bash
# One-time migration: move data/ from main to its own `data` branch.
#
#   1. Creates the `data` branch with data/ at its root, keeping its history
#      (git subtree split; falls back to a single snapshot commit if git-subtree
#      is not installed)
#   2. Pushes the `data` branch
#   3. Removes data/ from main (it stays ignored via .gitignore) and pushes main
#   4. Re-attaches ./data locally as a git worktree of the `data` branch
#
# Run from the repo root, on main, with the scraper/redesign commits applied.
set -euo pipefail

REMOTE="${REMOTE:-origin}"

die() { echo "✗ $*" >&2; exit 1; }

[ -d .git ] || die "Run this from the repository root."
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || die "Check out main first."
git diff --quiet && git diff --cached --quiet || die "Commit or stash your changes first."
git ls-files --error-unmatch data/index.json >/dev/null 2>&1 || die "data/ is not tracked on main (already migrated?)."
grep -qx 'data/' .gitignore || die ".gitignore must contain 'data/' (apply the patches first)."
if git ls-remote --exit-code --heads "$REMOTE" data >/dev/null 2>&1; then
  die "Branch 'data' already exists on $REMOTE."
fi

echo "→ Updating main from $REMOTE"
git pull --rebase "$REMOTE" main

echo "→ Creating the data branch"
git branch -D data >/dev/null 2>&1 || true
if git subtree --help >/dev/null 2>&1; then
  git subtree split --prefix=data -b data
  echo "  history of data/ preserved"
else
  tree="$(git rev-parse HEAD:data)"
  commit="$(git commit-tree "$tree" -m "Data snapshot from main $(git rev-parse --short HEAD)")"
  git branch data "$commit"
  echo "  git-subtree not available: created a single snapshot commit"
fi
git ls-tree --name-only data | grep -qx index.json || die "data branch does not contain index.json at its root."

echo "→ Pushing the data branch"
git push -u "$REMOTE" data

echo "→ Removing data/ from main"
git rm -r -q --cached data
git commit -q -m "Move scraped data to the data branch

The scraper and site build now check out the data branch into ./data."
git push "$REMOTE" main

echo "→ Re-attaching ./data as a worktree of the data branch"
rm -rf data
git worktree add data data

echo
echo "✅ Done. main holds code only; scraped data lives on the 'data' branch."
echo "   Next: run the 'Big Tech News Digest' workflow manually with mode 'rescore'."
