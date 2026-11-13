import file from '@system.file'
import { attempt, log } from './util.js'
import { textOf } from './library.js'

// Watch-side state. The library itself is read-only; everything the user does
// on the watch lives here.
const STATE_URI = 'internal://files/state.json'
const RECENT_MAX = 30
const SAVE_DELAY_MS = 1500

export const st = {
  favorites: [],
  recent: [],
  // [{ name, tracks: [id] }]
  playlists: [],
  repeat: 'off',
  shuffle: false,
  // { queue: [id], order: [index], pos, position }
  resume: null
}

let saveTimer = null
let dirty = false

export function loadState() {
  return attempt(() => file.readText({ uri: STATE_URI })).then(r => {
    const text = r.ok ? textOf(r.value) : ''
    if (!text) return st
    try {
      const data = JSON.parse(text) || {}
      if (Array.isArray(data.favorites)) st.favorites = data.favorites.map(String)
      if (Array.isArray(data.recent)) st.recent = data.recent.map(String)
      if (Array.isArray(data.playlists)) {
        st.playlists = data.playlists.filter(p => p && Array.isArray(p.tracks)).map(p => ({
          name: String(p.name || ''),
          tracks: p.tracks.map(String)
        }))
      }
      if (data.repeat === 'all' || data.repeat === 'one') st.repeat = data.repeat
      st.shuffle = data.shuffle === true
      if (data.resume && Array.isArray(data.resume.queue)) st.resume = data.resume
    } catch (e) {
      log('state.json parse failed: ' + e)
    }
    return st
  })
}

export function saveNow() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  if (!dirty) return
  dirty = false
  const text = JSON.stringify({
    version: 1,
    favorites: st.favorites,
    recent: st.recent,
    playlists: st.playlists,
    repeat: st.repeat,
    shuffle: st.shuffle,
    resume: st.resume
  })
  attempt(() => file.writeText({ uri: STATE_URI, text: text })).then(r => {
    if (!r.ok) log('state save failed: ' + r.error)
  })
}

export function saveSoon() {
  dirty = true
  if (saveTimer) return
  saveTimer = setTimeout(saveNow, SAVE_DELAY_MS)
}

export function isFavorite(id) {
  return st.favorites.indexOf(id) >= 0
}

export function toggleFavorite(id) {
  const i = st.favorites.indexOf(id)
  if (i >= 0) st.favorites.splice(i, 1)
  else st.favorites.unshift(id)
  saveSoon()
  return i < 0
}

export function addRecent(id) {
  const i = st.recent.indexOf(id)
  if (i >= 0) st.recent.splice(i, 1)
  st.recent.unshift(id)
  if (st.recent.length > RECENT_MAX) st.recent.length = RECENT_MAX
  saveSoon()
}

export function createPlaylist(name) {
  st.playlists.push({ name: name, tracks: [] })
  saveSoon()
  return st.playlists.length - 1
}

// Returns false when the song is already in the list.
export function addToPlaylist(index, id) {
  const p = st.playlists[index]
  if (!p || p.tracks.indexOf(id) >= 0) return false
  p.tracks.push(id)
  saveSoon()
  return true
}

export function removeFromPlaylist(index, id) {
  const p = st.playlists[index]
  if (!p) return
  const i = p.tracks.indexOf(id)
  if (i >= 0) p.tracks.splice(i, 1)
  saveSoon()
}

export function deletePlaylist(index) {
  if (index >= 0 && index < st.playlists.length) st.playlists.splice(index, 1)
  saveSoon()
}
