<template>
  <main>
    <div ref="arApp" id="ar-app"></div>
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
  </main>
</template>

<script setup>
import App from '../includes/App.js'
import Controls from '../components/Controls.vue'
import CaptureImage from '../components/CaptureImage.vue'
import CaptureVideo from '../components/CaptureVideo.vue'
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'

const openCapture = ref(false)
const arApp = ref(null)
const capturedImage = ref(null)
const capturedModel = ref(null)
const capturing = ref(false)
const capturedVideo = ref(null)
const captureTimeout = ref(null)
const openVideoView = ref(false)
let video
let app
const isLandscape = ref(false)
onMounted(() => {
  app = new App()
  app.startAR()
  window.addEventListener('orientationchange', function (e) {
    app.stopAR()
    setTimeout(() => {
      app.startAR()
    }, 1000)
  })
})

const initCapture = () => {
  if (captureTimeout.value) clearTimeout(captureTimeout.value)
  capturing.value = true
  video = document.querySelector('video')
  captureTimeout.value = setTimeout(() => {
    capture()
  }, 300)
}

const capture = async () => {
  const el = arApp.value // Parent container for AR app
  el.style.pointerEvents = 'auto' // Allow interactions if needed

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  // Screen dimensions
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight

  // Video natural dimensions
  const videoWidth = video.videoWidth
  const videoHeight = video.videoHeight

  // Set canvas dimensions to match the screen
  canvas.width = screenWidth
  canvas.height = screenHeight

  // Calculate the scale to fit the video within the screen
  const screenAspectRatio = screenWidth / screenHeight
  const videoAspectRatio = videoWidth / videoHeight

  let scaledWidth, scaledHeight, offsetX, offsetY

  if (videoAspectRatio > screenAspectRatio) {
    // Video is wider than the screen: fit to screen height
    scaledHeight = screenHeight
    scaledWidth = screenHeight * videoAspectRatio
    offsetX = (screenWidth - scaledWidth) / 2 // Center horizontally
    offsetY = 0 // No vertical offset
  } else {
    // Video is taller than the screen: fit to screen width
    scaledWidth = screenWidth
    scaledHeight = screenWidth / videoAspectRatio
    offsetX = 0 // No horizontal offset
    offsetY = (screenHeight - scaledHeight) / 2 // Center vertically
  }

  // Draw the video onto the canvas
  context.drawImage(
    video,
    offsetX, // Destination x (canvas)
    offsetY, // Destination y (canvas)
    scaledWidth, // Destination width (scaled)
    scaledHeight, // Destination height (scaled)
  )

  // Capture the 3D model
  capturedModel.value = await app.capture()

  // Create an Image object for the captured 3D model
  const modelImage = new Image()
  modelImage.src = capturedModel.value

  modelImage.onload = () => {
    // Draw the 3D model onto the video canvas
    context.drawImage(modelImage, 0, 0, screenWidth, screenHeight)

    // Convert the canvas to a data URL and store it
    capturedImage.value = canvas.toDataURL()

    // Display or save the captured result
    try {
      openCapture.value = true
    } catch (error) {
      console.log(error)
    } finally {
      el.style.pointerEvents = 'none' // Reset pointer events
      video.style.maxWidth = 'inherit'
    }
    capturing.value = false
  }
}

var blob,
  deviceRecorder = null
var chunks = []

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

const cancelRecording = () => {}

onBeforeUnmount(() => {
  if (captureTimeout.value) clearTimeout(captureTimeout.value)
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
</style>
