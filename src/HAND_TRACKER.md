Extend the existing Vite + React + TypeScript + React Three Fiber / Three.js ring-viewer prototype with a second application mode for live camera hand tracking.

Do not replace or substantially rewrite the existing ring viewer. The application should now have two separate modes:

1. **Ring Viewer**
   - Existing Three.js / React Three Fiber GLB rendering functionality.
   - Preserve all existing functionality.

2. **Hand Tracking**
   - Live camera feed.
   - MediaPipe Hand Landmarker running continuously.
   - 2D hand landmarks and hand connections drawn over the live video.

For now, DO NOT render the ring on the hand and do not integrate Three.js with the camera view. The purpose of this step is to establish reliable real-time camera capture and hand landmark detection.

However, structure the hand-tracking code so that landmark results can later be consumed by the Three.js ring renderer without rewriting the MediaPipe pipeline.

## Dependencies

Use the current MediaPipe Tasks Vision web package:

```bash
npm install @mediapipe/tasks-vision
```

Use the MediaPipe **Hand Landmarker** task.

Use this MediaPipe sample as a reference for the intended API and landmark visualization:

https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/tasks/hand-landmarker.ts

Do not copy the sample application architecture wholesale. Adapt the MediaPipe functionality cleanly into the existing React application.

Use current MediaPipe Tasks Vision APIs rather than older/deprecated MediaPipe Hands APIs.

## Application mode selector

Add a simple mode selector near the top of the application:

```text
[ Ring Viewer ] [ Hand Tracking ]
```

or equivalent tabs/buttons.

The React state can conceptually be:

```ts
type AppMode = 'ring' | 'hand';
```

When `ring` is selected, show the existing ring viewer.

When `hand` is selected, show the new camera/hand-tracking component.

Do not run expensive rendering or camera processing unnecessarily in the inactive mode.

In particular:

- Stop/release the camera when leaving Hand Tracking mode.
- Stop the MediaPipe detection loop when leaving Hand Tracking mode.
- Avoid leaving duplicate `requestAnimationFrame` loops running after component unmount/remount.
- Preserve the existing Ring Viewer behavior when returning to it.

## Suggested organization

Extend the existing component structure approximately like:

```text
src/
  App.tsx

  components/
    RingViewer.tsx
    RingModel.tsx
    Environment.tsx
    Ground.tsx
    ViewerControls.tsx

    HandTracking/
      HandTrackingView.tsx
      CameraView.tsx
      HandLandmarkOverlay.tsx

  mediapipe/
    handLandmarker.ts
    handLandmarkTypes.ts

  rendering/
    snapshot.ts
```

The exact structure may differ if there is a cleaner implementation.

Keep MediaPipe initialization/detection logic separate from UI code where practical.

## Camera capture

Use the browser MediaDevices API:

```ts
navigator.mediaDevices.getUserMedia(...)
```

The live stream should be displayed in an HTML `<video>` element.

For desktop, use the available webcam.

For smartphones, prefer the rear/environment-facing camera:

```ts
video: {
  facingMode: { ideal: 'environment' }
}
```

Do not require an exact resolution initially, but request a reasonably high-quality stream.

For example, an ideal target around:

```text
1280 × 720
```

is reasonable.

Allow the browser/device to choose another supported resolution.

Set the video element appropriately for mobile use, including:

```html
autoplay
playsinline
muted
```

Do not use `mirror`/CSS horizontal flipping for the rear camera.

If a front-facing camera is used, it is acceptable to mirror the displayed preview, but ensure the landmark overlay uses the exact same transformation so landmarks remain aligned.

## Camera lifecycle

Request camera permission only when Hand Tracking mode is entered or when the user explicitly starts the camera.

Provide useful UI states:

```text
Initializing MediaPipe...
Requesting camera permission...
Camera active
No hand detected
Camera permission denied
Camera unavailable
MediaPipe initialization failed
```

When the Hand Tracking component unmounts:

- cancel the animation/detection loop
- stop every `MediaStreamTrack`
- detach the stream from the video element
- clean up MediaPipe resources where appropriate

Switching repeatedly between Ring Viewer and Hand Tracking must not create multiple camera streams or detection loops.

## MediaPipe Hand Landmarker

Initialize the MediaPipe Hand Landmarker once when Hand Tracking mode starts.

Use VIDEO running mode.

Initially configure:

```text
numHands: 1

minHandDetectionConfidence: 0.5
minHandPresenceConfidence: 0.5
minTrackingConfidence: 0.5
```

One hand is enough for this prototype because the eventual use case is placing a ring on one hand.

Keep these parameters easy to change.

Use the standard MediaPipe hand landmarker model.

It is acceptable either to:

1. load the model/WASM resources from the official MediaPipe-hosted resources, or
2. place them in `public/mediapipe/`

Prefer the simplest reliable implementation for this prototype.

Document whichever approach is used.

## Real-time inference loop

Run hand detection continuously while:

- Hand Tracking mode is active
- the video is ready
- MediaPipe has initialized

Use `requestAnimationFrame` for the outer loop.

Do not run inference multiple times on the same video frame.

Track something equivalent to:

```ts
let lastVideoTime = -1;
```

and only call the detector when:

```ts
video.currentTime !== lastVideoTime
```

Use MediaPipe's video inference API with an appropriate monotonically increasing timestamp.

Conceptually:

```ts
const result = handLandmarker.detectForVideo(
  video,
  performance.now()
);
```

Do not put per-frame landmark results into ordinary React state if doing so causes the entire React component tree to rerender at camera frame rate.

Prefer refs and direct canvas drawing for frame-by-frame visualization.

React state should be used for relatively slow-changing UI state such as:

- camera active/inactive
- MediaPipe ready
- error messages
- hand detected/not detected
- FPS

## Landmark overlay

Place a transparent HTML `<canvas>` directly over the `<video>`.

Conceptually:

```text
┌──────────────────────────────┐
│        video element         │
│                              │
│       ●──●                   │
│      /    \                  │
│     ●      ●   ← canvas      │
│      hand landmarks          │
│                              │
└──────────────────────────────┘
```

The video and canvas must occupy exactly the same displayed area.

Correctly account for:

- video intrinsic dimensions
- displayed dimensions
- aspect ratio
- CSS scaling
- mobile orientation

Do not stretch the video independently of the landmark canvas.

Use MediaPipe's `DrawingUtils` if appropriate.

Draw:

- all 21 hand landmarks
- MediaPipe's standard hand connections

Use clearly visible styling, similar to the MediaPipe sample:

```text
connections: green
landmarks: red
```

Exact colors are not important.

The important requirement is that landmarks remain accurately aligned with the hand while the hand moves.

## Preserve the raw MediaPipe result

Although this prototype only draws the landmarks, design the API so that the latest MediaPipe result is accessible separately from the visualization.

For example, the Hand Tracking component could eventually expose:

```ts
onHandResult?: (result: HandLandmarkerResult) => void
```

or use an equivalent abstraction.

Do NOT couple landmark detection directly to canvas drawing in a way that makes the result inaccessible elsewhere.

The eventual architecture should be able to become:

```text
Camera
   ↓
MediaPipe Hand Landmarker
   ↓
HandLandmarkerResult
   ├──→ 2D debug overlay
   │
   └──→ future ring pose estimator
              ↓
         Three.js ring
```

For now, only implement the first branch.

## Landmark information

MediaPipe results should retain:

- normalized image landmarks
- world landmarks, if provided
- handedness
- handedness confidence

Do not throw away the Z coordinate simply because the current overlay is 2D.

Later we will use combinations of landmarks to estimate:

- which finger should receive the ring
- ring position
- ring scale
- finger direction
- hand orientation
- ring orientation in 3D

No ring-pose estimation needs to be implemented yet.

## Debug display

Add a small optional debug panel showing something like:

```text
MediaPipe: Ready
Camera: 1280 × 720
Hand detected: Yes
Handedness: Right
Confidence: 0.97
Inference FPS: 28
```

If straightforward, also show the coordinates of a useful landmark such as the ring-finger MCP or PIP landmark.

Do not display all landmark coordinates continuously in the main UI.

Logging the complete result to the console occasionally for development is fine, but do not log every frame because that can significantly hurt performance.

## Performance

The goal is smooth real-time operation on both desktop and a modern smartphone.

Measure approximate inference FPS.

Do not artificially require MediaPipe inference to run at the full display refresh rate.

If inference becomes expensive, structure the code so it could later be throttled independently from rendering.

For the first implementation, running inference on the main thread is acceptable if performance is good.

However, keep MediaPipe logic isolated enough that it could later be moved to a Web Worker.

Do NOT add a worker in this first version unless it is clearly necessary.

## Mobile behavior

The page must work reasonably on:

- desktop Chrome
- Android Chrome
- iPhone/iPad Safari

Remember that camera access generally requires a secure context.

Document that:

```text
localhost
```

works for local desktop development, but accessing the Vite dev server from another device over plain HTTP using a LAN IP may prevent camera access.

Do not work around browser security restrictions.

Ensure the camera video uses `playsInline` so iOS does not force it into fullscreen video playback.

Use responsive layout so the camera view fits comfortably on a portrait phone.

## Camera selection

For the initial implementation, prefer the rear-facing camera automatically on mobile.

If it is straightforward, add a small:

```text
[ Switch Camera ]
```

button to toggle between front and rear cameras.

This is optional for the first pass.

Do not build a complicated device-selection UI yet.

## Snapshot

The existing Ring Viewer snapshot functionality should remain unchanged.

For Hand Tracking mode, optionally add a simple:

```text
Capture Frame
```

button if straightforward.

If implemented, it should capture:

1. the current camera image, and
2. optionally a second image containing the landmark overlay.

This is not required for the initial implementation.

Do not mix this with the existing high-resolution ring rendering snapshot functionality.

## Important separation of responsibilities

At this stage there should be two independent pipelines:

```text
MODE 1 — RING VIEWER

GLB
 ↓
Three.js / R3F
 ↓
interactive PBR ring rendering
```

and:

```text
MODE 2 — HAND TRACKING

camera
 ↓
HTML video
 ↓
MediaPipe Hand Landmarker
 ↓
landmark result
 ↓
2D canvas overlay
```

Do NOT yet do this:

```text
camera
 ↓
MediaPipe
 ↓
Three.js
 ↓
virtual ring on finger
```

That will be the next stage.

## Future compatibility

Keep in mind that the next milestone will probably use specific landmarks around the ring finger to calculate a Three.js transform.

For example, later code may use:

```text
ring finger MCP
ring finger PIP
ring finger DIP
adjacent finger landmarks
world landmarks
handedness
```

to estimate a position, orientation, and scale for the ring.

Therefore avoid building the hand tracking implementation as a self-contained demo whose only output is pixels drawn onto a canvas.

The landmark data is the important output.

## Existing project

Before making changes:

1. Inspect the existing application structure.
2. Preserve the existing Three.js/R3F viewer.
3. Reuse existing styling/layout conventions where reasonable.
4. Do not recreate the Vite project from scratch.
5. Do not unnecessarily upgrade unrelated dependencies.

After implementation:

1. Run TypeScript checking.
2. Run the production build.
3. Fix all build/type errors.
4. Test switching repeatedly between modes.
5. Verify camera resources are released when leaving Hand Tracking.
6. Verify the ring viewer still behaves exactly as before.

## README

Update the README with:

- the new Hand Tracking mode
- MediaPipe dependency
- camera permission requirements
- HTTPS/secure-context requirement
- how to test on desktop
- how to test on a smartphone
- where the MediaPipe model/WASM assets come from
- known browser limitations
- the intended future architecture for combining hand tracking with Three.js

## Completion report

When finished, report:

- files added
- files modified
- MediaPipe version installed
- how model/WASM resources are loaded
- how camera selection works
- how cleanup is handled when switching modes
- measured/observed inference FPS if it can be tested
- any browser-specific issues discovered
- any architectural decisions made specifically to support the future Three.js ring overlay