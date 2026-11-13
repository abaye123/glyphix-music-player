// All on-screen text (Hebrew).

// "N songs" in Hebrew (one song has its own form).
export function countText(n) {
  return n === 1 ? T.oneSong : n + ' ' + T.songs
}

export const T = {
  appTitle: 'מוזיקה',
  loading: 'טוען...',
  empty: 'אין מוזיקה. העבר שירים מ-DT G1 Studio',
  badIndex: 'קובץ הספרייה פגום. סנכרן שוב מ-DT G1 Studio',

  folders: 'תיקיות',
  artists: 'אמנים',
  albums: 'אלבומים',
  playlists: 'רשימות השמעה',
  recent: 'הושמעו לאחרונה',
  favorites: 'מועדפים',
  allSongs: 'כל השירים',
  search: 'חיפוש',
  queue: 'תור ההשמעה',

  nowPlaying: 'מתנגן עכשיו',
  paused: 'מושהה',
  noTrack: 'לא נבחר שיר',
  unknownArtist: 'אמן לא ידוע',
  unknownAlbum: 'ללא אלבום',
  untitled: 'ללא שם',
  variousArtists: 'אמנים שונים',
  rootFolder: 'ספרייה',

  playAll: 'נגן הכל',
  shuffleAll: 'ערבב',
  playAllDeep: 'נגן הכל כולל תתי תיקיות',
  more: 'הצג עוד',
  songs: 'שירים',
  oneSong: 'שיר אחד',
  trackNo: 'רצועה',
  noSongs: 'אין שירים כאן',
  noRecent: 'עוד לא הושמעו שירים',
  noFavorites: 'אין מועדפים. סמן לב במסך הנגינה',
  noPlaylists: 'אין רשימות השמעה',
  noResults: 'אין תוצאות',
  missingTrack: 'השיר לא נמצא בספרייה',

  newPlaylist: 'רשימה חדשה',
  myPlaylist: 'שלי',
  edit: 'עריכה',
  doneEdit: 'סיום עריכה',
  tapToRemove: 'הקש על שיר כדי להסיר אותו',
  deletePlaylist: 'מחק רשימה',
  addToPlaylist: 'הוסף לרשימה',
  added: 'נוסף לרשימה',
  alreadyIn: 'כבר ברשימה',
  removed: 'הוסר',
  chooseList: 'בחר רשימה',
  playlistName: 'שם הרשימה',
  save: 'שמור',
  needName: 'הקלד שם',

  searchHint: 'הקלד לחיפוש',
  space: 'רווח',
  backspace: 'מחק',
  clear: 'נקה',
  results: 'תוצאות',

  volume: 'עוצמה',
  repeatOff: 'חזרה כבויה',
  repeatAll: 'חזרה על הכל',
  repeatOne: 'חזרה על שיר',
  shuffleOn: 'ערבוב פעיל',
  shuffleOff: 'ערבוב כבוי',
  toArtist: 'לאמן',
  toAlbum: 'לאלבום',
  favOn: 'נוסף למועדפים',
  favOff: 'הוסר מהמועדפים',
  playError: 'שגיאה בניגון השיר'
}
