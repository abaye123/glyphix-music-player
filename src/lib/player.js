import media from '@system.media'
import { lib, trackUri, coverUri, existing } from './library.js'
import { st, saveSoon, saveNow, addRecent } from './store.js'
import { attempt, describe, log, shuffled } from './util.js'

// One audio player for the whole app. It is created once in app scope and kept
// for the life of the JS context: on the watch the context is only suspended
// while the app is hidden or the screen is off, and playback continues.
//
// Verified on the watch (audio-probe): src/play/pause/stop, status
// 'stop'|'play'|'pause', position/duration in seconds, seek by assigning
// position while playing, events without arguments.

const VOLUME_STEPS = 15
const PREV_RESTART_SEC = 3
const SAVE_POSITION_MS = 15000
const UI_THROTTLE_MS = 400
const MAX_ERROR_SKIPS = 3

export const pl = {
  queue: [], // track ids in source order
  order: [], // indexes into queue, in play order
  pos: -1, // index into order
  status: 'stop',
  position: 0,
  duration: 0,
  error: ''
}

let player = null
let loadedId = '' // id whose file is set as src in this JS context
let loadSeq = 0
let endedSeq = -1
let pendingSeek = 0
let userStop = false
let errorSkips = 0
let lastUi = 0
let lastSave = 0
const subs = []

export function subscribe(fn) {
  subs.push(fn)
  return () => {
    const i = subs.indexOf(fn)
    if (i >= 0) subs.splice(i, 1)
  }
}

function emit() {
  lastUi = Date.now()
  subs.slice().forEach(fn => {
    try {
      fn()
    } catch (e) {
      log('listener threw: ' + describe(e))
    }
  })
}

function readNumber(name) {
  try {
    const v = Number(player[name])
    return isNaN(v) ? 0 : v
  } catch (e) {
    return 0
  }
}

function readStatus() {
  try {
    const s = String(player.status)
    return s === 'play' || s === 'pause' ? s : 'stop'
  } catch (e) {
    return pl.status
  }
}

// Pulls position, duration and status from the native player.
export function sync() {
  if (!player) return
  const t = current()
  if (t && t.id === loadedId) {
    pl.status = readStatus()
    const pos = readNumber('position')
    if (pl.status !== 'stop' || pos > 0) pl.position = pos
    const d = readNumber('duration')
    pl.duration = d > 0 ? d : t.duration
  } else {
    pl.duration = t ? t.duration : 0
  }
}

function on(name, fn) {
  try {
    player[name] = fn
  } catch (e) {
    log('cannot attach ' + name + ': ' + describe(e))
  }
}

export function ensurePlayer() {
  if (player) return player
  try {
    player = media.createAudioPlayer()
  } catch (e) {
    log('createAudioPlayer threw: ' + describe(e))
    player = null
    return null
  }
  try {
    // The constructor option is ignored; the property sticks.
    player.openSystemNotification = true
  } catch (e) {
    log('openSystemNotification failed: ' + describe(e))
  }
  on('onplay', () => {
    pl.status = 'play'
    pl.error = ''
    errorSkips = 0
    if (pendingSeek > 0) {
      const target = pendingSeek
      // Seeking works only once the stream is playing; give it a moment.
      setTimeout(() => {
        if (pendingSeek === target && readStatus() === 'play') {
          pendingSeek = 0
          setPosition(target)
        }
      }, 300)
    }
    emit()
  })
  on('onpause', () => {
    pl.status = 'pause'
    sync()
    persist(true)
    emit()
  })
  on('onstop', () => {
    const wasUser = userStop
    sync()
    pl.status = 'stop'
    // Some players report the end of a song only as a stop.
    if (!wasUser && pl.duration > 0 && pl.position >= pl.duration - 1.5) handleEnded()
    emit()
  })
  on('onended', () => handleEnded())
  on('onerror', () => {
    pl.status = 'stop'
    pl.error = 'error'
    log('player error on ' + loadedId)
    emit()
    // A missing file after a re-sync: skip ahead, but never loop forever.
    if (errorSkips < MAX_ERROR_SKIPS && pl.pos < pl.order.length - 1) {
      errorSkips++
      setTimeout(() => {
        pl.pos++
        pendingSeek = 0
        loadCurrent(true)
      }, 500)
    }
  })
  on('ontimeupdate', () => {
    sync()
    const now = Date.now()
    if (now - lastSave > SAVE_POSITION_MS) persist(false)
    if (pendingSeek > 0 && pl.status === 'play') {
      const target = pendingSeek
      pendingSeek = 0
      setPosition(target)
    }
    if (now - lastUi >= UI_THROTTLE_MS) emit()
  })
  on('oninterrupt', () => {
    sync()
    emit()
  })
  // Next / previous from the system media controls.
  on('onnext', () => next())
  on('onprevious', () => prev())
  log('player created')
  return player
}

export function current() {
  if (pl.pos < 0 || pl.pos >= pl.order.length) return null
  return lib.byId[pl.queue[pl.order[pl.pos]]] || null
}

export function hasTrack() {
  return !!current()
}

function setPosition(sec) {
  try {
    player.position = sec
  } catch (e) {
    log('seek failed: ' + describe(e))
  }
  pl.position = sec
}

function setMeta(t) {
  try {
    const cover = coverUri(t)
    player.songAttribute = {
      title: t.title,
      artist: t.artist,
      artistName: t.artist,
      album: t.album,
      coverArt: cover
    }
  } catch (e) {
    log('songAttribute failed: ' + describe(e))
  }
}

function stopNative() {
  if (readStatus() === 'stop') return
  userStop = true
  try {
    player.stop()
  } catch (e) {
    log('stop threw: ' + describe(e))
  }
  setTimeout(() => {
    userStop = false
  }, 300)
}

// Loads the current track into the player; plays it when autoplay is true.
function loadCurrent(autoplay) {
  const t = current()
  if (!t || !ensurePlayer()) return
  stopNative()
  try {
    player.src = trackUri(t)
  } catch (e) {
    log('set src failed: ' + describe(e))
  }
  loadedId = t.id
  loadSeq++
  pl.position = pendingSeek
  pl.duration = t.duration
  pl.error = ''
  setMeta(t)
  addRecent(t.id)
  if (autoplay) {
    attempt(() => player.play()).then(r => {
      if (!r.ok) {
        pl.error = 'error'
        log('play failed: ' + r.error)
        emit()
      }
    })
  }
  persist(false)
  emit()
}

function handleEnded() {
  if (endedSeq === loadSeq) return
  endedSeq = loadSeq
  pendingSeek = 0
  if (st.repeat === 'one') {
    loadCurrent(true)
    return
  }
  if (pl.pos < pl.order.length - 1) {
    pl.pos++
    loadCurrent(true)
    return
  }
  if (st.repeat === 'all' && pl.order.length) {
    if (st.shuffle) pl.order = shuffled(pl.order)
    pl.pos = 0
    loadCurrent(true)
    return
  }
  // End of the queue: stay on the last song, ready to play again from the start.
  pl.status = 'stop'
  pl.position = 0
  loadedId = ''
  persist(true)
  emit()
}

function buildOrder(startIndex) {
  const n = pl.queue.length
  const identity = []
  for (let i = 0; i < n; i++) identity.push(i)
  if (!st.shuffle) {
    pl.order = identity
    pl.pos = Math.max(0, Math.min(startIndex, n - 1))
    return
  }
  const rest = identity.filter(i => i !== startIndex)
  pl.order = startIndex >= 0 && startIndex < n ? [startIndex].concat(shuffled(rest)) : shuffled(identity)
  pl.pos = 0
}

// Starts a new queue. startIndex < 0 with shuffle picks a random first song.
export function playQueue(ids, startIndex, shuffle) {
  const list = existing(ids)
  if (!list.length) return false
  if (shuffle !== undefined) st.shuffle = shuffle
  pl.queue = list
  let start = startIndex
  if (start < 0 || start >= list.length) start = st.shuffle ? -1 : 0
  buildOrder(start)
  pendingSeek = 0
  saveSoon()
  loadCurrent(true)
  return true
}

export function jumpTo(orderPos) {
  if (orderPos < 0 || orderPos >= pl.order.length) return
  pl.pos = orderPos
  pendingSeek = 0
  loadCurrent(true)
}

export function play() {
  const t = current()
  if (!t || !ensurePlayer()) return
  if (loadedId !== t.id) {
    // First play after launch (resume) or after the queue ended.
    pendingSeek = pl.position > 1 ? pl.position : 0
    loadCurrent(true)
    return
  }
  attempt(() => player.play()).then(r => {
    if (!r.ok) log('play failed: ' + r.error)
  })
}

export function pause() {
  if (!player) return
  try {
    player.pause()
  } catch (e) {
    log('pause threw: ' + describe(e))
  }
}

export function toggle() {
  sync()
  if (pl.status === 'play') pause()
  else play()
}

export function next() {
  if (!pl.order.length) return
  if (pl.pos < pl.order.length - 1) pl.pos++
  else pl.pos = 0
  pendingSeek = 0
  loadCurrent(true)
}

export function prev() {
  if (!pl.order.length) return
  sync()
  if (pl.position > PREV_RESTART_SEC && loadedId) {
    seekTo(0)
    return
  }
  if (pl.pos > 0) pl.pos--
  else if (st.repeat === 'all') pl.pos = pl.order.length - 1
  pendingSeek = 0
  loadCurrent(true)
}

export function seekTo(sec) {
  sync()
  let target = Math.max(0, sec)
  if (pl.duration > 0) target = Math.min(target, Math.max(0, pl.duration - 1))
  if (pl.status === 'play') {
    setPosition(target)
  } else {
    // Seeking was verified only while playing; apply it on the next play.
    pendingSeek = target > 0 ? target : 0
    pl.position = target
    if (pl.status === 'pause') setPosition(target)
  }
  persist(false)
  emit()
}

export function seekBy(delta) {
  sync()
  seekTo(pl.position + delta)
}

export function setShuffle(on) {
  st.shuffle = on
  const n = pl.queue.length
  if (n) {
    const cur = pl.pos >= 0 && pl.pos < pl.order.length ? pl.order[pl.pos] : 0
    if (on) {
      const rest = []
      for (let i = 0; i < n; i++) if (i !== cur) rest.push(i)
      pl.order = [cur].concat(shuffled(rest))
      pl.pos = 0
    } else {
      pl.order = []
      for (let i = 0; i < n; i++) pl.order.push(i)
      pl.pos = cur
    }
  }
  persist(false)
  emit()
}

export function cycleRepeat() {
  st.repeat = st.repeat === 'off' ? 'all' : st.repeat === 'all' ? 'one' : 'off'
  saveSoon()
  emit()
  return st.repeat
}

// Saves the queue, the current song and the position.
export function persist(immediately) {
  lastSave = Date.now()
  if (!pl.queue.length) {
    st.resume = null
  } else {
    st.resume = {
      queue: pl.queue,
      order: pl.order,
      pos: pl.pos,
      position: Math.floor(pl.position)
    }
  }
  saveSoon()
  if (immediately) saveNow()
}

// Restores the last queue after launch, without playing.
export function restore() {
  const r = st.resume
  if (!r || !Array.isArray(r.queue)) return
  const oldQueue = r.queue.map(String)
  const oldOrder = Array.isArray(r.order) && r.order.length === oldQueue.length ? r.order : oldQueue.map((x, i) => i)
  const orderedIds = oldOrder.map(i => oldQueue[i]).filter(id => id !== undefined)
  const currentId = orderedIds[r.pos]
  const queue = existing(oldQueue)
  if (!queue.length) return
  const order = existing(orderedIds).map(id => queue.indexOf(id)).filter(i => i >= 0)
  pl.queue = queue
  pl.order = order.length === queue.length ? order : queue.map((x, i) => i)
  let pos = currentId ? pl.order.indexOf(queue.indexOf(currentId)) : -1
  let position = Number(r.position) || 0
  if (pos < 0) {
    pos = 0
    position = 0
  }
  pl.pos = pos
  pl.position = position
  const t = current()
  pl.duration = t ? t.duration : 0
  pl.status = 'stop'
}

// Volume: media.getVolume() resolves with 0..1; the watch has 15 steps.
// Only the number form of setVolume is safe (the object form mutes the watch).
export function getVolumeStep() {
  return attempt(() => media.getVolume()).then(r => {
    if (!r.ok) return -1
    let v = r.value
    if (v && typeof v === 'object') v = v.value !== undefined ? v.value : v.volume
    v = Number(v)
    if (isNaN(v)) return -1
    return Math.round(Math.max(0, Math.min(1, v)) * VOLUME_STEPS)
  })
}

export function stepVolume(direction) {
  return getVolumeStep().then(step => {
    if (step < 0) return -1
    const target = Math.max(0, Math.min(VOLUME_STEPS, step + direction))
    return attempt(() => media.setVolume(target / VOLUME_STEPS)).then(() => target)
  })
}

export const VOLUME_MAX = VOLUME_STEPS

// The song ids in play order, for the queue page.
export function queueInOrder() {
  return pl.order.map(i => pl.queue[i])
}
