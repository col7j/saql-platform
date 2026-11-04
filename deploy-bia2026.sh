#!/bin/zsh
# يبني حفل ختام «بيئات التطوع 2026» وينشره في المجلد الفرعي bia2026/ من GitHub Pages (فرع gh-pages)
# دون المساس ببقية الموقع: يأخذ gh-pages الحالي كما هو ويستبدل bia2026/ وحده.
# الاستخدام: ./deploy-bia2026.sh   ← https://col7j.github.io/saql-platform/bia2026/
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
GH="${GH:-$HOME/.local/gh-cli/gh_2.102.1_macOS_arm64/bin/gh}"
REPO=https://github.com/col7j/saql-platform.git
OUT="$(mktemp -d)"
CRED=(-c credential.helper= -c "credential.helper=!$GH auth git-credential")

cd "$ROOT/app"
npm run build:bia2026
# صفحة الحفل تصير index.html في مجلده
mv dist-bia2026/bia2026.html dist-bia2026/index.html

# الموقع الحالي كاملاً، ثم مجلد الحفل الجديد مكان القديم
git -C "$ROOT" "${CRED[@]}" fetch -q "$REPO" gh-pages
git -C "$ROOT" archive FETCH_HEAD | tar -x -C "$OUT"
before=$(cd "$OUT" && find . -path ./bia2026 -prune -o -type f -print | wc -l | tr -d ' ')
rm -rf "$OUT/bia2026"
mkdir -p "$OUT/bia2026"
cp -R dist-bia2026/. "$OUT/bia2026/"
touch "$OUT/.nojekyll"
after=$(cd "$OUT" && find . -path ./bia2026 -prune -o -type f -print | wc -l | tr -d ' ')
[[ "$before" == "$after" ]] || { echo "تغيّر عدد ملفات بقية الموقع ($before ← $after)، أوقفت النشر"; exit 1; }

cd "$OUT"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email)" commit -q -m "نشر حفل bia2026 من $(git -C "$ROOT" rev-parse --short HEAD) (بقية الموقع كما هي)"
git "${CRED[@]}" push -q -f "$REPO" gh-pages
"$GH" api -X POST repos/col7j/saql-platform/pages/builds --jq .status
rm -rf "$OUT"
echo "نُشر الحفل على https://col7j.github.io/saql-platform/bia2026/"
