#!/bin/sh
# Renders the preview and share images from share-src/build/*.html (made by build.py):
# assets/og-en.png, assets/og-es.png and assets/share/{story,square}-{en,es}.png.
# Needs Google Chrome and ffmpeg. Run from anywhere: sh share-src/render.sh
set -e
cd "$(dirname "$0")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PROFILE="$(mktemp -d)"
mkdir -p ../assets/share

render() { # source width height output
  "$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 --user-data-dir="$PROFILE" \
    --window-size="$2,$3" --virtual-time-budget=3000 --screenshot="$4.full.png" "file://$PWD/build/$1.html" 2>/dev/null
  # 128-colour palette keeps each PNG well under 600 KB
  ffmpeg -v error -y -i "$4.full.png" \
    -vf "split[a][b];[a]palettegen=max_colors=128:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a" "$4"
  rm "$4.full.png"
}

for lang in en es; do
  render "og-$lang" 1200 630 "../assets/og-$lang.png"
  render "story-$lang" 1080 1920 "../assets/share/story-$lang.png"
  render "square-$lang" 1080 1080 "../assets/share/square-$lang.png"
done
rm -rf "$PROFILE"
