#!/bin/zsh
# يبني النموذج وينشره على GitHub Pages (فرع gh-pages)
# الاستخدام: ./deploy-pages.sh
# يحتفظ بالمجلدات الفرعية للحفلات المنشورة في gh-pages (مثل bia2026/) فلا يمسحها نشر «صقل».
# SRC=<مسار نسخة أخرى من المستودع> يبني منها بدل هذه النسخة (مثل نسخة main)
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="${SRC:-$ROOT}"
GH="${GH:-$HOME/.local/gh-cli/gh_2.102.1_macOS_arm64/bin/gh}"
REPO=https://github.com/col7j/saql-platform.git
KEEP=(bia2026)
OUT="$(mktemp -d)"
CRED=(-c credential.helper= -c "credential.helper=!$GH auth git-credential")

cd "$SRC/app"
npm run build
cp -R dist/. "$OUT/"
touch "$OUT/.nojekyll"

# مجلدات الحفلات الأخرى من gh-pages الحالي كما هي
git -C "$ROOT" "${CRED[@]}" fetch -q "$REPO" gh-pages
for d in $KEEP; do
  if git -C "$ROOT" cat-file -e "FETCH_HEAD:$d" 2>/dev/null; then
    git -C "$ROOT" archive FETCH_HEAD "$d" | tar -x -C "$OUT"
    echo "أُبقي المجلد $d/"
  fi
done

cd "$OUT"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email)" commit -q -m "نشر $(git -C "$SRC" rev-parse --short HEAD)"
git "${CRED[@]}" push -q -f "$REPO" gh-pages
"$GH" api -X POST repos/col7j/saql-platform/pages/builds --jq .status
rm -rf "$OUT"
echo "نُشر على https://col7j.github.io/saql-platform/"
