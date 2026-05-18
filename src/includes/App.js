import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MindARThree } from 'mind-ar/dist/mindar-image-three.prod.js'
import { markerConfigs, BP_JACKET_INDEX, SHIP_OCEAN_INDEX } from './markerConfigs.js'

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
    this.markerConfigs = markerConfigs
    this.mixers = []

    this.mediaRecorder = null
    this.recordedChunks = []
    this.videoStream = null
    this.tempVideoURL = null
    this.mindarVideo = null

    this.canvasWidth = 0
    this.canvasHeight = 0
    this.mindARVideo = null

    this.bpJacketIndex = BP_JACKET_INDEX
    this.bpJacketModel = null
    this.bpJacketRotationY = 0
    this.bpJacketTargetFound = false
    this.onBpJacketTargetChanged = null
    this.manualRotateDirection = 0
    this.lastInteractionTime = 0
    this.autoRotateSpeed = 0.01
    this.manualRotateSpeed = 0.03
    this.autoRotateResumeDelay = 1500

    this.shipOceanIndex = SHIP_OCEAN_INDEX
    this.shipOceanMesh = null
    this.shipOceanShipParts = []
    this.shipBobAmplitude = 0.28
    this.shipBobSpeed = 0
    this.oceanScrollSpeed = { x: 0.025, y: 0.02 }

    this.animationsEnabled = true

    this.selectedCameraLabel = null
    this.selectedCameraId = null
    this.preferStandardCamera = true
    this.cameraResolution = { width: 1920, height: 1080 }
    this.actualCameraSettings = null

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
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.container.appendChild(this.renderer.domElement)

    this.camera = this.mindArTHREE.camera
    this.scene = this.mindArTHREE.scene

    this.mindArTHREE.filterMinCF = 0.0001
    this.mindArTHREE.filterBeta = 0.01
    this.mindArTHREE.warmupTolerance = 5
    this.mindArTHREE.missTolerance = 5

    this.anchors = this.markerConfigs.map((_, i) => this.mindArTHREE.addAnchor(i))
  }

  addModel() {
    this.markerConfigs.forEach((config, index) => {
      this.gltfLoader.load(config.file, (gltf) => {
        const model = gltf.scene
        model.scale.set(0.15, 0.15, 0.15)
        model.position.set(0, 0, 0)

        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        model.position.sub(center)

        model.traverse((child) => {
          if (!child.isMesh) return

          const fixMaterial = (src) => {
            if (!src) return src

            if (src.map) src.map.colorSpace = THREE.SRGBColorSpace
            if (src.emissiveMap) src.emissiveMap.colorSpace = THREE.SRGBColorSpace

            if (config.baked) {
              return new THREE.MeshBasicMaterial({
                map: src.map ?? null,
                color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
                alphaMap: src.alphaMap ?? null,
                transparent: src.transparent ?? false,
                opacity: src.opacity ?? 1,
                side: src.side ?? THREE.FrontSide,
              })
            }

            src.envMapIntensity = 1
            src.needsUpdate = true
            return src
          }

          child.material = Array.isArray(child.material)
            ? child.material.map(fixMaterial)
            : fixMaterial(child.material)
        })

        if (index === this.shipOceanIndex) {
          this.setupShipOcean(model)
        }

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

        if (index === this.bpJacketIndex) {
          this.bpJacketModel = model
        }
      })
    })

    const bpAnchor = this.anchors[this.bpJacketIndex]
    if (bpAnchor) {
      bpAnchor.onTargetFound = () => {
        this.bpJacketTargetFound = true
        this.onBpJacketTargetChanged?.(true)
      }
      bpAnchor.onTargetLost = () => {
        this.bpJacketTargetFound = false
        this.manualRotateDirection = 0
        this.onBpJacketTargetChanged?.(false)
      }
    }
  }

  setupShipOcean(model) {
    let oceanMesh = null
    const shipParts = []

    model.traverse((child) => {
      if (!child.isMesh) return
      if (/ocean|water|sea/i.test(child.name)) {
        oceanMesh = child
      } else {
        shipParts.push(child)
      }
    })

    if (!oceanMesh) {
      const names = []
      model.traverse((c) => { if (c.isMesh) names.push(c.name) })
      console.warn('[ship-ocean] no ocean mesh found; child mesh names:', names)
      return
    }

    const waterNormals = new THREE.TextureLoader().load(
      'https://threejs.org/examples/textures/waternormals.jpg',
    )
    waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping
    waterNormals.repeat.set(3, 3)

    const oldMaterial = oceanMesh.material
    oceanMesh.material = new THREE.MeshStandardMaterial({
      color: 0x00365c,
      metalness: 0.35,
      roughness: 0.24,
      normalMap: waterNormals,
      normalScale: new THREE.Vector2(0.4, 0.4),
      envMapIntensity: 1.0,
    })
    if (Array.isArray(oldMaterial)) oldMaterial.forEach((m) => m?.dispose?.())
    else oldMaterial?.dispose?.()

    this.shipOceanMesh = oceanMesh
    this.shipOceanShipParts = shipParts.map((obj) => ({ obj, baseY: obj.position.y }))
  }

  setBpJacketRotation(direction) {
    this.manualRotateDirection = direction
    if (direction === 0) {
      this.lastInteractionTime = performance.now()
    }
  }

  addLight() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer)
    pmremGenerator.compileEquirectangularShader()

    this.neutralEnvironment = pmremGenerator.fromScene(new RoomEnvironment()).texture
    this.scene.environment = this.neutralEnvironment
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2

    const light = new THREE.DirectionalLight(0xffffff, 1.6)
    light.position.set(0, 1, 3)
    this.scene.add(light)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9)
    this.scene.add(ambientLight)

    pmremGenerator.dispose()
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

  async selectBestBackCamera() {
    if (!navigator.mediaDevices?.enumerateDevices) return null

    let permissionStream = null
    try {
      permissionStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
    } catch (e) {
      console.warn('[camera] permission probe failed', e)
      return null
    }

    let videoInputs = []
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      videoInputs = devices.filter((d) => d.kind === 'videoinput')
    } finally {
      permissionStream.getTracks().forEach((t) => t.stop())
    }

    if (videoInputs.length === 0) return null

    const backCams = videoInputs.filter((d) => /back|rear|environment/i.test(d.label))
    const pool = backCams.length ? backCams : videoInputs

    const isUltra = (l) => /ultra.?wide|wide.?angle|0[.,]5x/i.test(l)
    const isTele = (l) => /tele(photo)?|2x|3x|5x|10x/i.test(l)

    const preferred = pool.find((d) => !isUltra(d.label) && !isTele(d.label))
    const chosen = preferred ?? pool[0]

    this.selectedCameraLabel = chosen.label || '(unlabeled)'
    this.selectedCameraId = chosen.deviceId
    console.log('[camera] selected:', this.selectedCameraLabel, 'from', videoInputs.map((d) => d.label))
    return chosen.deviceId
  }

  async startAR() {
    let deviceId = null
    if (this.preferStandardCamera) {
      deviceId = await this.selectBestBackCamera()
    }

    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const videoCons =
        constraints && typeof constraints.video === 'object' && constraints.video !== null
          ? constraints.video
          : {}
      const mergedVideo = { ...videoCons }
      if (this.cameraResolution?.width) {
        mergedVideo.width = { ideal: this.cameraResolution.width }
      }
      if (this.cameraResolution?.height) {
        mergedVideo.height = { ideal: this.cameraResolution.height }
      }
      if (deviceId) mergedVideo.deviceId = { exact: deviceId }
      try {
        return await original({ ...constraints, video: mergedVideo })
      } catch (e) {
        console.warn('[camera] preferred constraints failed, falling back', e)
        return await original(constraints)
      }
    }

    try {
      await this.mindArTHREE.start()
    } finally {
      navigator.mediaDevices.getUserMedia = original
    }

    const track = this.mindArTHREE.video?.srcObject?.getVideoTracks?.()[0]
    this.actualCameraSettings = track?.getSettings?.() ?? null
    if (this.actualCameraSettings) {
      console.log(
        '[camera] active stream:',
        `${this.actualCameraSettings.width}x${this.actualCameraSettings.height}`,
        this.actualCameraSettings,
      )
    }

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
      const rawDelta = (time - previousTime) / 1000
      deltaTime = rawDelta * configParam.animationSpeed
      previousTime = time

      if (this.animationsEnabled) {
        this.mixers.forEach((mixer) => mixer && mixer.update(deltaTime))

        if (this.shipOceanMesh) {
          const nm = this.shipOceanMesh.material.normalMap
          if (nm) {
            nm.offset.x = (nm.offset.x + rawDelta * this.oceanScrollSpeed.x) % 1
            nm.offset.y = (nm.offset.y + rawDelta * this.oceanScrollSpeed.y) % 1
          }
        }

        if (this.shipOceanShipParts.length > 0) {
          const bob = Math.sin(time * this.shipBobSpeed) * this.shipBobAmplitude
          for (const part of this.shipOceanShipParts) {
            part.obj.position.y = part.baseY + bob
          }
        }
      }

      if (this.bpJacketModel && this.bpJacketTargetFound) {
        if (this.manualRotateDirection !== 0) {
          this.bpJacketRotationY += this.manualRotateDirection * this.manualRotateSpeed
          this.bpJacketModel.rotation.y = this.bpJacketRotationY
          this.lastInteractionTime = time
        } else {
          const idleFor = time - this.lastInteractionTime
          if (this.lastInteractionTime === 0 || idleFor > this.autoRotateResumeDelay) {
            // this.bpJacketRotationY += this.autoRotateSpeed
            // this.bpJacketModel.rotation.y = this.bpJacketRotationY
          }
        }
      }

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
