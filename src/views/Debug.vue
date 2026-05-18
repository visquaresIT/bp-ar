<template>
  <main class="fixed inset-0 bg-neutral-900 text-white overflow-hidden">
    <div ref="canvasHost" class="absolute inset-0"></div>

    <aside
      class="absolute top-0 right-0 h-full w-80 bg-neutral-900/90 backdrop-blur p-4 overflow-y-auto text-sm shadow-2xl border-l border-neutral-700"
    >
      <div class="flex items-center justify-between mb-3">
        <h1 class="font-semibold">AR Debug</h1>
        <RouterLink to="/" class="text-xs opacity-70 hover:opacity-100 underline">
          ← Home
        </RouterLink>
      </div>

      <label class="block text-xs uppercase tracking-wider opacity-60 mb-1">Model</label>
      <select
        v-model.number="selectedIndex"
        class="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 mb-4"
      >
        <option v-for="(cfg, i) in markerConfigs" :key="i" :value="i">
          {{ i }} — {{ cfg.file.replace('/models/', '') }}
        </option>
      </select>

      <p v-if="loading" class="text-xs opacity-60 mb-3">Loading…</p>
      <p v-if="loadError" class="text-xs text-red-400 mb-3">{{ loadError }}</p>

      <template v-if="current">
      <section class="mb-4">
        <h2 class="text-xs uppercase tracking-wider opacity-60 mb-2">Transform</h2>
        <SliderRow label="Pos X" v-model.number="current.position.x" :min="-2" :max="2" :step="0.01" />
        <SliderRow label="Pos Y" v-model.number="current.position.y" :min="-2" :max="2" :step="0.01" />
        <SliderRow label="Pos Z" v-model.number="current.position.z" :min="-2" :max="2" :step="0.01" />
        <SliderRow label="Rot X" v-model.number="current.rotation.x" :min="-Math.PI" :max="Math.PI" :step="0.01" />
        <SliderRow label="Rot Y" v-model.number="current.rotation.y" :min="-Math.PI" :max="Math.PI" :step="0.01" />
        <SliderRow label="Rot Z" v-model.number="current.rotation.z" :min="-Math.PI" :max="Math.PI" :step="0.01" />
        <SliderRow label="Scale" v-model.number="current.scale" :min="0.01" :max="2" :step="0.01" />
      </section>

      <section v-if="isShipOcean && current.ocean" class="mb-4">
        <h2 class="text-xs uppercase tracking-wider opacity-60 mb-2">Ocean (env reflection)</h2>
        <ColorRow label="Color" v-model="current.ocean.color" />
        <SliderRow label="Metalness" v-model.number="current.ocean.metalness" :min="0" :max="1" :step="0.01" />
        <SliderRow label="Roughness" v-model.number="current.ocean.roughness" :min="0" :max="1" :step="0.01" />
        <SliderRow label="Normal Scale" v-model.number="current.ocean.normalScale" :min="0" :max="5" :step="0.05" />
        <SliderRow label="Opacity" v-model.number="current.ocean.opacity" :min="0" :max="1" :step="0.01" />
        <SliderRow label="Normal Repeat" v-model.number="current.ocean.normalRepeat" :min="0.5" :max="20" :step="0.5" />
        <SliderRow label="Scroll X" v-model.number="current.ocean.scrollSpeedX" :min="-0.5" :max="0.5" :step="0.005" />
        <SliderRow label="Scroll Y" v-model.number="current.ocean.scrollSpeedY" :min="-0.5" :max="0.5" :step="0.005" />
      </section>

      <section v-if="isShipOcean && current.buoyancy" class="mb-4">
        <h2 class="text-xs uppercase tracking-wider opacity-60 mb-2">Ship Buoyancy</h2>
        <SliderRow label="Amplitude" v-model.number="current.buoyancy.amplitude" :min="0" :max="0.5" :step="0.005" />
        <SliderRow label="Speed" v-model.number="current.buoyancy.speed" :min="0" :max="0.01" :step="0.0001" />
      </section>

      <section v-if="isBpJacket && current.bpJacket" class="mb-4">
        <h2 class="text-xs uppercase tracking-wider opacity-60 mb-2">BP Jacket Rotation</h2>
        <SliderRow label="Manual Speed" v-model.number="current.bpJacket.manualRotateSpeed" :min="0" :max="0.2" :step="0.001" />
        <SliderRow label="Auto Speed" v-model.number="current.bpJacket.autoRotateSpeed" :min="0" :max="0.1" :step="0.001" />
        <SliderRow label="Resume Delay (ms)" v-model.number="current.bpJacket.autoRotateResumeDelay" :min="0" :max="5000" :step="100" />
      </section>

      <div class="flex gap-2 mt-4">
        <button
          @click="copyJson"
          class="flex-1 bg-emerald-600 hover:bg-emerald-500 rounded py-2 text-xs font-medium"
        >
          Copy JSON
        </button>
        <button
          @click="resetCurrent"
          class="bg-neutral-700 hover:bg-neutral-600 rounded py-2 px-3 text-xs"
        >
          Reset
        </button>
      </div>
      <p v-if="hint" class="text-xs opacity-60 mt-2">{{ hint }}</p>
      </template>
    </aside>
  </main>
</template>

<script setup>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, h } from 'vue'
import { RouterLink } from 'vue-router'
import { markerConfigs, BP_JACKET_INDEX, SHIP_OCEAN_INDEX } from '../includes/markerConfigs.js'

const STORAGE_KEY = 'bp-ar:debug:v2'
const WATER_NORMALS_URL = 'https://threejs.org/examples/textures/waternormals.jpg'

const SliderRow = {
  props: ['label', 'modelValue', 'min', 'max', 'step'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('label', { class: 'block mb-2' }, [
      h('div', { class: 'flex justify-between text-xs opacity-70 mb-1' }, [
        h('span', props.label),
        h('span', { class: 'tabular-nums' }, Number(props.modelValue).toFixed(4)),
      ]),
      h('input', {
        type: 'range',
        min: props.min, max: props.max, step: props.step,
        value: props.modelValue,
        class: 'w-full accent-emerald-500',
        onInput: (e) => emit('update:modelValue', Number(e.target.value)),
      }),
    ])
  },
}

const ColorRow = {
  props: ['label', 'modelValue'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('label', { class: 'flex items-center justify-between mb-2 text-xs' }, [
      h('span', { class: 'opacity-70' }, props.label),
      h('div', { class: 'flex items-center gap-2' }, [
        h('span', { class: 'opacity-60 tabular-nums' }, props.modelValue),
        h('input', {
          type: 'color',
          value: props.modelValue,
          class: 'w-8 h-8 rounded bg-transparent cursor-pointer',
          onInput: (e) => emit('update:modelValue', e.target.value),
        }),
      ]),
    ])
  },
}

const canvasHost = ref(null)
const selectedIndex = ref(0)
const loading = ref(false)
const loadError = ref('')
const hint = ref('')

const states = reactive({})

const current = computed(() => states[selectedIndex.value])

const isShipOcean = computed(() => selectedIndex.value === SHIP_OCEAN_INDEX)
const isBpJacket = computed(() => selectedIndex.value === BP_JACKET_INDEX)

function defaultStateFor(index) {
  const base = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 0.15,
  }
  if (index === SHIP_OCEAN_INDEX) {
    base.ocean = {
      color: '#004475',
      metalness: 1.0,
      roughness: 0.15,
      normalScale: 1.5,
      opacity: 1.0,
      normalRepeat: 4.0,
      scrollSpeedX: 0.03,
      scrollSpeedY: 0.02,
    }
    base.buoyancy = { amplitude: 0.05, speed: 0.0015 }
  }
  if (index === BP_JACKET_INDEX) {
    base.bpJacket = {
      manualRotateSpeed: 0.03,
      autoRotateSpeed: 0.01,
      autoRotateResumeDelay: 1500,
    }
  }
  return base
}

function deepAssign(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key]) {
      deepAssign(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

function loadStates() {
  let saved = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    saved = raw ? JSON.parse(raw) : {}
  } catch {}
  markerConfigs.forEach((_, i) => {
    const def = defaultStateFor(i)
    if (saved[i]) deepAssign(def, saved[i])
    states[i] = def
  })
}

function saveStates() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(states)) } catch {}
}

let renderer, scene, camera, controls, mixer
let currentModel = null
let oceanMesh = null
let shipParts = []
let clock = new THREE.Clock()
let raf = null
let resizeObserver = null

function clearScene() {
  if (currentModel) {
    scene.remove(currentModel)
    currentModel.traverse((c) => {
      if (c.isMesh) {
        c.geometry?.dispose?.()
        const m = c.material
        if (Array.isArray(m)) m.forEach((x) => x?.dispose?.())
        else m?.dispose?.()
      }
    })
    currentModel = null
  }
  oceanMesh = null
  shipParts = []
  mixer = null
}

let gltfLoader = null
function setupLoader() {
  const draco = new DRACOLoader()
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
  gltfLoader = new GLTFLoader()
  gltfLoader.setDRACOLoader(draco)
}

function loadModel(index) {
  clearScene()
  loading.value = true
  loadError.value = ''
  const cfg = markerConfigs[index]
  gltfLoader.load(
    cfg.file,
    (gltf) => {
      const model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      model.position.sub(center)

      model.traverse((child) => {
        if (!child.isMesh) return
        const fixMaterial = (src) => {
          if (!src) return src
          if (src.map) src.map.colorSpace = THREE.SRGBColorSpace
          if (src.emissiveMap) src.emissiveMap.colorSpace = THREE.SRGBColorSpace
          if (cfg.baked) {
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

      if (index === SHIP_OCEAN_INDEX) {
        setupShipOcean(model)
      }

      const clips = gltf.animations || []
      if (typeof cfg.clipIndex === 'number' && clips[cfg.clipIndex]) {
        mixer = new THREE.AnimationMixer(model)
        mixer.clipAction(clips[cfg.clipIndex]).play()
      }

      currentModel = model
      scene.add(model)
      applyState()
      loading.value = false
    },
    undefined,
    (err) => {
      loading.value = false
      loadError.value = `Failed to load ${cfg.file}: ${err?.message ?? err}`
    },
  )
}

function setupShipOcean(model) {
  let foundOcean = null
  const parts = []
  model.traverse((child) => {
    if (!child.isMesh) return
    if (/ocean|water|sea/i.test(child.name)) foundOcean = child
    else parts.push(child)
  })
  shipParts = parts.map((obj) => ({ obj, baseY: obj.position.y }))

  if (!foundOcean) {
    const names = []
    model.traverse((c) => { if (c.isMesh) names.push(c.name) })
    console.warn('[debug ship-ocean] no ocean mesh; names:', names)
    return
  }

  const waterNormals = new THREE.TextureLoader().load(WATER_NORMALS_URL)
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping
  waterNormals.repeat.set(4, 4)

  const oldMaterial = foundOcean.material
  foundOcean.material = new THREE.MeshStandardMaterial({
    color: 0x004475,
    metalness: 1.0,
    roughness: 0.15,
    normalMap: waterNormals,
    normalScale: new THREE.Vector2(1.5, 1.5),
    envMapIntensity: 1.0,
  })
  if (Array.isArray(oldMaterial)) oldMaterial.forEach((m) => m?.dispose?.())
  else oldMaterial?.dispose?.()

  oceanMesh = foundOcean
}

function applyState() {
  const s = current.value
  if (!s) return
  if (currentModel) {
    currentModel.position.set(s.position.x, s.position.y, s.position.z)
    currentModel.rotation.set(s.rotation.x, s.rotation.y, s.rotation.z)
    currentModel.scale.setScalar(s.scale)
  }
  if (oceanMesh && s.ocean) {
    const mat = oceanMesh.material
    mat.color.set(s.ocean.color)
    mat.metalness = s.ocean.metalness
    mat.roughness = s.ocean.roughness
    mat.normalScale.set(s.ocean.normalScale, s.ocean.normalScale)
    mat.opacity = s.ocean.opacity
    mat.transparent = s.ocean.opacity < 1
    if (mat.normalMap) mat.normalMap.repeat.set(s.ocean.normalRepeat, s.ocean.normalRepeat)
    mat.needsUpdate = true
  }
}

function copyJson() {
  const s = current.value
  if (!s) return
  const payload = JSON.parse(JSON.stringify(s))
  const text = JSON.stringify({ [selectedIndex.value]: payload }, null, 2)
  navigator.clipboard?.writeText(text).then(
    () => { hint.value = 'Copied to clipboard' },
    () => { hint.value = `Copy failed — value:\n${text}`; console.log(text) },
  )
  setTimeout(() => { hint.value = '' }, 2500)
}

function resetCurrent() {
  states[selectedIndex.value] = defaultStateFor(selectedIndex.value)
  applyState()
}

loadStates()

watch(selectedIndex, (i) => loadModel(i))
watch(current, applyState, { deep: true })
watch(states, saveStates, { deep: true })

function initThree() {
  const host = canvasHost.value
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(host.clientWidth, host.clientHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  host.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a1a)

  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  scene.environment = pmrem.fromScene(new RoomEnvironment()).texture
  pmrem.dispose()

  scene.add(new THREE.AmbientLight(0xffffff, 0.9))
  const dl = new THREE.DirectionalLight(0xffffff, 1.6)
  dl.position.set(0, 1, 3)
  scene.add(dl)

  scene.add(new THREE.GridHelper(2, 20, 0x444444, 0x222222))
  scene.add(new THREE.AxesHelper(0.3))

  camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.01, 100)
  camera.position.set(0.6, 0.5, 0.8)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 0)
  controls.enableDamping = true

  resizeObserver = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  })
  resizeObserver.observe(host)
}

function animate() {
  raf = requestAnimationFrame(animate)
  const dt = clock.getDelta()
  const t = performance.now()

  if (mixer) mixer.update(dt * 0.6)

  if (oceanMesh?.material?.normalMap && current.value?.ocean) {
    const nm = oceanMesh.material.normalMap
    nm.offset.x = (nm.offset.x + dt * current.value.ocean.scrollSpeedX) % 1
    nm.offset.y = (nm.offset.y + dt * current.value.ocean.scrollSpeedY) % 1
  }

  if (shipParts.length && current.value?.buoyancy) {
    const { amplitude, speed } = current.value.buoyancy
    const bob = Math.sin(t * speed) * amplitude
    for (const p of shipParts) p.obj.position.y = p.baseY + bob
  }

  controls.update()
  renderer.render(scene, camera)
}

onMounted(() => {
  setupLoader()
  initThree()
  loadModel(selectedIndex.value)
  animate()
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  resizeObserver?.disconnect()
  clearScene()
  renderer?.dispose?.()
  renderer?.domElement?.parentNode?.removeChild(renderer.domElement)
})
</script>

<style scoped>
input[type='range'] {
  height: 1.25rem;
}
</style>
