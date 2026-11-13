import file from '@system.file'
import { attempt, log, normalize, compareText } from './util.js'
import { T } from './strings.js'

// The library is written by DT G1 Studio; the app only reads it.
export const ROOT = 'internal://mass/music/'
const INDEX = ROOT + 'index.json'

// status: 'loading' | 'ok' | 'empty' | 'bad'
export const lib = {
  status: 'loading',
  tracks: [],
  byId: {},
  playlists: [],
  root: null,
  artists: [],
  albums: [],
  artistMap: {},
  albumMap: {}
}

function str(v) {
  return v === undefined || v === null ? '' : String(v)
}

// readText returns a plain string on the watch and { text } in some emulator builds.
export function textOf(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof value.text === 'string') return value.text
  return ''
}

function newFolder(name, path) {
  return { name: name, path: path, children: {}, childList: [], tracks: [] }
}

function folderFor(root, path) {
  if (!path) return root
  const parts = path.split('/')
  let node = root
  let sofar = ''
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    sofar = sofar ? sofar + '/' + part : part
    let child = node.children[part]
    if (!child) {
      child = newFolder(part, sofar)
      node.children[part] = child
    }
    node = child
  }
  return node
}

function sortFolder(node, byId) {
  const names = Object.keys(node.children)
  names.sort(compareText)
  node.childList = names.map(n => node.children[n])
  node.tracks.sort((a, b) => trackOrder(byId[a], byId[b]))
  node.childList.forEach(c => sortFolder(c, byId))
}

// Album order: track number first, then title.
export function trackOrder(a, b) {
  const x = a.track > 0 ? a.track : 9999
  const y = b.track > 0 ? b.track : 9999
  if (x !== y) return x - y
  return compareText(a.title, b.title)
}

function titleOrder(a, b) {
  return compareText(a.title, b.title)
}

// Every song in a folder and its subfolders, folder by folder.
export function folderTracksDeep(node) {
  let out = node.tracks.slice()
  node.childList.forEach(c => {
    out = out.concat(folderTracksDeep(c))
  })
  return out
}

export function findFolder(path) {
  if (!lib.root) return null
  if (!path) return lib.root
  const parts = path.split('/')
  let node = lib.root
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue
    node = node.children[parts[i]]
    if (!node) return null
  }
  return node
}

export function trackUri(t) {
  return ROOT + t.file
}

export function coverUri(t) {
  return t && t.cover ? ROOT + t.cover : ''
}

export function artistName(t) {
  return t.artist || T.unknownArtist
}

export function songLine(t) {
  if (!t) return ''
  const parts = []
  if (t.artist) parts.push(t.artist)
  if (t.album) parts.push(t.album)
  return parts.join(' - ')
}

function build(data) {
  const tracks = []
  const byId = {}
  const list = Array.isArray(data.tracks) ? data.tracks : []
  list.forEach(raw => {
    if (!raw || !raw.id || !raw.file) return
    const id = str(raw.id)
    if (byId[id]) return
    const t = {
      id: id,
      file: str(raw.file),
      title: str(raw.title) || baseName(str(raw.file)),
      artist: str(raw.artist),
      album: str(raw.album),
      folder: str(raw.folder).replace(/^\/+|\/+$/g, ''),
      track: Number(raw.track) || 0,
      duration: Number(raw.duration) || 0,
      cover: str(raw.cover)
    }
    t.hay = normalize(t.title + ' ' + t.artist + ' ' + t.album + ' ' + t.folder.replace(/\//g, ' '))
    tracks.push(t)
    byId[id] = t
  })
  tracks.sort(titleOrder)

  const root = newFolder(T.rootFolder, '')
  const artistMap = {}
  const albumMap = {}
  tracks.forEach(t => {
    folderFor(root, t.folder).tracks.push(t.id)
    const an = artistName(t)
    if (!artistMap[an]) artistMap[an] = { name: an, tracks: [] }
    artistMap[an].tracks.push(t.id)
    const al = t.album || T.unknownAlbum
    if (!albumMap[al]) albumMap[al] = { name: al, tracks: [], artists: {}, cover: '' }
    const album = albumMap[al]
    album.tracks.push(t.id)
    album.artists[an] = (album.artists[an] || 0) + 1
    if (!album.cover && t.cover) album.cover = t.cover
  })
  sortFolder(root, byId)

  const artists = Object.keys(artistMap).sort(compareText).map(k => artistMap[k])
  artists.forEach(a => {
    // Songs of an artist: by album, then album order.
    a.tracks.sort((x, y) => {
      const tx = byId[x]
      const ty = byId[y]
      const c = compareText(tx.album, ty.album)
      return c !== 0 ? c : trackOrder(tx, ty)
    })
  })
  const albums = Object.keys(albumMap).sort(compareText).map(k => albumMap[k])
  albums.forEach(al => {
    al.tracks.sort((x, y) => trackOrder(byId[x], byId[y]))
    const names = Object.keys(al.artists)
    al.artist = names.length === 1 ? names[0] : T.variousArtists
  })

  const playlists = []
  const rawLists = Array.isArray(data.playlists) ? data.playlists : []
  rawLists.forEach(p => {
    if (!p) return
    const ids = (Array.isArray(p.tracks) ? p.tracks : []).map(str).filter(id => byId[id])
    playlists.push({ name: str(p.name) || T.untitled, tracks: ids })
  })

  lib.tracks = tracks
  lib.byId = byId
  lib.root = root
  lib.artists = artists
  lib.albums = albums
  lib.artistMap = artistMap
  lib.albumMap = albumMap
  lib.playlists = playlists
}

function baseName(path) {
  const i = path.lastIndexOf('/')
  const name = i >= 0 ? path.slice(i + 1) : path
  return name.replace(/\.[^.]*$/, '')
}

export function loadLibrary() {
  return attempt(() => file.readText({ uri: INDEX })).then(r => {
    const text = r.ok ? textOf(r.value) : ''
    if (!text) {
      lib.status = 'empty'
      log('index.json missing or empty: ' + (r.ok ? 'empty' : r.error))
      return lib
    }
    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      lib.status = 'bad'
      log('index.json parse failed: ' + e)
      return lib
    }
    try {
      build(data || {})
    } catch (e) {
      lib.status = 'bad'
      log('index build failed: ' + e)
      return lib
    }
    lib.status = lib.tracks.length ? 'ok' : 'empty'
    log('library: ' + lib.tracks.length + ' tracks, ' + lib.artists.length + ' artists, ' +
      lib.albums.length + ' albums, ' + lib.playlists.length + ' playlists')
    return lib
  })
}

// Ids that still exist in the library (after a re-sync some may be gone).
export function existing(ids) {
  return (ids || []).filter(id => lib.byId[id])
}

export function searchTracks(query) {
  const words = normalize(query).split(' ').filter(w => w)
  if (!words.length) return []
  return lib.tracks.filter(t => {
    for (let i = 0; i < words.length; i++) {
      if (t.hay.indexOf(words[i]) < 0) return false
    }
    return true
  }).map(t => t.id)
}
