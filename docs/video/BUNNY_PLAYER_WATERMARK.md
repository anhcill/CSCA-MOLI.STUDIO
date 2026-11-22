# Bunny fullscreen and viewer watermark

1. Open Stream > library 779163 > Player / Player Settings.
2. Enable the Fullscreen control. Keep Picture-in-Picture and AirPlay disabled.
3. Find Custom head HTML / Custom CSS. Back up existing custom code, then append
   the entire contents of `tools/video/bunny-player-custom-head.html` (including
   style and script tags). Do not replace existing customizations blindly.
4. Save, reload the website, and open the admin demo preview. The small viewer code
   should appear once at top left, including after using Bunny's fullscreen button.
5. Test desktop, Android and iPhone. The embed forces inline iOS playback to avoid
   native video-only fullscreen, which cannot contain HTML watermarks.

The script supports the documented new `media-controller` and legacy `.plyr`
containers. It accepts messages only from the embedding parent on the two production
domains, inserts plain text, and contains no API keys. No data is sent to another
service. The website retains its external corner watermark until the iframe confirms
installation, but that fallback does not follow Bunny into fullscreen.

This is a client-side deterrent, not DRM or a tamper-proof forensic watermark.
The Bunny dashboard configuration must be installed before relying on the watermark
in fullscreen. Actual provider/device behavior must be verified after saving it.

Reference: https://bunny.net/docs/stream/custom-head-html-migration-guide
