/// <reference types="vite/client" />

import type { NovaStreamAPI } from '../electron/preload/index'

declare global {
  interface Window {
    novaStream: NovaStreamAPI
  }
}

export {}
