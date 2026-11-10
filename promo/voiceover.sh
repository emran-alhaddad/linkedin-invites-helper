#!/bin/sh
# Adds narration (Microsoft neural voice via edge-tts, British "Ryan", relaxed pace) to the rendered promo.
# Needs uv (runs edge-tts with uvx). VOICE / RATE env vars override the defaults.
# Usage: sh promo/voiceover.sh dist/linkedin-invites-helper-promo.mp4 dist/linkedin-invites-helper-promo-voice.mp4
set -e
IN=$1; OUT=$2; TMP=$(mktemp -d)
VOICE=${VOICE:-en-GB-RyanNeural}; RATE=${RATE:--8%}
# start-second|line  (timed to the captions in promo.html)
cat > "$TMP/lines" <<'L'
0.4|Got hundreds of LinkedIn invitations waiting?
5.5|Accepting them one by one is slow, and honestly, boring.
12.3|LinkedIn Invites Helper adds two buttons, right on your invitations page.
20.4|Just click Accept all, confirm, and that's it.
27.0|It works through every invitation at a safe, human pace, with short breaks, and it slows down if LinkedIn pushes back.
40.3|Got thousands? It stops at fifteen hundred a day.
46.6|Next day, it picks up right where it left off.
51.3|No tracking. No servers.
56.2|Free, on the Chrome Web Store.
L
i=0; ARGS=""; MIX=""
while IFS='|' read -r at line; do
  uvx --quiet edge-tts@latest --voice "$VOICE" --rate="$RATE" --text "$line" --write-media "$TMP/$i.mp3" 2>/dev/null
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/$i.mp3")
  echo "at $at  len ${d}s  $line"
  ARGS="$ARGS -i $TMP/$i.mp3"
  ms=$(echo "$at*1000/1" | bc)
  MIX="$MIX[$((i+1)):a]adelay=${ms}|${ms}[a$i];"
  i=$((i+1))
done < "$TMP/lines"
LABELS=$(seq 0 $((i-1)) | sed 's/^/[a/; s/$/]/' | tr -d '\n')
ffmpeg -loglevel error -y -i "$IN" $ARGS -filter_complex "${MIX}${LABELS}amix=inputs=$i:normalize=0,loudnorm=I=-16:TP=-1.5,apad[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT"
rm -rf "$TMP"
echo "wrote $OUT"
