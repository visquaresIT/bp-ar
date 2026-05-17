<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { onMounted, ref } from 'vue'

const isLandscape = ref(false)

onMounted(() => {
  window.addEventListener('orientationchange', function (e) {
    if (e.target.orientation == 90) {
      isLandscape.value = true
    } else {
      isLandscape.value = false
    }
  })
})
</script>

<template>
  <header></header>
  <div>
    <RouterView />
  </div>
  <div
    v-if="isLandscape"
    class="fixed text-xs bg-white w-full h-full top-0 left-0 z-[999999] flex items-center justify-center"
  >
    Please rotate your phone
  </div>
</template>

<style scoped></style>
