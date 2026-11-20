/**
 * Text and voice cues for Arrow Mode in the three languages in Settings.
 * (The rest of Terus is English for now; Arrow Mode is the first fully translated screen.)
 */
export type AppLanguage = 'en' | 'ms' | 'zh';

export type ArrowStrings = {
  // voice cues (kept short so they are quick to hear)
  goStraight: string;
  turnLeft: string;
  turnRight: string;
  arrived: string;
  // screen text
  turnAround: string;
  straightLine: string;
  searchingGps: string;
  calibrate: string;
  noCompass: string;
  paused: string;
  offRoute: string;
  offline: string;
  pause: string;
  resume: string;
  showMap: string;
  end: string;
  done: string;
  back: string;
  mute: string;
  unmute: string;
  youHaveArrived: string;
  left: (time: string) => string; // "8 min left"
  nextTurn: (turn: string, distance: string) => string; // "Turn left in 200 m"
  turnLeftShort: string;
  turnRightShort: string;
  slightLeft: string;
  slightRight: string;
  uTurn: string;
  continueStraight: string;
  demo: string;
  // permission explainer
  permTitle: string;
  permBody: string;
  permButton: string;
  permDenied: string;
};

const en: ArrowStrings = {
  goStraight: 'Go straight',
  turnLeft: 'Turn left',
  turnRight: 'Turn right',
  arrived: 'You have arrived',
  turnAround: 'Turn around',
  straightLine: 'Straight-line direction',
  searchingGps: 'Searching for GPS signal…',
  calibrate: 'Move your phone in a figure-8 to calibrate the compass',
  noCompass: 'No compass on this device – the arrow uses your walking direction',
  paused: 'Paused – location is off to save battery',
  offRoute: 'Finding a new route…',
  offline: 'No internet – showing straight-line direction',
  pause: 'Pause',
  resume: 'Resume',
  showMap: 'Show Map',
  end: 'End',
  done: 'Done',
  back: 'Back',
  mute: 'Mute voice',
  unmute: 'Turn on voice',
  youHaveArrived: 'You have arrived',
  left: (t) => `${t} left`,
  nextTurn: (turn, d) => `${turn} in ${d}`,
  turnLeftShort: 'Turn left',
  turnRightShort: 'Turn right',
  slightLeft: 'Keep left',
  slightRight: 'Keep right',
  uTurn: 'U-turn',
  continueStraight: 'Continue straight',
  demo: 'DEMO',
  permTitle: 'Arrow Mode needs your location and compass',
  permBody:
    'Terus uses GPS to know where you are and the phone’s compass to know which way you are facing, so the arrow can point the right way. Nothing is stored or shared.',
  permButton: 'Allow and start',
  permDenied: 'Location is blocked. Allow location for this site in your browser settings.',
};

const ms: ArrowStrings = {
  goStraight: 'Terus',
  turnLeft: 'Belok kiri',
  turnRight: 'Belok kanan',
  arrived: 'Anda telah sampai',
  turnAround: 'Pusing balik',
  straightLine: 'Arah garis lurus',
  searchingGps: 'Mencari isyarat GPS…',
  calibrate: 'Gerakkan telefon dalam bentuk angka 8 untuk menentukur kompas',
  noCompass: 'Tiada kompas pada peranti ini – anak panah ikut arah anda berjalan',
  paused: 'Dijeda – lokasi dimatikan untuk jimat bateri',
  offRoute: 'Mencari laluan baharu…',
  offline: 'Tiada internet – menunjukkan arah garis lurus',
  pause: 'Jeda',
  resume: 'Sambung',
  showMap: 'Lihat Peta',
  end: 'Tamat',
  done: 'Selesai',
  back: 'Kembali',
  mute: 'Senyapkan suara',
  unmute: 'Hidupkan suara',
  youHaveArrived: 'Anda telah sampai',
  left: (t) => `${t} lagi`,
  nextTurn: (turn, d) => `${turn} dalam ${d}`,
  turnLeftShort: 'Belok kiri',
  turnRightShort: 'Belok kanan',
  slightLeft: 'Ikut kiri',
  slightRight: 'Ikut kanan',
  uTurn: 'Pusing U',
  continueStraight: 'Jalan terus',
  demo: 'DEMO',
  permTitle: 'Mod Anak Panah perlukan lokasi dan kompas anda',
  permBody:
    'Terus guna GPS untuk tahu lokasi anda dan kompas telefon untuk tahu arah yang anda hadap, supaya anak panah menunjuk arah yang betul. Tiada apa-apa disimpan atau dikongsi.',
  permButton: 'Benarkan dan mula',
  permDenied: 'Lokasi disekat. Benarkan lokasi untuk laman ini dalam tetapan pelayar.',
};

const zh: ArrowStrings = {
  goStraight: '直走',
  turnLeft: '左转',
  turnRight: '右转',
  arrived: '您已到达',
  turnAround: '请掉头',
  straightLine: '直线方向',
  searchingGps: '正在搜索 GPS 信号…',
  calibrate: '请以 8 字形移动手机来校准指南针',
  noCompass: '此设备没有指南针 – 箭头按您的行进方向显示',
  paused: '已暂停 – 已关闭定位以节省电量',
  offRoute: '正在重新规划路线…',
  offline: '无网络 – 显示直线方向',
  pause: '暂停',
  resume: '继续',
  showMap: '显示地图',
  end: '结束',
  done: '完成',
  back: '返回',
  mute: '静音',
  unmute: '开启语音',
  youHaveArrived: '您已到达',
  left: (t) => `剩余 ${t}`,
  nextTurn: (turn, d) => `${d} 后${turn}`,
  turnLeftShort: '左转',
  turnRightShort: '右转',
  slightLeft: '靠左',
  slightRight: '靠右',
  uTurn: '掉头',
  continueStraight: '继续直行',
  demo: '演示',
  permTitle: '箭头模式需要您的位置和指南针',
  permBody: 'Terus 使用 GPS 获取您的位置，并使用手机指南针判断您面向的方向，让箭头指向正确的路。不会储存或分享任何资料。',
  permButton: '允许并开始',
  permDenied: '位置权限已被阻止。请在浏览器设置中允许此网站使用位置。',
};

export const ARROW_STRINGS: Record<AppLanguage, ArrowStrings> = { en, ms, zh };

/** BCP-47 codes used to pick a text-to-speech voice. */
export const SPEECH_LANG: Record<AppLanguage, string> = { en: 'en-GB', ms: 'ms-MY', zh: 'zh-CN' };
