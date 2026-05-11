import './style.css'
import * as THREE from 'https://esm.sh/three@0.160.0'
import { MindARThree } from 'https://esm.sh/mind-ar@1.2.5/dist/mindar-image-three.prod.js'

const TARGETS_URL =
  'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind'
const TARGET_IMAGE_URL =
  'https://hiukim.github.io/mind-ar-js-doc/assets/images/card-06cb9111a8e32627db6bfafc7aa22a4d.png'

document.querySelector('#app').innerHTML = `
  <main class="shell">
    <section class="intro">
      <p class="eyebrow">MindAR + Three.js</p>
      <h1>Image tracking AR starter</h1>
      <p class="lede">
        This demo uses the sample MindAR target from the docs so you can run it
        immediately, then replace it with your own compiled <span>.mind</span>
        file.
      </p>
      <div class="actions">
        <button class="primary" type="button" data-start>Start camera</button>
        <button class="secondary" type="button" data-stop disabled>Stop</button>
      </div>
      <div class="meta-row">
        <span class="status-pill" data-status data-tone="neutral">Ready to start</span>
        <a href="${TARGET_IMAGE_URL}" target="_blank" rel="noreferrer">Open sample target image</a>
      </div>
    </section>

    <section class="stage-panel">
      <div class="stage-copy">
        <p>Point your camera at the sample card after starting the experience.</p>
        <p>
          To use your own image, compile it with the
          <a href="https://hiukim.github.io/mind-ar-js-doc/tools/compile" target="_blank" rel="noreferrer">MindAR compiler</a>
          and swap the target URL in <span>src/main.js</span>.
        </p>
      </div>
      <div class="stage">
        <div class="stage-grid"></div>
        <div class="ar-surface" data-ar-container></div>
        <div class="overlay-card">
          <p class="overlay-label">Live State</p>
          <h2 data-overlay-heading>Waiting for camera</h2>
          <p data-overlay-copy>
            Start the experience, allow camera access, then hold the sample card in view.
          </p>
        </div>
      </div>
    </section>
  </main>
`

const startButton = document.querySelector('[data-start]')
const stopButton = document.querySelector('[data-stop]')
const statusPill = document.querySelector('[data-status]')
const overlayHeading = document.querySelector('[data-overlay-heading]')
const overlayCopy = document.querySelector('[data-overlay-copy]')
const container = document.querySelector('[data-ar-container]')

const mindarThree = new MindARThree({
  container,
  imageTargetSrc: TARGETS_URL,
  uiLoading: 'no',
  uiScanning: 'no',
  uiError: 'no',
  maxTrack: 1,
  warmupTolerance: 2,
  missTolerance: 2,
})

const { renderer, scene, camera } = mindarThree
const clock = new THREE.Clock()

renderer.setClearColor(0x000000, 0)

const hemiLight = new THREE.HemisphereLight(0xfff4d6, 0x0e1b2f, 1.15)
const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
keyLight.position.set(0.4, 1.2, 1.4)
scene.add(hemiLight, keyLight)

const anchor = mindarThree.addAnchor(0)

const plate = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 0.55),
  new THREE.MeshStandardMaterial({
    color: 0x1b2d45,
    metalness: 0.15,
    roughness: 0.45,
  }),
)

const knot = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.15, 0.045, 160, 20),
  new THREE.MeshStandardMaterial({
    color: 0xff875f,
    emissive: 0x9f2b10,
    emissiveIntensity: 0.35,
    metalness: 0.35,
    roughness: 0.25,
  }),
)

const halo = new THREE.Mesh(
  new THREE.TorusGeometry(0.28, 0.015, 24, 100),
  new THREE.MeshBasicMaterial({
    color: 0x7bf0d1,
    transparent: true,
    opacity: 0.85,
  }),
)

plate.position.set(0, 0, 0)
knot.position.set(0, 0.08, 0.15)
halo.position.set(0, 0.02, 0.04)
halo.rotation.x = Math.PI / 2

anchor.group.add(plate, knot, halo)

let running = false

const setStatus = (text, tone = 'neutral') => {
  statusPill.textContent = text
  statusPill.dataset.tone = tone
}

const setOverlay = (heading, copy) => {
  overlayHeading.textContent = heading
  overlayCopy.textContent = copy
}

const renderFrame = () => {
  const elapsed = clock.getElapsedTime()

  knot.rotation.x = elapsed * 0.55
  knot.rotation.y = elapsed * 0.8
  halo.rotation.z = elapsed * 0.65

  const pulse = 1 + Math.sin(elapsed * 3.2) * 0.06
  halo.scale.setScalar(pulse)

  renderer.render(scene, camera)
}

anchor.onTargetFound = () => {
  setStatus('Target locked', 'success')
  setOverlay('Target detected', 'The AR object is now anchored to the tracked image.')
}

anchor.onTargetLost = () => {
  if (!running) return

  setStatus('Scanning for target', 'neutral')
  setOverlay('Scanning', 'Keep the sample image flat, bright, and fully inside the camera view.')
}

const startExperience = async () => {
  if (running) return

  startButton.disabled = true
  setStatus('Requesting camera access', 'neutral')
  setOverlay('Starting camera', 'Allow camera access when the browser prompts you.')

  try {
    await mindarThree.start()
    clock.start()
    renderer.setAnimationLoop(renderFrame)
    running = true
    stopButton.disabled = false
    setStatus('Scanning for target', 'neutral')
    setOverlay('Camera live', 'Point the camera at the sample card to trigger the 3D marker.')
  } catch (error) {
    console.error(error)
    setStatus('Camera start failed', 'error')
    setOverlay(
      'Unable to start',
      'Use localhost or HTTPS, then allow camera access and try again.',
    )
  } finally {
    startButton.disabled = false
  }
}

const stopExperience = () => {
  if (!running) return

  renderer.setAnimationLoop(null)
  clock.stop()
  mindarThree.stop()
  running = false
  stopButton.disabled = true
  setStatus('Experience stopped', 'neutral')
  setOverlay('Stopped', 'Start the camera again whenever you want to resume tracking.')
}

startButton.addEventListener('click', startExperience)
stopButton.addEventListener('click', stopExperience)
window.addEventListener('pagehide', stopExperience)
