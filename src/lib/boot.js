import router from '@system.router'
import { loadLibrary, lib } from './library.js'
import { loadState } from './store.js'
import { ensurePlayer, restore } from './player.js'
import { log } from './util.js'

let started = null

// Loads the library and the saved state once per JS context.
export function boot() {
  if (!started) {
    ensurePlayer()
    started = Promise.all([loadLibrary(), loadState()]).then(() => {
      if (lib.status === 'ok') restore()
      return lib
    }, e => {
      log('boot failed: ' + e)
      return lib
    })
  }
  return started
}

// Router params are not relied on: the next page takes its view from here.
let pendingView = null

export function openView(view) {
  pendingView = view
  router.push({ uri: 'browse', params: { kind: view.kind } })
}

export function takeView() {
  const v = pendingView
  pendingView = null
  return v
}

let addedFlag = false

// Set when a new playlist was created with the current song in it.
export function markAdded() {
  addedFlag = true
}

export function takeAdded() {
  const v = addedFlag
  addedFlag = false
  return v
}

let pendingInput = null

export function openInput(mode, extra) {
  pendingInput = { mode: mode, extra: extra }
  router.push({ uri: 'search', params: { mode: mode } })
}

export function takeInput() {
  const v = pendingInput
  pendingInput = null
  return v || { mode: 'search' }
}

export function openPlayer() {
  router.push({ uri: 'player' })
}
