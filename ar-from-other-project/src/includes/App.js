import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js'

class App {
  constructor() {
    this.container = document.querySelector('#ar-app')
    this.mindArTHREE = null
    this.renderer = null
    this.scene = null
    this.camera = null
    this.anchors = []

    this.neutralEnvironment = null

    this.gltfLoader = null
    this.markerConfigs = [
      { file: '/models/train.glb', clipIndex: 0 }, // 0: 60 YEARS logo
      { file: '/models/train.glb', clipIndex: 0 }, // 1: Indonesia map
      { file: '/models/train.glb', clipIndex: 0 }, // 2: Square pattern
      { file: '/models/train.glb', clipIndex: 0 }, // 3: Tag / container
      { file: '/models/train.glb', clipIndex: 0 }, // 4: CO2
      { file: '/models/train.glb', clipIndex: 0 }, // 5: Bor
      { file: '/models/train.glb', clipIndex: 0 }, // 6: CO2 solid
    ]
    this.mixers = []

    this.mediaRecorder = null // MediaRecorder instance
    this.recordedChunks = [] // Stores video chunks
    this.videoStream = null // MediaStream from canvas
    this.tempVideoURL = null
    this.mindarVideo = null

    this.canvasWidth = 0
    this.canvasHeight = 0
    this.mindARVideo = null

    this.setupDracoAndLoader()
    this.initAR()
    this.addLight()
    this.addModel()
    this.addControl()
  }

  initAR() {
    this.mindArTHREE = new MindARThree({
      container: this.container,
      imageTargetSrc: '/bp-60th-anniversary.mind',
    })

    console.log(this.mindArTHREE)

    // Replace the renderer with one that has preserveDrawingBuffer enabled
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true, // Enable drawing buffer preservation
    })

    // Configure renderer size and attach to container
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.container.appendChild(this.renderer.domElement)

    // Reuse existing camera and scene
    this.camera = this.mindArTHREE.camera
    this.scene = this.mindArTHREE.scene

    // Configure MindAR parameters
    this.mindArTHREE.filterMinCF = 0.0001
    this.mindArTHREE.filterBeta = 0.001
    this.mindArTHREE.warmupTolerance = 1
    this.mindArTHREE.missTolerance = 1

    // Add one anchor per marker
    this.anchors = this.markerConfigs.map((_, i) => this.mindArTHREE.addAnchor(i))
  }

  addModel() {
    this.markerConfigs.forEach((config, index) => {
      this.gltfLoader.load(config.file, (gltf) => {
        const model = gltf.scene
        model.scale.set(0.06, 0.06, 0.06)
        model.position.set(0, 0, 0)

        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        model.position.sub(center)

        model.traverse((child) => {
          if (child.isMesh) {
            child.material.envMap = this.neutralEnvironment
            child.material.needsUpdate = true
          }
        })

        const mixer = new THREE.AnimationMixer(model)
        const clips = gltf.animations || []

        if (config.skipClips) {
          clips.forEach((clip) => {
            if (!config.skipClips.includes(clip.name)) {
              mixer.clipAction(clip).play()
            }
          })
        } else if (typeof config.clipIndex === 'number' && clips[config.clipIndex]) {
          mixer.clipAction(clips[config.clipIndex]).play()
        }

        this.mixers[index] = mixer
        this.anchors[index].group.add(model)
      })
    })
  }

  addLight() {
    let pmremGenerator = new THREE.PMREMGenerator(this.renderer)
    pmremGenerator.compileEquirectangularShader()

    this.neutralEnvironment = pmremGenerator.fromScene(new RoomEnvironment()).texture
    this.scene.environment = this.neutralEnvironment
    this.renderer.toneMapping = THREE.LinearToneMapping
    this.renderer.toneMappingExposure = 1
    this.scene.environment.needsUpdate = true

    const light = new THREE.DirectionalLight(0xffffff, 1.6)
    light.position.set(0, 1, 3)
    light.lookAt(0, 0, 0)
    this.scene.add(light)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9)
    this.scene.add(ambientLight)
  }

  addControl() {
    const startButton = document.querySelector('#startButton')
    const stopButton = document.querySelector('#stopButton')

    startButton.addEventListener('click', () => {
      this.startAR()
    })

    stopButton.addEventListener('click', () => {
      this.stopAR()
    })
  }

  async startAR() {
    await this.mindArTHREE.start()
    this.updateFrame()
  }

  stopAR() {
    this.mindArTHREE.stop()
    this.mindArTHREE.renderer.setAnimationLoop(null)
  }

  updateFrame() {
    const clock = new THREE.Clock()
    let previousTime = 0
    const configParam = {
      animationSpeed: 0.6,
      interval: 1000 / 35,
    }
    let deltaTime = 0
    let explore = false
    let swing = false
    let fov = 45

    this.renderer.setAnimationLoop((time, frame) => {
      deltaTime = ((time - previousTime) / 1000) * configParam.animationSpeed
      previousTime = time

      this.mixers.forEach((mixer) => mixer && mixer.update(deltaTime))

      this.renderer.render(this.scene, this.camera)
    })
  }

  setupDracoAndLoader() {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://threejs.org/examples/jsm/libs/draco/')
    this.gltfLoader = new GLTFLoader()
    this.gltfLoader.setDRACOLoader(dracoLoader)
  }

  reRender() {
    this.renderer.render(this.scene, this.camera)
  }

  async capture() {
    // Ensure the renderer is initialized
    if (!this.renderer) {
      console.error('Renderer is not initialized')
      return
    }

    // Get the WebGL canvas
    const webGLCanvas = this.renderer.domElement

    // Create a 2D canvas
    const canvas = document.createElement('canvas')
    canvas.width = webGLCanvas.width
    canvas.height = webGLCanvas.height

    const context = canvas.getContext('2d')

    // Copy WebGL canvas content to the 2D canvas
    context.drawImage(webGLCanvas, 0, 0)

    // Convert the canvas content to an image URL (data URL format)
    const dataURL = canvas.toDataURL('image/png')

    // Optionally, display or save the captured image
    // console.log('Captured Image Data URL:', dataURL)

    // Example: Create an image element to display the capture
    const capturedImage = document.createElement('img')
    capturedImage.src = dataURL
    return capturedImage.src
  }

  async startVideoCapture() {
    this.mindarVideo = this.mindArTHREE.video
    if (!this.renderer || !this.mindarVideo) {
      console.error('Renderer or MindAR video is not initialized')
      return
    }

    // Create an off-screen canvas
    const canvas = document.createElement('canvas')
    canvas.width = this.renderer.domElement.width
    canvas.height = this.renderer.domElement.height

    this.mindARVideo = this.mindArTHREE.video
    this.canvasWidth = canvas.width
    this.canvasHeight = canvas.height

    const ctx = canvas.getContext('2d')
    const webGLCanvas = this.renderer.domElement

    // Create a media stream from the canvas
    this.videoStream = canvas.captureStream(30) // 30 FPS

    // Attempt to use MP4 (H.264) for recording
    const options = {
      mimeType: 'video/mp4; codecs="avc1.42E01E"',
    }

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.warn('MP4 format not supported in this browser. Falling back to WebM.')
      options.mimeType = 'video/webm' // Fallback to WebM
    }

    this.mediaRecorder = new MediaRecorder(this.videoStream, options)

    // Store recorded chunks
    this.recordedChunks = []
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data)
      }
    }

    // Handle stop event
    this.mediaRecorder.onstop = async () => {
      // Combine chunks into a Blob
      const videoBlob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType })
      const videoURL = URL.createObjectURL(videoBlob)
      this.tempVideoURL = videoURL // Save the video URL
    }

    // Start rendering and capturing
    const render = () => {
      // Calculate MindAR video aspect ratio
      const videoAspect = this.mindarVideo.videoWidth / this.mindarVideo.videoHeight
      const canvasAspect = canvas.width / canvas.height

      let sx, sy, sWidth, sHeight

      if (videoAspect > canvasAspect) {
        // Video is wider than canvas: crop width
        sHeight = this.mindarVideo.videoHeight
        sWidth = sHeight * canvasAspect
        sx = (this.mindarVideo.videoWidth - sWidth) / 2
        sy = 0
      } else {
        // Video is taller than canvas: crop height
        sWidth = this.mindarVideo.videoWidth
        sHeight = sWidth / canvasAspect
        sx = 0
        sy = (this.mindarVideo.videoHeight - sHeight) / 2
      }

      // Draw MindAR video feed (scaled and cropped)
      ctx.drawImage(
        this.mindarVideo,
        sx,
        sy,
        sWidth,
        sHeight, // Source (crop) dimensions
        0,
        0,
        canvas.width,
        canvas.height, // Destination (canvas) dimensions
      )

      // Draw WebGL (3D model) content
      ctx.drawImage(webGLCanvas, 0, 0, canvas.width, canvas.height)

      if (this.mediaRecorder.state === 'recording') {
        requestAnimationFrame(render) // Continue rendering while recording
      }
    }

    // Start recording
    this.mediaRecorder.start()
    render()
  }

  stopVideoCapture() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop()
      this.videoStream.getTracks().forEach((track) => track.stop()) // Stop stream
    }
  }
}

export default App
