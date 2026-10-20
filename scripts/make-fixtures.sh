#!/usr/bin/env bash
# Generates small test videos into tests/fixtures/ with a native ffmpeg
# (one built with libx264, libx265 and the native AAC encoder; the Ubuntu
# package works). The files imitate what an iPhone produces: HEVC tagged
# "hvc1", variable frame rate, AAC audio, rotation metadata.
set -euo pipefail

out="$(dirname "$0")/../tests/fixtures"
mkdir -p "$out"
cd "$out"

ff() { ffmpeg -hide_banner -loglevel error -y "$@"; }

# A portrait screen recording: HEVC + AAC, variable frame rate (whole runs of
# frames are missing, as when the screen does not change).
ff -f lavfi -i "testsrc2=size=590x1278:rate=60:duration=3" \
  -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=3" \
  -vf "select='lt(mod(n\,60)\,24)+eq(mod(n\,7)\,0)'" -fps_mode vfr \
  -c:v libx265 -preset ultrafast -x265-params log-level=error -pix_fmt yuv420p -tag:v hvc1 \
  -c:a aac -ac 2 -b:a 96k -shortest -movflags +faststart \
  hevc-screen.mp4

# HEVC without audio in a MOV, stored landscape with a 90° rotation flag.
ff -f lavfi -i "testsrc2=size=480x270:rate=30:duration=2" \
  -c:v libx265 -preset ultrafast -x265-params log-level=error -pix_fmt yuv420p -tag:v hvc1 \
  hevc-noaudio-unrotated.mov
ff -display_rotation 90 -i hevc-noaudio-unrotated.mov -c copy hevc-noaudio.mov
rm hevc-noaudio-unrotated.mov

# Already H.264 + AAC: should be repackaged without re-encoding.
ff -f lavfi -i "testsrc2=size=640x360:rate=30:duration=2" \
  -f lavfi -i "sine=frequency=660:sample_rate=48000:duration=2" \
  -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 96k -shortest \
  h264-aac.mov

# H.264 that many players cannot play (4:4:4) with odd dimensions: must be
# re-encoded, and the size made even for yuv420p.
ff -f lavfi -i "testsrc2=size=320x180:rate=30:duration=2" \
  -vf "format=yuv444p,crop=301:161:0:0" -c:v libx264 -preset ultrafast -pix_fmt yuv444p \
  h264-yuv444-odd.mp4

# A longer HEVC clip, used to test cancelling.
ff -f lavfi -i "testsrc2=size=720x1280:rate=30:duration=40" \
  -f lavfi -i "sine=frequency=330:sample_rate=44100:duration=40" \
  -c:v libx265 -preset ultrafast -x265-params log-level=error -pix_fmt yuv420p -tag:v hvc1 \
  -c:a aac -b:a 64k -shortest \
  hevc-long.mp4

# Audio only, but named .mp4: there is no video stream to convert.
ff -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=1" -c:a aac audio-only.mp4

# A truncated MP4 whose index ("moov") is missing.
ff -f lavfi -i "testsrc2=size=320x240:rate=30:duration=2" \
  -c:v libx265 -preset ultrafast -x265-params log-level=error -tag:v hvc1 full.mp4
head -c 20000 full.mp4 > broken.mp4
rm full.mp4

printf 'this is not a video\n' > not-a-video.txt

ls -l
