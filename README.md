# MindAR Starter

This workspace now contains a minimal image-tracking AR demo using MindAR and Three.js.

## Run it

1. Install the existing frontend dependency:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Open the local URL in a browser that has camera access.
4. Click **Start camera** and allow camera permission.
5. Open the sample target image from the UI and point the camera at it.

## Use your own image target

1. Open the MindAR compiler: https://hiukim.github.io/mind-ar-js-doc/tools/compile
2. Upload your image.
3. Download the generated `.mind` file.
4. Replace the `TARGETS_URL` value in `src/main.js` with your own local or hosted `.mind` file.

## Note on installation

The MindAR npm package currently fails in this specific Windows + Node 24 environment because a native `canvas` dependency attempts a local build. This starter uses the docs-supported browser distribution instead, which avoids that blocker and still gives you a working AR setup.