# Video Converter

[日本語](README.md) | **English**

**▶ [https://yosshu.github.io/video-converter/](https://yosshu.github.io/video-converter/?lang=en)**

A web app that converts iPhone screen recordings into **H.264 MP4** files that work on almost any computer.
Nothing to install and no sign-up: just open it in your browser.
The app is available in English and Japanese (switch at the top of the page).

## Why

iPhone screen recordings are often compressed with HEVC (H.265), even when the file ends in `.mp4`.
Some setups on Windows or Ubuntu cannot play these files, and tools such as Claude Code may not be able to read them.

This app converts them to H.264 + AAC MP4, which plays and loads almost everywhere.

## How to use

1. Open the URL above in your browser.
2. Press "Choose a video", or drag and drop a video onto the page.
   - On iPhone, choose "Photo Library" in the file picker to find your screen recordings.
3. Press "Start converting".
4. When it finishes, press "Download". The file is saved as `original-name_H264.mp4`.

You don't need to change any settings. The defaults keep on-screen text readable while keeping the file small.

## Features

- Converts HEVC (H.265) and other videos to H.264 + AAC MP4.
- Keeps the resolution, aspect ratio and audio. Videos without audio work too.
- Videos that are already H.264 are repackaged into MP4 without losing quality, so they finish in seconds.
- Compare the file size before and after, and preview the result in the browser.
- Optionally change the quality, resolution, frame rate, or remove the audio (under "Advanced settings").
- Shows progress and an estimate of the time left, and can be cancelled.

## Your video is not sent to any server

The video you choose is never sent to any server on the internet. The conversion runs on your own device.

- The only network traffic is loading the page and the converter (FFmpeg, about 31 MB).
- There is no analytics, and nothing collects your videos or file names.
- Metadata such as the recording location is left out of the converted video.

## Things to know

- **Keep the page open until the conversion finishes.** Closing or reloading it stops the conversion. On phones and tablets, locking the screen or switching to another app can stop it too.
- **It takes time.** Depending on your device, it can take several times the length of the video.
- **Large videos may fail.** The limit is 2 GB (on phones, around 500 MB is a safer guide). If it runs out of memory, lower the resolution in "Advanced settings", or trim the video first.
- The first time, the converter (about 31 MB) is downloaded. Keep this in mind on mobile data.
- HDR videos (such as videos from the iPhone camera) may look washed out after conversion.
- Use an up-to-date version of Chrome, Edge, Safari or Firefox.

## Software used

The conversion is done with [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm).

| Name | Version | License |
| --- | --- | --- |
| @ffmpeg/ffmpeg | 0.12.15 | MIT |
| @ffmpeg/core (FFmpeg 5.1.4, x264 and others) | 0.12.10 | GPL-2.0-or-later |

Details of the bundled libraries and where to get their source code are on the [licenses page](https://yosshu.github.io/video-converter/licenses.html?lang=en) (linked at the bottom of the app).
