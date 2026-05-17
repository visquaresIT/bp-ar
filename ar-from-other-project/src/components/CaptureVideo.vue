<template>
  <div id="captured-video-container" class="relative">
    <video
      class="absolute z-0 w-full h-full top-0 left-0 object-cover"
      :src="videoUrl"
      autoplay
      playsinline
      muted
      loop
    ></video>
    <div class="flex flex-col items-start justify-start h-full overflow-auto relative z-10">
      <div
        class="max-w-sm mx-auto h-auto flex flex-col items-center justify-start gap-4 space-y-3 py-6"
      >
        <img src="/logo-horizontal.webp" alt="Catstanbul" class="w-64" />
        <div
          v-if="videoUrl"
          id="captured-video-frame"
          class="relative h-full block w-full relative px-3"
        ></div>
      </div>
    </div>
  </div>
  <div id="capture-video-nav" class="">
    <div
      class="gap-3 ring-[1px] ring-gray-100/30 shadow-md inline-flex justify-center items-center gap-1 p-2 bg-gray-100/20 backdrop-blur-sm rounded-full"
    >
      <button @click="close()" class="btn">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="size-5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
          />
        </svg>
        <span class="text-sm">Back</span>
      </button>
      <button
        :disabled="downloadSuccess"
        @click="downloadVideo()"
        class="btn overflow-hidden relative"
        :class="downloadSuccess ? 'btn-success' : ''"
      >
        <span
          :class="!downloadSuccess ? 'animate translate-y-0' : '-translate-y-8'"
          class="default-text text-sm transition-transform duration-300"
          >Download</span
        >
        <div
          :class="downloadSuccess ? 'animate translate-y-0' : 'translate-y-8'"
          class="absolute hover-text flex items-center gap-2 transition-transform duration-300"
        >
          <span class="text-sm">Saved</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="size-5"
          >
            <path
              fill-rule="evenodd"
              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch, ref, onBeforeUnmount, nextTick } from 'vue'

const emits = defineEmits(['onClose'])
const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  videoUrl: {
    type: String,
    default: null,
  },
  canvasWidth: {
    type: Number,
    default: 0,
  },
  canvasHeight: {
    type: Number,
    default: 0,
  },
})

const downloadSuccess = ref(false)

let container, nav, frame

onMounted(() => {
  container = document.getElementById('captured-video-container')
  nav = document.getElementById('capture-video-nav')
})

const close = () => {
  container.classList.remove('open')
  container.classList.add('close')
  nav.classList.remove('open')
  nav.classList.add('close')
  setTimeout(() => {
    container.classList.remove('close')
    nav.classList.remove('close')
    downloadSuccess.value = false
    emits('onClose')
  }, 300)
}

const downloadVideo = () => {
  if (!props.videoUrl) {
    console.error('No captured video to download')
    return
  }

  const link = document.createElement('a')
  link.href = props.videoUrl
  link.download = 'Catstanbul-2025-AR.mp4'
  link.click()
  downloadSuccess.value = true
  triggerDownloadAnimation()
}

const animationTimeout = ref(null)

const triggerDownloadAnimation = () => {
  const animationElement = document.getElementById('download-animation')
  if (animationElement) {
    animationElement.classList.add('show')
    animationTimeout.value = setTimeout(() => {
      animationElement.classList.remove('show')
      clearTimeout(animationTimeout.value)
    }, 2000)
  }
}

onBeforeUnmount(() => {
  if (animationTimeout.value) clearTimeout(animationTimeout.value)
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      container.classList.add('open')
      nav.classList.add('open')
    } else {
      container.classList.remove('open')
      nav.classList.remove('open')
    }
  },
)

watch(
  () => props.videoUrl,
  (url) => {
    if (url) {
      nextTick(() => {
        frame = document.getElementById('captured-video-frame')
        console.log(frame)
        frame.style.aspectRatio = `${props.canvasWidth}/${props.canvasHeight}`
      })
    }
  },
)
</script>

<style lang="scss" scoped>
#captured-video-container {
  @apply fixed bg-white w-full h-full top-0 left-0 z-0 opacity-0 origin-center scale-90 transition-transform duration-300;
  &.open {
    @apply z-50 opacity-100 scale-100;
  }
  &.close {
    @apply opacity-100 scale-0 translate-y-[100%] duration-700;
  }
}
#captured-video-frame {
  // @apply w-full max-w-[320px] block;
}
#capture-video-nav {
  @apply transition-transform duration-300 fixed bottom-6 left-0 w-full h-16 translate-y-32 z-50 flex justify-center;
  &.open {
    @apply translate-y-0;
  }
  &.close {
    @apply translate-y-32;
  }
}
</style>
