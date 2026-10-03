Extend the existing Vite + React + TypeScript + React Three Fiber / Three.js application so that the Hand Tracking mode renders the existing GLB ring model on the tracked ring finger in real time.

The application already has:

- a standalone Three.js/R3F ring viewer
- a live camera Hand Tracking mode
- MediaPipe Hand Landmarker running in real time
- hand landmark visualization
- prototype ring pose estimation
- ring center/orientation/scale currently visualized using debug lines

Preserve the existing pose-estimation algorithm. Do not redesign it unless necessary.

The purpose of this milestone is to replace/add to the debug visualization with the actual GLB ring and make the ring appear to wrap around the finger correctly using occlusion.

## Desired result

The Hand Tracking pipeline should become:

```text
camera video
     ↓
MediaPipe Hand Landmarker
     ↓
existing ring pose estimator
     ↓
position + orientation + scale
     ↓
Three.js
     ├── ring.glb
     └── invisible finger occlusion geometry
     ↓
composited over camera image
```

The desired visual effect is:

```text
             gemstone
                ◆
          ──────┼──────
             ╭────╮
             │    │
             │    │  finger
             │    │
             ╰────╯
```

The front portion of the ring should be visible.

The portion physically behind the finger should be hidden.

The finger occluder itself must NOT be visible.

## Important: preserve debug visualization

Keep the existing pose visualization available.

Add debug controls approximately like:

```text
Show landmarks       [x]
Show pose axes        [x]
Show ring             [x]
Show occluder         [ ]
```

This is important because we need to be able to compare the rendered ring transform with the existing prototype pose visualization.

Do not delete the current line/axis visualization.

## Camera/video composition

The camera video should remain the background.

Place the Three.js canvas directly over the camera video:

```text
┌──────────────────────────────────┐
│ camera video                     │
│                                  │
│            hand                  │
│             💍   ← Three canvas  │
│                                  │
└──────────────────────────────────┘
```

Use CSS positioning so:

```text
video
```

and:

```text
Three.js canvas
```

occupy exactly the same displayed rectangle.

The Three.js canvas must have a transparent background so the video remains visible.

Conceptually:

```text
video layer
     ↓
transparent Three.js canvas
     ↓
optional 2D debug canvas
```

Be careful about ordering the 2D MediaPipe landmark/debug overlay relative to Three.js.

## Coordinate systems

This is one of the most important parts of the implementation.

The existing pose estimator already produces a ring position/orientation/scale.

Identify exactly which coordinate system that pose is expressed in.

Create an explicit conversion layer between:

```text
MediaPipe / pose-estimator coordinates
```

and:

```text
Three.js camera coordinates
```

Do NOT scatter coordinate flips, scale factors, and offsets throughout React components.

Create a function/module approximately like:

```ts
interface RingPose {
  position: THREE.Vector3;
  orientation: THREE.Quaternion;
  scale: number;
}

function poseToThreeTransform(...): RingPose
```

or equivalent.

Document:

- MediaPipe X direction
- MediaPipe Y direction
- MediaPipe Z convention
- Three.js camera coordinate convention
- any Y inversion
- any Z inversion
- video mirroring behavior
- front-camera vs rear-camera behavior

The rendered ring must align with the existing pose debug visualization.

## Three.js camera

Use a Three.js camera whose projection matches the camera-video overlay as closely as practical.

For this milestone, exact physical camera calibration is not required if the existing pose estimation is image-relative.

However, avoid arbitrary transformations that will make later camera calibration difficult.

Keep projection-related logic isolated.

The Three.js canvas aspect ratio must match the displayed video aspect ratio.

Correctly handle:

- desktop landscape webcam
- smartphone portrait orientation
- device rotation
- video resize
- CSS object-fit behavior

The video and Three.js coordinate systems must remain aligned after resizing.

## Load the ring GLB

Reuse the same ring GLB used by the standalone Ring Viewer.

Do not duplicate the asset.

Reuse existing GLB-loading code where practical.

Preserve the GLB's existing materials.

Three.js GLTFLoader supports physical glTF material extensions including transmission, IOR, volume, and dispersion. Do not replace those materials merely to simplify AR rendering.

The GLB may not have a convenient local origin or orientation.

Create a normalization transform once when the GLB loads so that there is a clearly defined local ring coordinate system.

For example, define:

```text
local ring axis
local gemstone/up direction
local ring center
```

Do not hide unexplained 90-degree rotations inside the per-frame tracking loop.

If necessary, create a wrapper Three.js Group:

```text
TrackedRingTransform
    ↓
AssetNormalizationTransform
    ↓
ring.glb
```

Then:

- tracking changes `TrackedRingTransform`
- GLB-specific corrections live in `AssetNormalizationTransform`

This separation is important.

## Apply the existing ring pose

Each new tracking result should update:

```text
ring.position
ring.quaternion
ring.scale
```

from the existing estimated pose.

Do not rebuild/reload the GLB every frame.

Do not use React state for high-frequency transform updates if it causes React rerenders.

Prefer refs and direct Three.js Object3D transform updates.

## Temporal smoothing

The ring will probably jitter more noticeably than the debug lines once a realistic model is rendered.

Add optional configurable temporal smoothing for:

- position
- rotation
- scale

Use appropriate interpolation:

```text
position → lerp
scale    → lerp
rotation → quaternion slerp
```

Do not smooth Euler angles.

Expose one simple smoothing parameter initially.

Keep the unsmoothed pose available for debugging.

## Environment lighting

Reuse the HDR environment from the standalone ring viewer.

For the first AR prototype, it is acceptable that the HDR environment does not match the real camera environment.

The important goal is:

- gold looks metallic
- diamond remains transmissive/refractive
- ring remains visually readable

Do NOT display the HDR environment as the Three.js background in Hand Tracking mode.

The Three.js background must remain transparent so the real camera image shows through.

Use the HDRI for image-based lighting/reflections only.

Later we will investigate estimating illumination from the camera image.

## Finger occlusion — basic approach

Implement a procedural finger proxy around the part of the ring finger occupied by the ring.

Start with a tapered cylinder or similarly simple mesh.

Conceptually:

```text
       PIP
        ●
       / \
      /   \
     |     |
     |=====| ← ring location
     |     |
      \   /
       \ /
        ●
       MCP
```

The proxy should approximately follow the ring-finger axis determined by the same landmarks used by the ring pose estimator.

Do not assume that the finger points vertically on screen.

The proxy must use the same 3D coordinate frame as the ring.

## Finger dimensions

Estimate the finger proxy radius from the existing hand/ring scale estimate.

Do not use a fixed radius in Three.js world units.

Make the relationship configurable, for example:

```ts
fingerRadius = handScale * fingerRadiusFactor;
```

or derive it from whichever existing scale measurement is already used to size the ring.

Allow separate proximal/distal radii so the proxy can be tapered:

```text
radius near MCP > radius near PIP
```

Start with reasonable heuristic ratios and expose them as constants/debug parameters.

The purpose is not anatomically accurate finger reconstruction yet.

The purpose is correct ring occlusion.

## Depth-only occluder

The finger proxy must NOT be rendered as a transparent skin-colored object.

It should be invisible in the final color output while still writing to the depth buffer.

Use a Three.js material configured approximately as:

```ts
colorWrite = false
depthWrite = true
depthTest = true
```

The exact material type is up to the implementation.

The intended render behavior is:

```text
camera video
      ↓
visible background

finger proxy
      ↓
writes DEPTH only
writes NO COLOR

ring
      ↓
normal color rendering
depth tested against finger proxy
```

Three.js explicitly supports using `Material.colorWrite = false` together with render ordering for invisible occluding objects.

Make sure the occluder is rendered before the ring.

Use explicit `renderOrder` if necessary rather than relying accidentally on scene traversal order.

## Critical occlusion test

Create/debug the geometry so that when looking approximately perpendicular to the finger:

```text
         ◆
       ╱   ╲
      ╱     ╲
     │finger │
      ╲     ╱
       ╲___╱
```

the near/front part of the ring is visible and the far/back part is hidden.

Rotating the hand should cause different portions of the ring to become occluded naturally.

Do NOT solve this by manually hiding a fixed half of the ring mesh.

Occlusion must result from ordinary depth testing between the ring geometry and finger proxy.

## Occluder debug mode

Add:

```text
Show Occluder
```

When enabled, replace or override the depth-only material with a visibly colored semi-transparent or wireframe debug material.

This should make it possible to see:

```text
ring
finger proxy
ring pose axes
MediaPipe landmarks
```

simultaneously.

This will be essential for tuning radius and alignment.

When debug mode is disabled, restore the true depth-only material.

## Avoid z-fighting

The ring and proxy may intersect or nearly intersect.

If depth artifacts occur, investigate:

- geometry dimensions
- camera near/far planes
- depth precision
- polygon offset only if genuinely necessary

Do not immediately add arbitrary depth biases that make the ring float above the finger.

We want the virtual ring geometry and proxy finger geometry to have a plausible physical relationship.

## Hand segmentation architecture

Do NOT make hand segmentation a requirement for this milestone.

However, prepare for it.

Define an optional abstraction approximately like:

```ts
interface HandOcclusionSource {
  // supplies information needed for real-hand occlusion
}
```

or another clean design.

The future pipeline may combine:

```text
MediaPipe landmarks
       ↓
coarse 3D finger proxy
       +
hand segmentation mask
       ↓
better occlusion
```

The segmentation mask would provide a better 2D finger/hand silhouette, while the coarse 3D proxy would still help determine whether virtual geometry lies in front of or behind the finger.

Do not add a generic person-segmentation model merely to satisfy this interface.

## Why segmentation alone is insufficient

Document this in the code/README:

A binary hand mask answers:

```text
"Is this pixel part of the hand?"
```

but does not answer:

```text
"Is the hand at this pixel in front of or behind the ring?"
```

Therefore segmentation alone cannot correctly handle a ring wrapping around a finger.

The depth proxy supplies the approximate 3D relationship.

Later, segmentation may refine the silhouette.

## Tracking loss

When the hand or required ring-finger landmarks are lost:

- do not leave the ring frozen indefinitely on the screen
- hide the ring
- hide the occluder
- optionally use a very short grace period to avoid flicker from a single missed frame

When tracking resumes, restore them.

Keep this behavior configurable.

## Performance

The application now has several real-time components:

```text
camera decoding
MediaPipe inference
Three.js rendering
GLB PBR materials
HDR environment lighting
```

Avoid unnecessary React rerenders.

The Three.js render loop may run at display refresh rate.

MediaPipe inference does not need to run at the same frequency.

The latest valid pose can be reused between MediaPipe updates.

Do not reload or clone materials every frame.

Do not allocate large numbers of temporary Vector3/Quaternion/Matrix objects every frame if easily avoidable.

Measure FPS after implementation.

## Diamond rendering

Do not compromise the GLB diamond material merely to increase FPS unless necessary.

First test the existing material.

If performance is poor, report which features appear expensive before changing them.

The current Three.js GLTFLoader supports glTF extensions including:

- KHR_materials_transmission
- KHR_materials_ior
- KHR_materials_volume
- KHR_materials_dispersion

Preserve these where present.

If the browser rendering differs from Blender/Cycles, document the differences rather than attempting to make the browser path tracer-equivalent.

## UI/debug controls

Add a compact debug section containing approximately:

```text
AR Ring               [x]
Landmarks             [x]
Pose Axes              [x]
Finger Occluder Debug  [ ]
Smoothing              [0.7]
Ring Scale Multiplier  [1.0]
Finger Radius          [1.0]
```

The exact UI is flexible.

The scale/radius controls are important because we will probably need to tune the heuristics visually.

## Suggested architecture

Prefer something conceptually like:

```text
HandTrackingView
      │
      ├── CameraVideo
      │
      ├── MediaPipeHandTracker
      │          ↓
      │     HandLandmarkerResult
      │          ↓
      │     RingPoseEstimator
      │          ↓
      │        RingPose
      │
      ├── HandDebugOverlay
      │
      └── ARScene
             │
             ├── ARCamera
             ├── TrackedRing
             │      └── ring.glb
             │
             ├── FingerOccluder
             │
             └── HDR Environment
```

Avoid putting MediaPipe logic directly inside the Three.js ring component.

`TrackedRing` should consume a ring pose.

`FingerOccluder` should consume the relevant hand geometry/pose information.

This will make it possible to replace either the pose estimator or occlusion algorithm later.

## Acceptance tests

Test at least the following:

### Stationary hand

Hold the hand still.

The ring should remain centered around the intended ring-finger location with minimal jitter.

### Translation

Move the hand left/right/up/down.

The ring should remain attached.

### Scale

Move the hand toward and away from the camera.

The ring should scale approximately with the finger.

### In-plane rotation

Rotate the hand within the image plane.

The ring should rotate with the finger.

### Palm/back-of-hand orientation

Rotate the hand so the palm and back of hand become visible.

The gemstone/up orientation should continue to follow the existing pose estimate.

### Occlusion

Change the hand orientation.

The visible and hidden portions of the ring should change naturally based on the depth relationship with the finger proxy.

### Tracking loss

Move the hand out of frame.

The ring and occluder should disappear cleanly.

### Mode switching

Switch:

```text
Ring Viewer
→ Hand Tracking
→ Ring Viewer
→ Hand Tracking
```

several times.

There must be no duplicated camera streams, Three.js canvases, MediaPipe loops, or leaked WebGL resources.

## README

Update the README with a short architecture description:

```text
Camera
   ↓
MediaPipe
   ↓
Ring Pose Estimator
   ↓
Three.js
 ├── GLB ring
 ├── HDR lighting
 └── depth-only finger proxy
```

Explain that the current finger geometry is an approximation used only for occlusion.

Document that future improvements may include:

- better finger geometry
- hand segmentation
- camera calibration
- device depth sensing
- environment-light estimation
- temporal pose filtering
- higher-quality snapshot rendering

## Completion report

After implementation:

1. Run TypeScript checks.
2. Run the production build.
3. Fix all build errors.
4. Test the feature in the browser if possible.

Then report:

- files added
- files modified
- how MediaPipe coordinates are mapped into Three.js
- how the GLB local coordinate system is normalized
- how ring scale is calculated
- how finger radius is calculated
- how the depth-only occluder works
- render ordering used for occlusion
- smoothing method
- measured FPS
- visual limitations
- recommended next improvement

Do not implement hand segmentation, depth-camera integration, or path tracing in this milestone unless required to fix a concrete problem.