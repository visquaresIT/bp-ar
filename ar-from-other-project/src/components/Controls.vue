<template>
  <div id="control" class="fixed bottom-6 left-0 w-full h-16 z-50">
    <Transition>
      <div v-if="recordingReady && !recording" class="absolute w-full flex justify-center -top-12">
        <span class="bg-white px-3 py-2 text-xs rounded-full">Tap To Record</span>
      </div>
    </Transition>

    <Transition>
      <div v-if="recordingReady && !recording" class="absolute w-full flex justify-center">
        <svg
          @click="cancelRecording()"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          class="size-8 text-white translate-x-16 translate-y-4"
        >
          <path
            fill-rule="evenodd"
            d="M2.515 10.674a1.875 1.875 0 0 0 0 2.652L8.89 19.7c.352.351.829.549 1.326.549H19.5a3 3 0 0 0 3-3V6.75a3 3 0 0 0-3-3h-9.284c-.497 0-.974.198-1.326.55l-6.375 6.374ZM12.53 9.22a.75.75 0 1 0-1.06 1.06L13.19 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06L15.31 12l1.72-1.72a.75.75 0 1 0-1.06-1.06l-1.72 1.72-1.72-1.72Z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </Transition>
    <div class="max-w-screen-sm mx-auto px-6 flex justify-center">
      <nav
        :class="[{ 'w-[4.2rem]': recordingReady }, { 'w-[7.6rem]': !recordingReady }]"
        class="transition-width duration-300 ring-[1px] ring-gray-100/30 shadow-md flex justify-center items-center gap-2 p-2 bg-gray-100/20 backdrop-blur-sm rounded-full relative"
      >
        <!-- Timer Container -->
        <div v-if="recording" class="absolute timer-container">
          <svg class="timer-circle" viewBox="0 0 36 36">
            <circle class="background-circle" cx="18" cy="18" r="16" fill="none"></circle>
            <circle
              class="progress-circle"
              cx="18"
              cy="18"
              r="16"
              fill="none"
              :style="{ animationDuration: `${duration}s` }"
            ></circle>
          </svg>
        </div>

        <!-- Other Buttons -->
        <div
          :class="
            !recording && !recordingReady
              ? 'opacity-100 translate-x-[0px]'
              : 'opacity-0 translate-x-[28px]'
          "
          class="transition-all duration-300 w-12 h-12 bg-black/75 hover:bg-black backdrop-blur-sm text-accent rounded-full flex flex-col items-center justify-center"
        >
          <div
            class="flex w-12 h-12 items-center justify-center rounded-full overflow-hidden bg-white"
          >
            <img src="/logo.webp" alt="Catstanbul 2025" class="scale-75" />
          </div>
        </div>
        <button
          v-if="recording"
          @click="toggleRecord"
          class="w-12 h-12 bg-black/75 hover:bg-black backdrop-blur-sm text-accent rounded-full flex flex-col items-center justify-center"
        >
          <svg
            v-if="!recording"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-6 mx-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>

          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            :class="recording ? 'animate-pulse' : ''"
            class="size-6 mx-6"
          >
            <path
              fill-rule="evenodd"
              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm6-2.438c0-.724.588-1.312 1.313-1.312h4.874c.725 0 1.313.588 1.313 1.313v4.874c0 .725-.588 1.313-1.313 1.313H9.564a1.312 1.312 0 0 1-1.313-1.313V9.564Z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
        <button
          :class="[
            { '-translate-x-[0px]': !recordingReady },
            { '-translate-x-[28px]': recordingReady },
            { 'opacity-0 pointer-events-none': recordingReady && recording },
          ]"
          @click="initRecord"
          class="transition-transform duration-300 w-12 h-12 bg-black/75 hover:bg-black backdrop-blur-sm text-accent rounded-full flex flex-col items-center justify-center"
        >
          <svg
            v-if="!recordingReady"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-6 mx-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>

          <div v-else class="size-5 rounded-full bg-accent mx-6"></div>
        </button>
      </nav>
    </div>
    <div class="hidden">
      <button id="startButton">Start</button>
      <button id="stopButton">Stop</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const emits = defineEmits([
  'onInitCapture, onInitRecord',
  'onRecordStarted',
  'onRecordEnded',
  'onCancelRecording',
])
const recordingReady = ref(false)
const recording = ref(false)
const recordingEnded = ref(false)
const timeElapsed = ref(0)
const duration = 15 // Timer duration in seconds
const timerInterval = ref(null)
const timerTimeout = ref(null)

const initCapture = () => {
  emits('onInitCapture')
}

// Calculate progress for the circular timer
const dashOffset = computed(() => {
  const radius = 16
  const circumference = 2 * Math.PI * radius
  const progress = (timeElapsed.value / duration) * 100
  return circumference - (progress / 100) * circumference
})

const initRecord = () => {
  if (recordingReady.value) {
    toggleRecord()
  }
  recordingReady.value = true
  recordingEnded.value = false
  emits('onInitRecord')
}

const toggleRecord = () => {
  if (!recording.value) {
    startTimer()
  } else {
    stopTimer()
  }
  recording.value = !recording.value
}

const startTimer = () => {
  emits('onRecordStarted')
  // Start recording and timer logic (if needed)
  timerTimeout.value = setTimeout(() => {
    stopTimer()
    recording.value = false
  }, duration * 1000) // Stop after duration
}

const stopTimer = () => {
  clearInterval(timerInterval.value)
  clearTimeout(timerTimeout.value)
  timerInterval.value = null
  recordingEnded.value = true
}

const cancelRecording = () => {
  emits('onCancelRecording')
  recordingReady.value = false
}

watch(
  () => recordingEnded.value,
  (ended) => {
    if (ended) {
      emits('onRecordEnded')
      recordingReady.value = false
      recording.value = false
      recordingEnded.value = false
      if (timerInterval.value) clearInterval(timerInterval.value)
      if (timerTimeout.value) clearTimeout(timerTimeout.value)
      timerInterval.value = null
    }
  },
)
</script>

<style lang="scss" scoped>
.timer-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 4rem;
  height: 4rem;
}

.timer-circle {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.background-circle,
.progress-circle {
  stroke-width: 2;
  r: 16;
  cx: 18;
  cy: 18;
}

.background-circle {
  stroke: #ccc;
  opacity: 0.3;
}

.progress-circle {
  stroke: #a5d756;
  stroke-dasharray: 100; /* Full circle */
  stroke-dashoffset: 100; /* Start fully offset */
  animation: progressAnimation linear forwards;
}

@keyframes progressAnimation {
  from {
    stroke-dashoffset: 100;
  }
  to {
    stroke-dashoffset: 0;
  }
}
</style>
