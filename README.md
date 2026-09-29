# GLB Viewer

A small, client-only GLB viewer for comparing Three.js real-time rendering with a Blender/Cycles reference. It loads the supplied ring GLB without replacing its materials, lights it with a high-dynamic-range studio environment, and exports high-resolution PNG snapshots from the current camera pose.

This first prototype is a **real-time rasterized PBR renderer, not a path tracer**.

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

- `MAT_DIAMOND`: metallic 0, roughness 0.2, `KHR_materials_ior` at approximately 2.417, and `KHR_materials_specular`; it does **not** declare `KHR_materials_transmission`, volume/thickness, or dispersion.
- `MAT_18K_GOLD`: metallic 0, roughness 0.15, and `KHR_materials_specular`; despite its name, the exported material does not currently use metallic workflow (`metallicFactor` is 0).

Those source values mean the current diamond will not render as transmissive glass and the gold will behave as a dielectric rather than a metal. That is an asset-authoring limitation, not a silent viewer override. Re-exporting the GLB with `KHR_materials_transmission` (plus IOR/volume where appropriate) and with the gold's correct metallic factor is the first fidelity improvement to make.

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
  App.tsx                         UI state and asset preflight
  components/
    CameraController.tsx         Model-aware camera and OrbitControls
    Ground.tsx                   Model-aware neutral floor
    RingModel.tsx                GLB loading, centering, diagnostics
    RingViewer.tsx               Canvas and scene composition
    SceneErrorBoundary.tsx       Friendly loader/render failures
    StudioEnvironment.tsx        EXR environment and IBL
    ViewerControls.tsx           Minimal control panel
  hooks/
    useAssetAvailability.ts      Missing-asset detection and retry
  rendering/
    snapshot.ts                  Offscreen high-resolution PNG export
  styles/
    index.css
    viewer.css
```
