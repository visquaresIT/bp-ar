<template>
  <main>
    <div ref="arApp" id="ar-app"></div>

    <Transition name="welcome">
      <WelcomeScreen
        v-if="!started"
        :starting="starting"
        :error="welcomeError"
        @start="handleStart"
      />
    </Transition>

    <Transition name="ar-ui">
      <div v-if="started" class="ar-ui">
        <aside
          v-if="arDebugOpen"
          class="fixed top-0 left-0 h-full w-72 bg-neutral-900/90 backdrop-blur text-white p-4 overflow-y-auto text-sm shadow-2xl border-r border-neutral-700 z-[60]"
        >
          <div class="flex items-center justify-between mb-3">
            <h1 class="font-semibold">AR Tracker Debug</h1>
            <button @click="closeArDebug" class="text-xs opacity-70 hover:opacity-100">✕</button>
          </div>

          <label class="flex items-center justify-between mb-3 text-xs">
            <span class="opacity-80">Animations</span>
            <input type="checkbox" v-model="animationsEnabled" class="accent-emerald-500 w-4 h-4" />
          </label>

          <section class="mb-4">
            <h2 class="text-xs uppercase tracking-wider opacity-60 mb-2">Camera</h2>
            <div class="text-xs opacity-80 mb-1 break-words">
              <span class="opacity-60">Active:</span> {{ selectedCameraLabel || '(loading…)' }}
            </div>
            <div class="text-xs opacity-80 mb-2 break-words">
              <span class="opacity-60">Resolution:</span> {{ actualResolution || '—' }}
            </div>
            <label class="flex items-center justify-between text-xs mb-2">
              <span class="opacity-80">Prefer standard (non ultra-wide)</span>
              <input type="checkbox" v-model="preferStandardCamera" class="accent-emerald-500 w-4 h-4" />
            </label>
            <label class="block text-xs mb-2">
              <span class="opacity-80 block mb-1">Requested resolution</span>
              <select
                v-model="resolutionPreset"
                class="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1"
              >
                <option v-for="key in Object.keys(RESOLUTION_PRESETS)" :key="key" :value="key">
                  {{ key }}
                </option>
              </select>
            </label>
            <button
              @click="restartAR"
              class="w-full bg-neutral-700 hover:bg-neutral-600 rounded py-2 text-xs"
            >
              Restart AR (apply camera)
            </button>
          </section>

          <section class="mb-4">
            <h2 class="text-xs uppercase tracking-wider opacity-60 mb-2">OneEuroFilter (live)</h2>
            <label class="block mb-2">
              <div class="flex justify-between text-xs opacity-70 mb-1">
                <span>filterMinCF</span>
                <span class="tabular-nums">{{ trackerSettings.filterMinCF.toFixed(5) }}</span>
              </div>
              <input
                type="range"
                v-model.number="trackerSettings.filterMinCF"
                min="0.00001"
                max="0.01"
                step="0.00001"
                class="w-full accent-emerald-500"
              />
            </label>
            <label class="block mb-2">
              <div class="flex justify-between text-xs opacity-70 mb-1">
                <span>filterBeta</span>
                <span class="tabular-nums">{{ trackerSettings.filterBeta.toFixed(4) }}</span>
              </div>
              <input
                type="range"
                v-model.number="trackerSettings.filterBeta"
                min="0.001"
                max="1"
                step="0.001"
                class="w-full accent-emerald-500"
              />
            </label>
          </section>

          <section class="mb-4">
            <h2 class="text-xs uppercase tracking-wider opacity-60 mb-2">Detection (restart to apply)</h2>
            <label class="block mb-2">
              <div class="flex justify-between text-xs opacity-70 mb-1">
                <span>warmupTolerance</span>
                <span class="tabular-nums">{{ trackerSettings.warmupTolerance }}</span>
              </div>
              <input
                type="range"
                v-model.number="trackerSettings.warmupTolerance"
                min="0"
                max="20"
                step="1"
                class="w-full accent-emerald-500"
              />
            </label>
            <label class="block mb-2">
              <div class="flex justify-between text-xs opacity-70 mb-1">
                <span>missTolerance</span>
                <span class="tabular-nums">{{ trackerSettings.missTolerance }}</span>
              </div>
              <input
                type="range"
                v-model.number="trackerSettings.missTolerance"
                min="0"
                max="20"
                step="1"
                class="w-full accent-emerald-500"
              />
            </label>
            <button
              @click="restartAR"
              class="w-full mt-2 bg-neutral-700 hover:bg-neutral-600 rounded py-2 text-xs"
            >
              Restart AR
            </button>
          </section>

          <RouterLink
            to="/debug"
            class="block text-center bg-emerald-600 hover:bg-emerald-500 rounded py-2 text-xs font-medium"
          >
            Open Model Debugger →
          </RouterLink>
        </aside>

        <Controls
          v-if="!capturing"
          :show-rotate="bpJacketActive"
          @onInitCapture="initCapture()"
          @onRecordStarted="startRecording()"
          @onRecordEnded="stopRecording()"
          @onRotateStart="handleRotateStart"
          @onRotateEnd="handleRotateEnd"
        />
        <CaptureImage
          :open="openCapture"
          @onClose="openCapture = false"
          :captured-image="capturedImage"
        />
        <CaptureVideo
          :open="openVideoView"
          :videoUrl="capturedVideo"
          @onClose="closeVideoView"
          :canvasWidth="canvasWidth"
          :canvasHeight="canvasHeight"
        />
      </div>
    </Transition>
  </main>
</template>

<script setup>
import App from '../includes/App.js'
import Controls from '../components/Controls.vue'
import CaptureImage from '../components/CaptureImage.vue'
import CaptureVideo from '../components/CaptureVideo.vue'
import WelcomeScreen from '../components/WelcomeScreen.vue'
import { onBeforeUnmount, onMounted, reactive, ref, watch, nextTick } from 'vue'
import { RouterLink } from 'vue-router'

const openCapture = ref(false)
const arApp = ref(null)
const capturedImage = ref(null)
const capturedModel = ref(null)
const capturing = ref(false)
const capturedVideo = ref(null)
const captureTimeout = ref(null)
const openVideoView = ref(false)

const started = ref(false)
const starting = ref(false)
const welcomeError = ref('')
const bpJacketActive = ref(false)

const arDebugOpen = ref(false)
const animationsEnabled = ref(true)
const preferStandardCamera = ref(true)
const selectedCameraLabel = ref('')
const actualResolution = ref('')
const RESOLUTION_PRESETS = {
  auto: null,
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
  '4K': { width: 3840, height: 2160 },
}
const resolutionPreset = ref('1080p')
const trackerSettings = reactive({
  filterMinCF: 0.0001,
  filterBeta: 0.01,
  warmupTolerance: 5,
  missTolerance: 5,
})

const syncDebugHash = () => {
  arDebugOpen.value = window.location.hash === '#debug'
}

const closeArDebug = () => {
  history.replaceState(null, '', window.location.pathname + window.location.search)
  arDebugOpen.value = false
}

const applyTrackerSettings = () => {
  if (!app?.mindArTHREE) return
  app.mindArTHREE.filterMinCF = trackerSettings.filterMinCF
  app.mindArTHREE.filterBeta = trackerSettings.filterBeta
  app.mindArTHREE.warmupTolerance = trackerSettings.warmupTolerance
  app.mindArTHREE.missTolerance = trackerSettings.missTolerance
}

const applyCameraResolution = () => {
  if (!app) return
  app.cameraResolution = RESOLUTION_PRESETS[resolutionPreset.value]
}

const refreshActualResolution = () => {
  const s = app?.actualCameraSettings
  actualResolution.value = s ? `${s.width}×${s.height}` : ''
}

const restartAR = async () => {
  if (!app) return
  app.stopAR()
  applyTrackerSettings()
  app.preferStandardCamera = preferStandardCamera.value
  applyCameraResolution()
  await app.startAR()
  selectedCameraLabel.value = app.selectedCameraLabel ?? ''
  refreshActualResolution()
}

watch(trackerSettings, applyTrackerSettings, { deep: true })
watch(animationsEnabled, (v) => { if (app) app.animationsEnabled = v })
watch(preferStandardCamera, (v) => { if (app) app.preferStandardCamera = v })

onMounted(() => {
  syncDebugHash()
  window.addEventListener('hashchange', syncDebugHash)
})

let video
let app
let orientationHandler

const getCameraIssue = async () => {
  if (!window.isSecureContext) {
    return 'Open this app on localhost or HTTPS before starting the camera.'
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Use a browser and device that expose getUserMedia for camera access.'
  }

  if (!navigator.permissions?.query) {
    return ''
  }

  try {
    const permission = await navigator.permissions.query({ name: 'camera' })
    if (permission.state === 'denied') {
      return 'Allow camera access for this site in your browser settings, then try again.'
    }
  } catch {
    return ''
  }

  return ''
}

const handleStart = async () => {
  if (starting.value) return
  starting.value = true
  welcomeError.value = ''

  const issue = await getCameraIssue()
  if (issue) {
    welcomeError.value = issue
    starting.value = false
    return
  }

  try {
    started.value = true
    await nextTick()

    app = new App()
    app.onBpJacketTargetChanged = (found) => {
      bpJacketActive.value = found
    }
    app.animationsEnabled = animationsEnabled.value
    app.preferStandardCamera = preferStandardCamera.value
    applyCameraResolution()
    applyTrackerSettings()
    await app.startAR()
    selectedCameraLabel.value = app.selectedCameraLabel ?? ''
    refreshActualResolution()

    orientationHandler = () => {
      app.stopAR()
      setTimeout(() => app.startAR(), 1000)
    }
    window.addEventListener('orientationchange', orientationHandler)
  } catch (err) {
    console.error(err)
    started.value = false
    welcomeError.value = 'Unable to start the camera. Allow access and try again.'
  } finally {
    starting.value = false
  }
}

const initCapture = () => {
  if (captureTimeout.value) clearTimeout(captureTimeout.value)
  capturing.value = true
  video = document.querySelector('video')
  captureTimeout.value = setTimeout(() => {
    capture()
  }, 300)
}

const capture = async () => {
  const el = arApp.value
  el.style.pointerEvents = 'auto'

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight

  const videoWidth = video.videoWidth
  const videoHeight = video.videoHeight

  canvas.width = screenWidth
  canvas.height = screenHeight

  const screenAspectRatio = screenWidth / screenHeight
  const videoAspectRatio = videoWidth / videoHeight

  let scaledWidth, scaledHeight, offsetX, offsetY

  if (videoAspectRatio > screenAspectRatio) {
    scaledHeight = screenHeight
    scaledWidth = screenHeight * videoAspectRatio
    offsetX = (screenWidth - scaledWidth) / 2
    offsetY = 0
  } else {
    scaledWidth = screenWidth
    scaledHeight = screenWidth / videoAspectRatio
    offsetX = 0
    offsetY = (screenHeight - scaledHeight) / 2
  }

  context.drawImage(video, offsetX, offsetY, scaledWidth, scaledHeight)

  capturedModel.value = await app.capture()

  const modelImage = new Image()
  modelImage.src = capturedModel.value

  modelImage.onload = () => {
    context.drawImage(modelImage, 0, 0, screenWidth, screenHeight)
    capturedImage.value = canvas.toDataURL()

    try {
      openCapture.value = true
    } catch (error) {
      console.log(error)
    } finally {
      el.style.pointerEvents = 'none'
      video.style.maxWidth = 'inherit'
    }
    capturing.value = false
  }
}

const handleRotateStart = (direction) => {
  if (app) app.setBpJacketRotation(direction)
}

const handleRotateEnd = () => {
  if (app) app.setBpJacketRotation(0)
}

const startRecording = async () => {
  app.startVideoCapture()
}

const getVideoInterval = ref(null)
const stopRecording = () => {
  app.stopVideoCapture()
  openVideoView.value = true
  getVideoInterval.value = setInterval(() => {
    capturedVideo.value = app.tempVideoURL
  }, 300)
}

const closeVideoView = () => {
  openVideoView.value = false
  capturedVideo.value = null
}

const canvasWidth = ref(0)
const canvasHeight = ref(0)

watch(
  () => capturedVideo.value,
  (captVideo) => {
    if (captVideo) {
      canvasWidth.value = app.canvasWidth
      canvasHeight.value = app.canvasHeight
      clearInterval(getVideoInterval.value)
    }
  },
)

onBeforeUnmount(() => {
  if (captureTimeout.value) clearTimeout(captureTimeout.value)
  if (orientationHandler) window.removeEventListener('orientationchange', orientationHandler)
  window.removeEventListener('hashchange', syncDebugHash)
  if (app) app.stopAR()
})
</script>

<style lang="scss" scoped>
#ar-app {
  width: 100%;
  height: 100%;
  position: fixed;
  top: 0%;
  left: 0%;
  overflow: hidden;
  pointer-events: none;
}

.welcome-enter-active,
.welcome-leave-active {
  transition:
    opacity 500ms ease,
    transform 500ms ease;
}
.welcome-enter-from,
.welcome-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

.ar-ui-enter-active {
  transition: opacity 600ms ease 250ms;
}
.ar-ui-leave-active {
  transition: opacity 300ms ease;
}
.ar-ui-enter-from,
.ar-ui-leave-to {
  opacity: 0;
}
</style>
