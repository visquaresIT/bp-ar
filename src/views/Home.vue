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
        <Controls
          v-if="!capturing"
          @onInitCapture="initCapture()"
          @onRecordStarted="startRecording()"
          @onRecordEnded="stopRecording()"
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
import { onBeforeUnmount, ref, watch, nextTick } from 'vue'

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
    await app.startAR()

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
