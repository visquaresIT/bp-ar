import './style.css'
import * as THREE from 'https://esm.sh/three@0.152.2'
import { DRACOLoader } from 'https://esm.sh/three@0.152.2/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'https://esm.sh/three@0.152.2/examples/jsm/loaders/GLTFLoader.js'
import { MindARThree } from 'https://esm.sh/mind-ar@1.2.5/dist/mindar-image-three.prod.js?deps=three@0.152.2'

const TARGETS_URL = new URL('../assets/target-original.mind', import.meta.url).href
const TARGET_IMAGE_URL = new URL('../assets/sea-mine.png', import.meta.url).href
const MODEL_URL = new URL('../assets/platform-mine.glb', import.meta.url).href

const TRACKING_CONFIG = {
  filterMinCF: 0.0001,
  filterBeta: 5,
  warmupTolerance: 8,
  missTolerance: 12,
}

document.querySelector('#app').innerHTML = `
  <main class="app-shell" data-app data-view="welcome" data-tracking="idle">
    <section class="welcome-screen" data-screen="welcome">
      <div class="welcome-panel">
        <h1>Welcome to BP AR Demo</h1>
        <button class="start-button" type="button" data-start>Start Experience</button>
        <p class="welcome-error" data-welcome-error hidden></p>
      </div>
    </section>

    <section class="experience-screen" data-screen="experience" aria-hidden="true">
      <div class="ar-surface" data-ar-container></div>
      <div class="scan-overlay" aria-hidden="true">
        <div class="scan-frame">
          <span class="scan-corner scan-corner--top-left"></span>
          <span class="scan-corner scan-corner--top-right"></span>
          <span class="scan-corner scan-corner--bottom-left"></span>
          <span class="scan-corner scan-corner--bottom-right"></span>
          <span class="scan-line"></span>
        </div>
      </div>
      <p class="sr-only" data-status aria-live="polite">Ready to start.</p>
    </section>
  </main>
`

const appShell = document.querySelector('[data-app]')
const welcomeScreen = document.querySelector('[data-screen="welcome"]')
const experienceScreen = document.querySelector('[data-screen="experience"]')
const startButton = document.querySelector('[data-start]')
const welcomeError = document.querySelector('[data-welcome-error]')
const statusRegion = document.querySelector('[data-status]')
const container = document.querySelector('[data-ar-container]')

const mindarThree = new MindARThree({
  container,
  imageTargetSrc: TARGETS_URL,
  uiLoading: 'no',
  uiScanning: 'no',
  uiError: 'no',
  maxTrack: 1,
  ...TRACKING_CONFIG,
})

const { renderer, scene, camera } = mindarThree
const clock = new THREE.Clock()
const dracoLoader = new DRACOLoader()
const gltfLoader = new GLTFLoader()
const smoothedPosition = new THREE.Vector3()
const smoothedQuaternion = new THREE.Quaternion()
const smoothedScale = new THREE.Vector3()
const targetPosition = new THREE.Vector3()
const targetQuaternion = new THREE.Quaternion()
const targetScale = new THREE.Vector3()

const POSE_LERP_ALPHA = 0.2
const SCALE_LERP_ALPHA = 0.25

dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
gltfLoader.setDRACOLoader(dracoLoader)

renderer.setClearColor(0x000000, 0)
renderer.outputColorSpace = THREE.SRGBColorSpace

const hemiLight = new THREE.HemisphereLight(0xfff4d6, 0x0e1b2f, 1.15)
const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
keyLight.position.set(0.4, 1.2, 1.4)
scene.add(hemiLight, keyLight)

const anchor = mindarThree.addAnchor(0)
const stabilizedRoot = new THREE.Group()
const contentRoot = new THREE.Group()
const modelRig = new THREE.Group()

stabilizedRoot.visible = false
scene.add(stabilizedRoot)

contentRoot.position.z = 0.02
contentRoot.add(modelRig)
stabilizedRoot.add(contentRoot)

const glowRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.34, 0.012, 24, 120),
  new THREE.MeshBasicMaterial({
    color: 0x7bf0d1,
    transparent: true,
    opacity: 0.75,
  }),
)

const shadowDisc = new THREE.Mesh(
  new THREE.CircleGeometry(0.28, 48),
  new THREE.MeshBasicMaterial({
    color: 0x08111d,
    transparent: true,
    opacity: 0.26,
  }),
)

glowRing.rotation.x = Math.PI / 2
shadowDisc.position.z = 0.001
// contentRoot.add(glowRing, shadowDisc)

let platformModel = null
const platformModelPromise = gltfLoader.loadAsync(MODEL_URL).then((gltf) => {
  const nextModel = gltf.scene

  nextModel.traverse((child) => {
    if (!child.isMesh) return

    child.frustumCulled = false

    if (child.material?.map) {
      child.material.map.colorSpace = THREE.SRGBColorSpace
    }
  })

  nextModel.rotation.x = -Math.PI / 2
  nextModel.updateMatrixWorld(true)

  const initialBounds = new THREE.Box3().setFromObject(nextModel)
  const initialSize = initialBounds.getSize(new THREE.Vector3())
  const scale = 0.8 / Math.max(initialSize.x, initialSize.y, initialSize.z, 1)

  nextModel.scale.setScalar(scale)
  nextModel.updateMatrixWorld(true)

  const scaledBounds = new THREE.Box3().setFromObject(nextModel)
  const center = scaledBounds.getCenter(new THREE.Vector3())
  const minZ = scaledBounds.min.z

  nextModel.position.set(-center.x, -center.y, -minZ + 0.015)
  modelRig.add(nextModel)
  platformModel = nextModel

  return nextModel
})

let running = false

const waitForNextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

const syncExperienceLayers = () => {
  const video = container.querySelector('video') ?? document.querySelector('video')
  const canvas = renderer.domElement

  if (video) {
    if (video.parentElement !== container) {
      container.prepend(video)
    }

    video.setAttribute('playsinline', 'true')
    video.setAttribute('muted', 'true')
    video.muted = true

    Object.assign(video.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
      opacity: '1',
      visibility: 'visible',
      background: 'transparent',
      zIndex: '0',
    })
  }

  if (canvas.parentElement !== container) {
    container.appendChild(canvas)
  }

  renderer.setClearColor(0x000000, 0)

  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: 'block',
    opacity: '1',
    visibility: 'visible',
    background: 'transparent',
    zIndex: '1',
  })
}

const setView = (view) => {
  appShell.dataset.view = view
  const isWelcome = view === 'welcome'
  welcomeScreen.setAttribute('aria-hidden', String(!isWelcome))
  experienceScreen.setAttribute('aria-hidden', String(isWelcome))
}

const setTrackingState = (state) => {
  appShell.dataset.tracking = state
}

const setStatus = (text) => {
  statusRegion.textContent = text
}

const setWelcomeError = (text = '') => {
  welcomeError.hidden = !text
  welcomeError.textContent = text
}

const resetWelcome = (message = '') => {
  setView('welcome')
  setTrackingState('idle')
  setWelcomeError(message)
}

const getCameraIssue = async () => {
  if (!window.isSecureContext) {
    return {
      status: 'Camera requires a secure page',
      heading: 'Secure context required',
      copy: 'Open this app on localhost or HTTPS before starting the camera.',
    }
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      status: 'Camera API unavailable',
      heading: 'Camera not supported',
      copy: 'Use a browser and device that expose getUserMedia for camera access.',
    }
  }

  if (!navigator.permissions?.query) {
    return null
  }

  try {
    const permission = await navigator.permissions.query({ name: 'camera' })

    if (permission.state === 'denied') {
      return {
        status: 'Camera permission blocked',
        heading: 'Camera access is blocked',
        copy: 'Allow camera access for this site in your browser settings, then try again.',
      }
    }
  } catch {
    return null
  }

  return null
}

const renderFrame = () => {
  const elapsed = clock.getElapsedTime()

  if (anchor.group.visible) {
    anchor.group.updateMatrixWorld(true)
    anchor.group.matrixWorld.decompose(targetPosition, targetQuaternion, targetScale)

    if (!stabilizedRoot.visible) {
      smoothedPosition.copy(targetPosition)
      smoothedQuaternion.copy(targetQuaternion)
      smoothedScale.copy(targetScale)
      stabilizedRoot.visible = true
    } else {
      smoothedPosition.lerp(targetPosition, POSE_LERP_ALPHA)
      smoothedQuaternion.slerp(targetQuaternion, POSE_LERP_ALPHA)
      smoothedScale.lerp(targetScale, SCALE_LERP_ALPHA)
    }

    stabilizedRoot.position.copy(smoothedPosition)
    stabilizedRoot.quaternion.copy(smoothedQuaternion)
    stabilizedRoot.scale.copy(smoothedScale)
  } else if (stabilizedRoot.visible) {
    stabilizedRoot.visible = false
  }

  const pulse = 1 + Math.sin(elapsed * 2.8) * 0.05
  glowRing.rotation.z = elapsed * 0.45
  glowRing.scale.setScalar(pulse)
  shadowDisc.scale.setScalar(1 + Math.sin(elapsed * 2.8) * 0.025)
  contentRoot.position.z = 0.02 + Math.sin(elapsed * 1.8) * 0.008

  if (platformModel) {
    modelRig.rotation.z = Math.sin(elapsed * 0.45) * 0.035
  }

  renderer.render(scene, camera)
}

anchor.onTargetFound = () => {
  anchor.group.updateMatrixWorld(true)
  anchor.group.matrixWorld.decompose(smoothedPosition, smoothedQuaternion, smoothedScale)
  stabilizedRoot.position.copy(smoothedPosition)
  stabilizedRoot.quaternion.copy(smoothedQuaternion)
  stabilizedRoot.scale.copy(smoothedScale)
  stabilizedRoot.visible = true
  setTrackingState('locked')
  setStatus('Target locked.')
}

anchor.onTargetLost = () => {
  if (!running) return

  stabilizedRoot.visible = false
  setTrackingState('scanning')
  setStatus('Scanning for target.')
}

const startExperience = async () => {
  if (running) return

  startButton.disabled = true
  setWelcomeError('')
  setView('experience')
  setTrackingState('starting')
  setStatus('Requesting camera access.')

  try {
    await waitForNextFrame()

    const cameraIssue = await getCameraIssue()

    if (cameraIssue) {
      setStatus(cameraIssue.status)
      resetWelcome(cameraIssue.copy)
      return
    }

    if (!platformModel) {
      setStatus('Loading 3D model.')
      await platformModelPromise
    }

    await mindarThree.start()
  syncExperienceLayers()
    clock.start()
    renderer.setAnimationLoop(renderFrame)
    running = true
    setTrackingState('scanning')
    setStatus('Scanning for target.')
  } catch (error) {
    console.error(error)

    const cameraIssue = await getCameraIssue()

    if (cameraIssue) {
      setStatus(cameraIssue.status)
      resetWelcome(cameraIssue.copy)
      return
    }

    if (!platformModel) {
      setStatus('Model load failed.')
      resetWelcome('Unable to load the model. Check assets/platform-mine.glb and try again.')
      return
    }

    setStatus('Camera start failed.')
    resetWelcome('Unable to start the camera. Allow access and try again.')
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
  stabilizedRoot.visible = false
  setStatus('Experience stopped.')
  resetWelcome()
}

startButton.addEventListener('click', startExperience)
window.addEventListener('pagehide', stopExperience)
