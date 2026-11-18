#!/bin/sh
# Cloudflare Pages build: copy only the public website files into ./public
# (keeps README, SQL files and source notes off the live site).
# Optional: set SITE_URL in Cloudflare (e.g. https://heja.pages.dev or your own domain)
# so links for Google and social previews use the right address.
set -e
rm -rf public && mkdir public
cp -r assets index.html help.html admin.html styles.css admin.css app.js admin.js config.js \
  products.js i18n.js i18n-fa.js size-chart.js manifest.webmanifest robots.txt sitemap.xml _headers public/
if [ -n "$SITE_URL" ]; then
  SITE_URL=${SITE_URL%/}
  for f in public/index.html public/help.html public/sitemap.xml public/robots.txt; do
    sed -i "s#https://heja-store.vercel.app#$SITE_URL#g" "$f"
  done
fi
echo "Built $(find public -type f | wc -l) files"
