<template>
  <div id="captured-image-container">
    <div class="flex flex-col items-start justify-start h-full overflow-auto">
      <div
        class="max-w-sm mx-auto h-auto flex flex-col items-center justify-center gap-4 space-y-3 py-6"
      >
        <div id="captured-image-frame" v-if="capturedImage">
          <img :src="capturedImage" alt="Captured Image" class="w-full h-auto mx-auto" />
        </div>
      </div>
    </div>
  </div>
  <div id="capture-nav" class="">
    <div
      class="gap-3 shadow-md inline-flex justify-center items-center gap-1 p-2 bg-white rounded-full"
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
      <button @click="downloadImage()" class="btn">
        <span class="text-sm">Download</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'

const emits = defineEmits(['onClose'])
const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  capturedImage: {
    type: String,
    default: null,
  },
})

let container, nav

onMounted(() => {
  container = document.getElementById('captured-image-container')
  nav = document.getElementById('capture-nav')
})

const close = () => {
  container.classList.remove('open')
  container.classList.add('close')
  nav.classList.remove('open')
  nav.classList.add('close')
  setTimeout(() => {
    container.classList.remove('close')
    nav.classList.remove('close')
    emits('onClose')
  }, 300)
}

const downloadImage = () => {
  if (!props.capturedImage) {
    console.error('No captured image to download')
    return
  }

  const link = document.createElement('a')
  link.href = props.capturedImage
  link.download = 'bp-ar.png'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

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
</script>

<style lang="scss" scoped>
#captured-image-container {
  @apply fixed bg-white w-full h-full top-0 left-0 z-0 opacity-0 origin-center scale-90 transition-transform duration-300;
  &.open {
    @apply z-50 opacity-100 scale-100;
  }
  &.close {
    @apply opacity-100 scale-0 translate-y-[100%] duration-700;
  }
}
#captured-image-frame {
  @apply w-full max-w-[320px] block;
}
#capture-nav {
  @apply transition-transform duration-300 fixed bottom-6 left-0 w-full h-16 translate-y-32 z-50 flex justify-center;
  &.open {
    @apply translate-y-0;
  }
  &.close {
    @apply translate-y-32;
  }
}
</style>
