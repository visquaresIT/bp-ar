<template>
  <section
    class="welcome-screen fixed inset-0 z-[100] grid place-items-center px-6"
  >
    <div
      class="w-full max-w-[420px] grid gap-5 justify-items-center p-8"
    >
      <div class="mx-auto w-28 flex items-center justify-center">
        <img src="/logo.svg" alt="BP Logo" class="w-full">
      </div>

      <div class="space-y-3">
        <!-- Title -->
        <h1 class="text-xl font-bold text-[#1C9B48] text-center">
          Step into the <br>Augmented Reality tunnel
        </h1>
        
        <!-- Description -->
        <p class="mb-10 max-w-[18rem] lg:max-w-2xl mx-auto text-[#1C9B48] text-center">
          Explore a dynamic 3D AR tunnel and visualize the flow of our services
        </p>
      </div>

      <button
        class="w-[101px] p-[12.45px] rounded-[4.15px] bg-[#1C9B48] text-white flex flex-col items-center gap-[2.77px] transition-transform duration-150 hover:-translate-y-px hover:bg-[#178a3f] disabled:cursor-not-allowed disabled:opacity-55 disabled:translate-y-0"
        :disabled="starting"
        @click="$emit('start')"
      >
        {{ starting ? 'Starting…' : 'Start' }}
      </button>
      <p v-if="error" class="min-h-[1.5rem] text-center text-sm text-red-600">
        {{ error }}
      </p>
    </div>
  </section>
</template>

<script setup>
defineProps({
  starting: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
})

defineEmits(['start'])
</script>

<style scoped>
.welcome-screen {
  background-image: url('/bg-home.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
</style>
