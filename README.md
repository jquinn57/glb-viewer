# Ring Viewer

A client-only prototype with two modes: a Three.js GLB ring viewer and a live MediaPipe hand tracker with an AR ring overlay. Use the selector in the header to switch between them. The Ring Viewer loads the supplied ring GLB without replacing its materials, lights it with a high-dynamic-range studio environment, and exports high-resolution PNG snapshots from the current camera pose. Hand Tracking combines the live camera, landmarks, diagnostic pose guide, the same GLB ring, and a depth-only finger proxy.

The Ring Viewer and AR overlay are **real-time rasterized PBR renderers, not path tracers**.

## Quick start

Requirements: Node.js 20.19+ or 22.12+ and a current browser with WebGL2 enabled.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (including its `/glb-viewer/` path). For a production check:

```bash
npm run build
npm run preview
```

The project directly depends on `@mediapipe/tasks-vision` 1.0.1. The first visit to Hand Tracking downloads the pinned MediaPipe WASM runtime and hand-landmarker model, so that mode needs an internet connection unless those assets are hosted locally in a future deployment.

## Hand Tracking

Choose **Hand Tracking** in the application header and allow camera access when the browser asks. The app prefers the rear (`environment`) camera, requests an ideal 1280 × 720 stream, and lets the browser select another supported resolution. **Use front/rear camera** restarts the stream with the other facing-mode preference. Front-camera previews and their overlay are mirrored together; rear-camera previews are not mirrored.

The debug panel reports the negotiated camera resolution, detected handedness and confidence, approximate inference FPS, selected-finger MCP landmark, and estimated guide width. Full raw MediaPipe results—including normalized landmarks with Z, world landmarks, and handedness categories—remain available through the optional `onHandResult` callback on `HandTrackingView`. The temporally filtered result is independently available through `onSmoothedHandResult`, and the estimated guide through `onRingGuide`. Results are not placed in React state every frame; only the throttled diagnostics are.

**Temporal smoothing** applies a frame-rate-independent exponential moving average to every normalized and world landmark before drawing landmarks or estimating the guide. The slider ranges from 0% (raw and most responsive) to 95% (most stable with more lag), with an 85% default. The filter resets when the hand disappears, the detected hand count changes, the camera changes, or there is a long frame gap, preventing stale landmarks from dragging a newly detected hand into place.

The ring can target the index, middle, ring, or pinky finger, or be turned off. Its natural center starts 55% of the way from MCP to PIP, and its cross-finger orientation is exactly perpendicular to that line in image space. The base diameter blends palm width and palm length, then applies a small per-finger proportion. **Ring scale multiplier** starts at 1.4× and scales that estimate from 60–150%; **Position offset** remains centered at zero and moves the ring and guide ±30% of the MCP→PIP length toward the palm or fingertip. **Finger radius** starts at 1.25× and can be tuned up to 2×. These controls never restart the camera or MediaPipe detector.

## AR ring rendering

The camera stage contains three exactly matched layers: video, a transparent React Three Fiber canvas, and the optional 2D landmark/pose overlay. For a front-facing camera, all three complete layers are mirrored together in CSS; tracking and Three.js transforms remain unmirrored internally.

The orthographic AR camera uses video pixels as world units. The explicit conversion in `poseToThreeTransform.ts` maps MediaPipe/canvas +X right and +Y down into Three camera-space +X right and +Y up. MediaPipe's smaller-Z-is-closer convention is inverted so Three +Z points toward the camera. The tracked MCP→PIP direction becomes the ring asset's local +Z hole axis. Local +Y—the gemstone direction—is projected toward the camera while remaining perpendicular to the finger. This image-relative projection is isolated so a calibrated perspective camera can replace it later.

The GLB is reused through Drei's loader cache. At load time, `TrackedRingAsset` finds the `Band` object, centers the wrapper on the band rather than the gemstone-inclusive bounding box, and normalizes the band's XY outer diameter to one unit. The asset convention is local +Z through the ring hole and local +Y toward the gemstone. Per-frame tracking only changes the outer tracked group's position, quaternion, and scale; it does not reload or rebuild the model.

Ring scale is the estimated pixel-space diameter multiplied by the user scale control. The proxy uses the same base scale: its proximal radius is 0.40 and distal radius 0.34 of the estimated ring diameter, multiplied by **Finger radius**. Its length follows the selected finger's MCP→PIP distance, including the estimated MediaPipe depth delta. The proxy is a tapered cylinder aligned to the same local +Z finger axis.

The proxy depth prepass has `colorWrite=false`, `depthWrite=true`, `depthTest=true`, is double-sided, and uses render order −100; ring meshes use render order 10. The proxy therefore remains invisible but occludes the part of the GLB behind the finger through the ordinary depth buffer. **Finger occluder debug** adds a cyan, translucent X-ray copy at render order 100 while keeping the depth-only proxy active, so its placement remains obvious even where the ring would normally hide it. A binary segmentation mask could improve the hand silhouette later, but cannot determine by itself whether a hand pixel is in front of or behind the ring; the coarse 3D proxy supplies that relationship.

The AR controls independently toggle the ring, landmarks, raw pose axes/line guide, and proxy debug view. Landmark smoothing happens before estimation. A second **AR pose smoothing** pass uses position lerp, scale lerp, and quaternion slerp—never Euler interpolation. The raw post-landmark-filter pose remains visible through the debug axes while the ring and proxy use the additional smoothed transform. Tracking loss hides all tracked 3D content.

Current visual limitations are the uncalibrated orthographic camera, heuristic finger radius/depth, and the coarse cylinder silhouette. Because the real video is a separate DOM layer rather than a Three.js texture, transmissive gems cannot refract the camera image yet. Recommended improvements are calibrated perspective projection, better finger geometry, an optional hand-segmentation silhouette combined with the depth proxy, device-depth support where available, camera-derived environment lighting, adaptive temporal pose filtering, and higher-quality AR frame capture.

MediaPipe resources are loaded from pinned hosted URLs:

- WASM runtime: jsDelivr's copy of `@mediapipe/tasks-vision@1.0.1`
- Model: Google's `hand_landmarker` float16 task, version 1

The landmarker uses `VIDEO` mode with one hand and 0.5 detection, presence, and tracking confidence thresholds. It tries the GPU delegate first and falls back to CPU if GPU initialization fails. Inference runs from a single `requestAnimationFrame` loop and skips repeated `video.currentTime` values, so a display refresh does not cause duplicate inference on the same camera frame.

### Camera security and device testing

Camera APIs require a secure browser context. `http://localhost` works for desktop development, but opening the Vite server from a phone at a plain `http://192.168.x.x:...` LAN address will generally not expose `getUserMedia`. For smartphone testing, serve the app over HTTPS (for example through a trusted local HTTPS setup or an HTTPS deployment), then open that URL in current Android Chrome or iOS/iPadOS Safari and grant camera permission.

Known browser constraints:

- A denied permission must be re-enabled in the browser/site settings before another request can succeed.
- Camera choice is a facing-mode preference, not a hard device selection; browsers may use the only available camera or ignore the preference.
- Another application holding the camera can make the stream unavailable.
- WASM/model loading is subject to connectivity, CDN availability, and restrictive content-security policies.
- Browser-level camera testing and inference FPS measurement require physical camera access and cannot be verified by the command-line build.

Leaving Hand Tracking cancels its animation frame, stops every stream track, pauses and detaches the video, clears the canvas, and closes the Hand Landmarker. Returning to Ring Viewer creates only the existing R3F canvas; switching back starts a fresh camera session without retaining the previous stream.

The current data flow is:

```text
camera → MediaPipe → ring pose estimator ┬→ 2D landmarks/pose guide
                                         └→ transparent Three.js scene
                                              ├── normalized GLB ring
                                              ├── HDR reflections
                                              └── depth-only finger proxy
```

Detection, pose conversion, model normalization, and rendering remain separate so future camera calibration, better finger geometry, segmentation masks, device depth, and environment-light estimation can be introduced independently.

## Assets

Static assets live under `public/` and are served from root-relative URLs:

```text
public/
  models/
    ring.glb
  environments/
    studio.exr
```

The supplied files have already been copied into those locations:

- `Ring_VTO_Test_V2.glb` → `public/models/ring.glb`
- `brown_photostudio_01_4k.exr` → `public/environments/studio.exr`

An EXR is used instead of an RGBE `.hdr` because that is the provided high-dynamic-range source. Drei/Three.js supports both formats. To substitute another environment, update `ENVIRONMENT_URL` in `src/App.tsx` (or use the same `studio.exr` filename).

If either asset is absent, the UI lists the exact expected path and offers a retry rather than leaving a blank canvas. Loader or WebGL failures also render an understandable error state.

## GitHub Pages deployment

The workflow at `.github/workflows/pages.yml` runs lint and a production build for pull requests. On a push to `main` (or a manual workflow run), it uploads `dist/` as a Pages artifact and deploys it to the `github-pages` environment.

The Vite base path is `/glb-viewer/`, matching a repository hosted at:

```text
https://<github-user>.github.io/glb-viewer/
```

After pushing the repository to GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**. No deployment branch or personal access token is required; the workflow uses GitHub's Pages OIDC permissions.

## Rendering

The scene is built with React Three Fiber and Drei on Three.js's WebGL renderer:

- The GLB is loaded with `useGLTF`; its original mesh materials and relative dimensions are retained.
- A world-space bounding box centers the model and drives camera distance, clipping planes, OrbitControls limits, light placement, and the ground-plane position/size.
- The EXR is prefiltered for image-based lighting and can optionally remain visible as the background. Turning the environment background off does not remove its reflections or lighting.
- ACES filmic tone mapping and sRGB output are used. Interactive pixel ratio is capped at 2×.
- The neutral ground is nonmetallic with moderate roughness. Supplemental direct lights and soft shadows are disabled by default so the HDR-only result can be evaluated first.
- The optional Drei performance meter and WebGL/material diagnostics keep profiling lightweight. Renderer/GPU information, model dimensions, resource timing, and important material fields are written to the browser console.

Controls are left-drag to orbit, wheel/pinch to zoom, and right-drag to pan. Reset Camera derives a fresh framing from the loaded model instead of assuming units or orientation.

## Snapshot export

Render Snapshot creates a separate multisampled `WebGLRenderTarget` at 1024, 2048, or 4096 square pixels. It clones the current perspective camera, preserving its position and orientation, and adjusts only the clone's aspect for the square output. The live renderer and canvas are never resized. Pixels are read back, vertically corrected, encoded as PNG, and downloaded locally.

The export function is isolated in `src/rendering/snapshot.ts`. A future path-traced exporter can implement the same `SnapshotRenderer` callback while the interactive R3F viewer, OrbitControls, and current camera pose remain unchanged.

## Supplied material notes

The viewer deliberately does not “fix” material values at runtime. The current GLB declares:

- `MAT_DIAMOND`: metallic 0, roughness approximately 0.023, transmission 1, `KHR_materials_ior` at approximately 2.417, and `KHR_materials_specular`; it does not declare volume/thickness or dispersion.
- `MAT_18K_GOLD`: metallic 0, roughness approximately 0.082, and `KHR_materials_specular`; despite its name, the exported material does not currently use metallic workflow (`metallicFactor` is 0).

Those source values allow the diamond to use Three.js transmission and IOR, but without volume/thickness its refraction remains limited; the gold behaves as a dielectric rather than a metal. These are asset-authoring limitations, not silent viewer overrides. Adding appropriate volume data and correcting the gold's metallic factor are the first fidelity improvements to make.

## Raster rendering limitations

Three.js `MeshPhysicalMaterial` can represent glTF metallic/roughness, transmission, IOR, volume, and—when exported through supported glTF extensions—dispersion. It still cannot reproduce a Cycles jewelry render exactly:

- Transmission is a real-time approximation and lacks the physically complete multi-bounce light transport of a path tracer.
- Diamond internal reflection, caustics, facet-to-facet refraction, spectral dispersion/fire, and nested dielectric behavior are limited or absent.
- Shadows from transmissive objects and energy passing through the stone are not physically solved.
- Results depend heavily on mesh quality, correct normals, material export, and the dynamic range/content of the environment.

Obvious next steps are to correct the GLB's exported gold/diamond properties, test a cleaner high-contrast jewelry HDRI, tune tone exposure, add gem-specific dispersion where supported, and evaluate a path-traced snapshot implementation (for example, a Three.js-compatible GPU path tracer) behind the existing snapshot interface.

## Project structure

```text
src/
  App.tsx                         Mode selection, ring UI state, asset preflight
  components/
    CameraController.tsx         Model-aware camera and OrbitControls
    Ground.tsx                   Model-aware neutral floor
    RingModel.tsx                GLB loading, centering, diagnostics
    RingViewer.tsx               Canvas and scene composition
    SceneErrorBoundary.tsx       Friendly loader/render failures
    StudioEnvironment.tsx        EXR environment and IBL
    ViewerControls.tsx           Minimal control panel
    HandTracking/
      ARScene.tsx                 Transparent orthographic R3F scene
      CameraView.tsx             Matched video/canvas sizing and mirroring
      FingerOccluder.tsx         Tapered depth-only finger proxy
      HandLandmarkOverlay.tsx    Transparent landmark canvas
      HandTrackingView.tsx       Camera and inference lifecycle, diagnostics
      TrackedRingAsset.tsx       GLB reuse and local-axis normalization
  hooks/
    useAssetAvailability.ts      Missing-asset detection and retry
  handTracking/
    drawRingGuide.ts             Diagnostic ring-guide line renderer
    handOcclusion.ts             Extensible occlusion-source abstraction
    landmarkSmoothing.ts         Frame-rate-independent landmark smoothing
    poseToThreeTransform.ts      MediaPipe/canvas-to-Three conversion
    ringGuide.ts                 Finger placement and scale estimator
  mediapipe/
    drawHandLandmarks.ts         MediaPipe connector/landmark drawing
    handLandmarker.ts            Pinned runtime/model and detector options
    handLandmarkTypes.ts         Result callback and diagnostics types
  rendering/
    snapshot.ts                  Offscreen high-resolution PNG export
  styles/
    index.css
    viewer.css
```
