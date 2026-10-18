#!/bin/sh
# Builds the app and publishes dist/ to the gh-pages branch (GitHub Pages "deploy from branch").
# Usage: sh deploy/publish.sh   (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local if present)
set -eu
cd "$(dirname "$0")/.."
REPO_NAME=$(basename "$(git rev-parse --show-toplevel)")
REPO_NAME="$REPO_NAME" npm run build
cp dist/index.html dist/404.html
touch dist/.nojekyll
cd dist
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -f "$(git -C .. remote get-url origin)" gh-pages
rm -rf .git
echo "Publicado em https://$(gh api user -q .login).github.io/$REPO_NAME/"
