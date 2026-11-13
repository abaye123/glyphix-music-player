// Small helpers shared by all modules. Nothing here may throw.

export function log(text) {
  try {
    console.info('[music] ' + text)
  } catch (e) {
    // console itself failed; nothing else to do
  }
}

export function describe(value) {
  try {
    if (value === undefined) return 'undefined'
    if (value === null) return 'null'
    if (typeof value === 'string') return value
    if (typeof value !== 'object') return String(value)
    const parts = []
    if (value.code !== undefined) parts.push('code=' + value.code)
    if (value.message !== undefined) parts.push('message=' + value.message)
    let json = ''
    try {
      json = JSON.stringify(value)
    } catch (e) {
      json = ''
    }
    if (json && json !== '{}') parts.push(json)
    if (!parts.length) parts.push(String(value))
    return parts.join(' | ')
  } catch (e) {
    return '(describe failed)'
  }
}

// Runs fn() and always resolves with { ok, value, error }. A synchronous throw,
// a rejected Promise and a plain return value are all handled.
export function attempt(fn) {
  return new Promise(resolve => {
    let ret
    try {
      ret = fn()
    } catch (e) {
      resolve({ ok: false, error: describe(e) })
      return
    }
    let thenable = false
    try {
      thenable = ret !== undefined && ret !== null && typeof ret === 'object' && typeof ret.then === 'function'
    } catch (e) {
      thenable = false
    }
    if (!thenable) {
      resolve({ ok: true, value: ret })
      return
    }
    ret.then(
      value => resolve({ ok: true, value: value }),
      error => resolve({ ok: false, error: describe(error) })
    )
  })
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}

// Seconds as m:ss (or h:mm:ss).
export function formatTime(sec) {
  let s = Math.floor(Number(sec) || 0)
  if (s < 0) s = 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0 ? h + ':' + pad2(m) + ':' + pad2(r) : m + ':' + pad2(r)
}

const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' }

// Lower case, final Hebrew letters folded to their regular form, niqqud and
// punctuation-like marks removed, so search is forgiving.
export function normalize(text) {
  const s = String(text || '').toLowerCase()
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s.charAt(i)
    const code = s.charCodeAt(i)
    // Hebrew points and cantillation marks.
    if (code >= 0x0591 && code <= 0x05c7) continue
    if (ch === '"' || ch === "'" || code === 0x05f3 || code === 0x05f4) continue
    out += FINALS[ch] || ch
  }
  return out
}

// Natural compare for sorting ("Song 2" before "Song 10"); localeCompare may be
// missing or slow on the watch.
export function compareText(a, b) {
  const x = String(a || '').toLowerCase()
  const y = String(b || '').toLowerCase()
  let i = 0
  let j = 0
  while (i < x.length && j < y.length) {
    const cx = x.charCodeAt(i)
    const cy = y.charCodeAt(j)
    if (isDigit(cx) && isDigit(cy)) {
      let ei = i
      let ej = j
      while (ei < x.length && isDigit(x.charCodeAt(ei))) ei++
      while (ej < y.length && isDigit(y.charCodeAt(ej))) ej++
      const nx = Number(x.slice(i, ei))
      const ny = Number(y.slice(j, ej))
      if (nx !== ny) return nx < ny ? -1 : 1
      i = ei
      j = ej
      continue
    }
    if (cx !== cy) return cx < cy ? -1 : 1
    i++
    j++
  }
  return (x.length - i) - (y.length - j)
}

function isDigit(code) {
  return code >= 48 && code <= 57
}

export function shuffled(list) {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = out[i]
    out[i] = out[j]
    out[j] = t
  }
  return out
}
