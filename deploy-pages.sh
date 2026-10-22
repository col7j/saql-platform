#!/bin/zsh
# يبني النموذج وينشره على GitHub Pages (فرع gh-pages)
# الاستخدام: ./deploy-pages.sh
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
GH="${GH:-$HOME/.local/gh-cli/gh_2.102.1_macOS_arm64/bin/gh}"
OUT="$(mktemp -d)"

cd "$ROOT/app"
npm run build
cp -R dist/. "$OUT/"
touch "$OUT/.nojekyll"

cd "$OUT"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email)" commit -q -m "نشر $(git -C "$ROOT" rev-parse --short HEAD)"
git -c credential.helper= -c "credential.helper=!$GH auth git-credential" push -q -f https://github.com/col7j/saql-platform.git gh-pages
"$GH" api -X POST repos/col7j/saql-platform/pages/builds --jq .status
rm -rf "$OUT"
echo "نُشر على https://col7j.github.io/saql-platform/"
