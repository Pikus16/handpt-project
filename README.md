# HandPT Project · Movement, in play

A browser-local hand and wrist exercise playground. The interface is now a focused sequence: welcome → automatic calibration of five movements → game library → immersive game → session summary.

## Hosting

This repository is prepared for free public hosting at `https://pikus16.github.io/handpt-project/`. This is the intended URL until a successful Pages deployment is confirmed. GitHub Pages must use GitHub Actions as its source. Pushing to `main` runs the tests and deploys only `dist/`. All app, worker, model, and WASM URLs are relative, so the project subdirectory works without a custom domain. Camera use is available over the host’s HTTPS connection. No server or paid service is needed.

## Repository-local GitHub login

From this repository, run `./scripts/gh-local login` and authorize **Pikus16** in the browser. The wrapper sets `GH_CONFIG_DIR` to `.git/gh-auth`, ignores inherited GitHub token environment variables and shared keychain fallbacks, and skips global Git credential setup. Authentication is stored locally inside `.git`, with private directory/file permissions, rather than in the shared keychain. This local token file is never committed, packaged, or deployed. Its OAuth scopes still apply to the GitHub account; the isolation concerns where the login is stored and used.

Use `./scripts/gh-local` instead of `gh` for this project's GitHub commands. The Git credential helper is configured with `git config --local` for this repository and remote only. Do not run `gh auth setup-git`; it changes global Git settings. To remove this repository's login, run `./scripts/gh-local logout`.

## Run

```bash
npm run dev
```

Open http://localhost:8080. Camera access requires HTTPS or localhost. `npm test` runs the automated tests. Deploy `dist/` on a static HTTPS host, retaining its directory structure and serving WebAssembly with the correct MIME type. The dependency code, WASM files and the hand model are vendored; camera processing does not require a CDN.

## Five selected movements

These are common, unresisted hand-therapy movements, not a universal treatment plan or a clinical ranking. Exercise suitability, dosage and restrictions depend on the condition and therapist's instructions. No sets or frequency are prescribed by the app.

| Movement | What the app asks for | Source |
| --- | --- | --- |
| Finger curls | Comfortable opening → loose fist | [American Society for Surgery of the Hand](https://www.assh.org/handcare/servlet/servlet.FileDownload?file=00P5b00001HTIG0EAP) |
| Thumb opposition | Thumb away from fingers → toward little fingertip; contact unnecessary | [University Hospitals Sussex NHS](https://www.uhsussex.nhs.uk/wp-content/uploads/2021/10/2078.2-virtual-hand-fracture-clinic-2024.pdf) |
| Finger spreading | Fingers together → gently spread | [East Kent Hospitals NHS](https://leaflets.ekhuft.nhs.uk/tendon-glide-exercises/html/) |
| Wrist flexion/extension | Palm toward forearm → hand backward, supported forearm | [Guy's and St Thomas' NHS](https://www.guysandstthomas.nhs.uk/health-information/wrist-movement-exercises-after-injury-or-surgery) |
| Wrist radial/ulnar deviation | Thumb side → little-finger side, forearm still | [Chelsea and Westminster NHS](https://www.chelwest.nhs.uk/your-visit/patient-leaflets/hand-therapy/active-wrist-exercises) |

Finger curls practice one movement used in tendon gliding, not the complete multi-position protocol. Thumb opposition practices one endpoint, not the entire finger-to-finger sequence. Sources informed exercise selection; they do not validate this app.

## Automatic calibration

After a user initiates camera access, the app guides all five movements in sequence. Each movement has four seconds for positioning, three seconds to move to the first comfortable endpoint, a two-second stable capture, three seconds to move to the second endpoint, and a second two-second capture. The sequence takes approximately 70 seconds of valid tracking, plus any time for positioning, slower frame rates or retries.

Each hold requires at least 15 distinct frames. Median endpoints reduce noise; unstable positions restart the hold; insufficient span asks for a retry. Tracking loss resets an in-progress hold so disconnected captures are not joined together. Duplicate frame timestamps cannot advance calibration. Minimum detectable spans are 6° for finger curl, 0.1 palm-length ratio for thumb opposition, 4° for finger spread, 6° projected wrist bend and 4° projected wrist deviation. These are software quality thresholds, not clinical targets.

Pause or skip a movement if it is unsuitable. Only games with successfully calibrated movements become available. Changing the selected hand restarts calibration. Calibrations live in memory and must be repeated after a page reload. Recalibrate after changing camera position or how the arm is supported.

## Measurement method and limits

- **Finger curls:** mean PIP flexion of four fingers from adjacent MediaPipe hand world-coordinate bones. DIP and MCP values are not shown as clinical ROM.
- **Thumb opposition:** thumb tip–little fingertip distance / wrist–middle MCP distance. This is a dimensionless motion proxy, not thumb joint ROM or centimeters.
- **Finger spread:** angle between index and little-finger proximal bones in hand world coordinates.
- **Wrist bend and deviation:** an automatic forearm-outline detector measures the visible forearm direction directly from image pixels. It samples appearance from the tracked palm, builds an adaptive YCbCr/luminance mask without fixed skin-tone cutoffs, searches bounded cross-sections behind the wrist, and fits the forearm centerline from the observed edges. The hand direction defines only a broad search cone; it is not substituted for the forearm angle. Both forearm edges, adequate visible length, a consistent centerline and agreement over four frames are required. Unclear or ambiguous outlines pause measurement. A green contour and axis in the preview show what is being tracked.

No elbow, upper body, body-pose model or click-to-mark reference is required. Show several inches of **uncovered forearm against a plain contrasting background**. Sleeves, skin-colored surfaces, strong shadows, occlusion or a very short visible forearm can defeat the appearance-based detector. It does not silently reuse a fixed reference when detection is lost.

The signed camera-plane angle between the fitted forearm direction and the tracked wrist→middle MCP direction estimates wrist movement, with image-aspect-ratio correction. Wrist flexion/extension requires a side view; radial/ulnar deviation requires a view perpendicular to sideways movement. Both use the same projected-angle calculation with different camera placement. A palm-orientation check now rejects front-facing wrist bends and edge-on deviation views, and gives a specific camera-position instruction. It checks across-palm depth for flexion and palm-normal orientation for deviation; the predicted hand depth is not used to invent a forearm depth or ROM value. This check reduces obvious wrong-view captures but cannot prove that the anatomical movement plane is correct. A movement in depth, a changed camera position or compensatory movement can still produce inaccurate estimates. Changes in detected forearm direction above 15° pause calibration/play. Camera-plane wrist spans must not be interpreted as validated anatomical ROM.

Calibration illustrations follow the current stage: they move toward the prompted endpoint during preparation and remain fixed during capture. Wrist flexion bends toward the illustrated palm side; extension moves in the opposite direction.

Hand tracking uses vendored MediaPipe Tasks Vision 0.10.21 and the float16 Hand Landmarker. Its classic worker dynamically imports the ES module because the WASM loader requires `importScripts()`. It passes an explicit OffscreenCanvas for inference, bypassing the SDK’s Safari user-agent fallback to `document.createElement` inside a worker. Regression tests cover Safari, Chrome and Firefox iPhone user agents without a worker DOM, plus a clear compatibility message if OffscreenCanvas is unavailable. These are startup logic tests, not a physical iPhone camera test. Forearm tracking runs in the same worker, from a frame downsampled to at most 320 pixels wide. It needs no additional model or network request. Only derived landmarks, forearm geometry and status return to the UI; image pixels remain inside the worker.

## Five games

| Game | Movement | Mechanic |
| --- | --- | --- |
| Cloud Hopper | Finger curls | Curl to charge, open to jump between floating islands |
| Reef Rescue | Thumb opposition | Bring the thumb across to catch a bubble, open to release a sea creature |
| Star Weaver | Finger spread | Spread to gather stardust, close to weave three constellations |
| Sky Rider | Wrist flexion/extension | Steer altitude to rings and settle briefly to collect them |
| River Rally | Wrist radial/ulnar deviation | Steer a boat sideways to collect lanterns |

Games include distinct scenes, character animations, particles, scoring, levels, bonus milestones, optional synthesized audio and personal bests. Progression increases rewards, not the required physical range. Gentler targets use 70% of the calibrated span; regular targets use 85%. Cycle games require settling, charging, and returning, with dwell times to resist jitter. Steering games require a 550ms target hold and distinct targets. No speed bonus or collision punishment encourages abrupt movement. Games pause on tracking loss or a hidden tab. Reduced-motion preferences suppress ambient animation.

## Privacy and history

Camera frames and raw landmark streams are not recorded, saved or uploaded. Up to 200 session summaries remain in localStorage, with CSV export and local deletion. No accounts or database are needed for local use. Old v1 sessions remain visible as explicitly labeled previous-version measurements, including the old thumb–index pinch metric. Simulated demo sessions are excluded from history. The hosting service receives ordinary site requests.

## Validation

31 automated tests pass. They cover calibration, all five game mechanics, stage-synchronized illustrations, angle geometry, worker lifecycle, and the complete mocked DOM demo flow. Automatic forearm tests use synthetic camera images with multiple wrist/forearm orientations (including a 90° wrist bend), simulated light/dark skin colors, illumination gradients, isolated appearance noise, short visible arms, indistinguishable backgrounds, temporal acquisition and immediate tracking loss. Worker tests verify that current frame pixels feed the forearm detector and that no pose model or manual reference is used.

A nine-frame forearm-only replay of a supplied 9.5-second Photo Booth recording exposed palm-shadow sensitivity, overly strict visible-length requirements, and foreshortening-dependent search scale. After those changes, all nine sampled frames produce a forearm axis consistent with the visible arm; previously only three did. These checks use manually annotated wrist/MCP positions, not end-to-end model inference. The video shows bending toward the camera, so its projected angles are not valid wrist ROM. Native MediaPipe inference could not run because this environment lacks its required graphics context; full browser/model replay and live-camera accuracy remain unverified. Added automated regressions cover shadowed palms, shorter visible arms, foreshortening, and wrong-view rejection. **Neither the recording checks nor synthetic tests validate clinical accuracy.** The appearance-based detector is experimental and may fail on real-world skin/background/lighting combinations. Before clinical use, validate against a reference goniometer across devices and representative patient impairments, with camera-plane sensitivity and compensation checks. This is a functional prototype for practice and exploratory measurement, not a validated medical device, diagnosis or treatment prescription.

## Third-party assets

MediaPipe Tasks Vision and WebAssembly: Apache-2.0, Google, https://github.com/google-ai-edge/mediapipe. Hand model: https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker. All illustrations, game scenes and characters are procedural Canvas drawings. Audio is generated locally with Web Audio. System fonts require no third-party font requests.
