import { boot } from './lib/boot.js'
import { persist } from './lib/player.js'
import { saveNow } from './lib/store.js'
import { log } from './lib/util.js'

export default {
  onCreate() {
    log('app onCreate')
    // Creates the single app-wide player and starts loading the library.
    boot()
  },
  onHide() {
    persist(true)
  },
  onDestroy() {
    persist(true)
    saveNow()
  }
}
