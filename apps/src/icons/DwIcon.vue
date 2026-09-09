<script setup lang="ts">
import { computed } from 'vue'
import { resolveIconUrl } from './resolveIcon'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
  }>(),
  { size: 32 }
)

const src = computed(() => resolveIconUrl(props.name))
const dim = computed(() => `${props.size}px`)
</script>

<template>
  <img
    v-if="src"
    class="dw-icon"
    :src="src"
    alt=""
    draggable="false"
    :style="{ width: dim, height: dim }"
  />
</template>
