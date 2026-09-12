import { ref } from 'vue'

/** Shared so wiki capture (and tests) can select a Ribbon tab without clicking DOM. */
export const ribbonActiveTab = ref('home')
