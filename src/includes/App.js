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
      { file: '/models/bp-jacket-opt-1.glb', clipIndex: 0 }, // 3: Tag / container
      { file: '/models/train.glb', clipIndex: 0 }, // 4: CO2
      { file: '/models/train.glb', clipIndex: 0 }, // 5: Bor
      { file: '/models/train.glb', clipIndex: 0 }, // 6: CO2 solid
    ]
    this.mixers = []

    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoStream = null
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

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })

    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.container.appendChild(this.renderer.domElement)

    this.camera = this.mindArTHREE.camera
    this.scene = this.mindArTHREE.scene

    this.mindArTHREE.filterMinCF = 0.0001
    this.mindArTHREE.filterBeta = 0.001
    this.mindArTHREE.warmupTolerance = 1
    this.mindArTHREE.missTolerance = 1

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
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer)
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

    if (startButton) {
      startButton.addEventListener('click', () => {
        this.startAR()
      })
    }

    if (stopButton) {
      stopButton.addEventListener('click', () => {
        this.stopAR()
      })
    }
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
    const configParam = {
      animationSpeed: 0.6,
      interval: 1000 / 35,
    }
    let previousTime = 0
    let deltaTime = 0

    this.renderer.setAnimationLoop((time) => {
      deltaTime = ((time - previousTime) / 1000) * configParam.animationSpeed
      previousTime = time

      this.mixers.forEach((mixer) => mixer && mixer.update(deltaTime))

      this.renderer.render(this.scene, this.camera)
    })
  }

  setupDracoAndLoader() {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    this.gltfLoader = new GLTFLoader()
    this.gltfLoader.setDRACOLoader(dracoLoader)
  }

  reRender() {
    this.renderer.render(this.scene, this.camera)
  }

  async capture() {
    if (!this.renderer) {
      console.error('Renderer is not initialized')
      return
    }

    const webGLCanvas = this.renderer.domElement
    const canvas = document.createElement('canvas')
    canvas.width = webGLCanvas.width
    canvas.height = webGLCanvas.height

    const context = canvas.getContext('2d')
    context.drawImage(webGLCanvas, 0, 0)

    const dataURL = canvas.toDataURL('image/png')
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

    const canvas = document.createElement('canvas')
    canvas.width = this.renderer.domElement.width
    canvas.height = this.renderer.domElement.height

    this.mindARVideo = this.mindArTHREE.video
    this.canvasWidth = canvas.width
    this.canvasHeight = canvas.height

    const ctx = canvas.getContext('2d')
    const webGLCanvas = this.renderer.domElement

    this.videoStream = canvas.captureStream(30)

    const options = {
      mimeType: 'video/mp4; codecs="avc1.42E01E"',
    }

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.warn('MP4 format not supported in this browser. Falling back to WebM.')
      options.mimeType = 'video/webm'
    }

    this.mediaRecorder = new MediaRecorder(this.videoStream, options)

    this.recordedChunks = []
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = async () => {
      const videoBlob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType })
      const videoURL = URL.createObjectURL(videoBlob)
      this.tempVideoURL = videoURL
    }

    const render = () => {
      const videoAspect = this.mindarVideo.videoWidth / this.mindarVideo.videoHeight
      const canvasAspect = canvas.width / canvas.height

      let sx, sy, sWidth, sHeight

      if (videoAspect > canvasAspect) {
        sHeight = this.mindarVideo.videoHeight
        sWidth = sHeight * canvasAspect
        sx = (this.mindarVideo.videoWidth - sWidth) / 2
        sy = 0
      } else {
        sWidth = this.mindarVideo.videoWidth
        sHeight = sWidth / canvasAspect
        sx = 0
        sy = (this.mindarVideo.videoHeight - sHeight) / 2
      }

      ctx.drawImage(
        this.mindarVideo,
        sx,
        sy,
        sWidth,
        sHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      )

      ctx.drawImage(webGLCanvas, 0, 0, canvas.width, canvas.height)

      if (this.mediaRecorder.state === 'recording') {
        requestAnimationFrame(render)
      }
    }

    this.mediaRecorder.start()
    render()
  }

  stopVideoCapture() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop()
      this.videoStream.getTracks().forEach((track) => track.stop())
    }
  }
}

export default App
