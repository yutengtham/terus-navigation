import type { ReportType } from '../models/report';
import type { AppLanguage } from './arrowStrings';

export const REPORT_TYPE_LABEL: Record<ReportType, Record<AppLanguage, string>> = {
  pothole: { ms: 'Lubang jalan', en: 'Pothole', zh: '路面坑洞' },
  roadblock: { ms: 'Sekatan jalan', en: 'Roadblock', zh: '路障' },
  flooded: { ms: 'Jalan banjir', en: 'Flooded road', zh: '道路积水' },
  accident: { ms: 'Kemalangan', en: 'Accident', zh: '车祸' },
  traffic_light: { ms: 'Lampu isyarat rosak', en: 'Broken traffic light', zh: '交通灯故障' },
  other: { ms: 'Lain-lain', en: 'Other', zh: '其他' },
};

export const REPORT_ICON: Record<ReportType, string> = {
  pothole: '🕳️',
  roadblock: '🚧',
  flooded: '🌊',
  accident: '💥',
  traffic_light: '🚦',
  other: '❓',
};

export type ReportStrings = {
  report: string;
  reportWhenStopped: string;
  passenger: string;
  title: string;
  where: string;
  findingRoad: string;
  unknownRoad: string;
  note: string;
  notePlaceholder: string;
  photo: string;
  photoHint: string;
  removePhoto: string;
  danger: string;
  save: string;
  cancel: string;
  saving: string;
  // poster
  wanted: string;
  lastSeen: string;
  reward: string;
  dangerLevel: string;
  thisRoad: string;
  share: string;
  download: string;
  saved: string;
  regenerate: string;
  myJalan: string;
  myJalanCopied: string;
  wall: string;
  wallEmpty: string;
  wallHero: (count: number, typeLabel: string) => string;
  total: (n: number) => string;
  delete: string;
  close: string;
  sharedFallback: string;
  settingsLabel: string;
  settingsHint: string;
};

export const REPORT_STRINGS: Record<AppLanguage, ReportStrings> = {
  en: {
    report: 'Report',
    reportWhenStopped: 'Report when stopped',
    passenger: 'I’m a passenger',
    title: 'Report a road problem',
    where: 'Location',
    findingRoad: 'Finding the road name…',
    unknownRoad: 'Road name unknown',
    note: 'Note (optional)',
    notePlaceholder: 'e.g. deep, left lane',
    photo: 'Add photo',
    photoHint: 'Avoid people’s faces and car plates in the photo.',
    removePhoto: 'Remove photo',
    danger: 'Danger level',
    save: 'Make poster',
    cancel: 'Cancel',
    saving: 'Saving…',
    wanted: 'WANTED',
    lastSeen: 'Last seen',
    reward: 'Reward',
    dangerLevel: 'Danger level',
    thisRoad: 'this road',
    share: 'Share',
    download: 'Download',
    saved: 'Saved to your Wall of Shame',
    regenerate: 'New funny line',
    myJalan: 'Send to MyJalan',
    myJalanCopied: 'Report text copied – paste it in the official MyJalan KKR app.',
    wall: 'Wall of Shame',
    wallEmpty: 'No posters yet. Report a road problem when you’re stopped.',
    wallHero: (n, t) => `You’ve reported ${n} ${t.toLowerCase()}${n === 1 ? '' : 's'}. Hero jalan raya! 🦸`,
    total: (n) => `${n} report${n === 1 ? '' : 's'} · saved on this phone only`,
    delete: 'Delete',
    close: 'Close',
    sharedFallback: 'Sharing isn’t available here – the image was downloaded instead.',
    settingsLabel: 'Hazard reports',
    settingsHint: 'Report button, your warning pins on the map and Wanted posters',
  },
  ms: {
    report: 'Lapor',
    reportWhenStopped: 'Lapor bila berhenti',
    passenger: 'Saya penumpang',
    title: 'Lapor masalah jalan',
    where: 'Lokasi',
    findingRoad: 'Mencari nama jalan…',
    unknownRoad: 'Nama jalan tidak diketahui',
    note: 'Nota (pilihan)',
    notePlaceholder: 'cth. dalam, lorong kiri',
    photo: 'Tambah gambar',
    photoHint: 'Elakkan wajah orang dan nombor plat kereta dalam gambar.',
    removePhoto: 'Buang gambar',
    danger: 'Tahap bahaya',
    save: 'Buat poster',
    cancel: 'Batal',
    saving: 'Menyimpan…',
    wanted: 'WANTED',
    lastSeen: 'Kali terakhir dilihat',
    reward: 'Ganjaran',
    dangerLevel: 'Tahap bahaya',
    thisRoad: 'jalan ini',
    share: 'Kongsi',
    download: 'Muat turun',
    saved: 'Disimpan di Dinding Malu anda',
    regenerate: 'Ayat lucu baharu',
    myJalan: 'Hantar ke MyJalan',
    myJalanCopied: 'Teks laporan disalin – tampal dalam aplikasi rasmi MyJalan KKR.',
    wall: 'Dinding Malu',
    wallEmpty: 'Belum ada poster. Lapor masalah jalan semasa berhenti.',
    wallHero: (n, t) => `Anda telah melaporkan ${n} ${t.toLowerCase()}. Hero jalan raya! 🦸`,
    total: (n) => `${n} laporan · disimpan dalam telefon ini sahaja`,
    delete: 'Padam',
    close: 'Tutup',
    sharedFallback: 'Perkongsian tidak tersedia di sini – gambar dimuat turun.',
    settingsLabel: 'Laporan bahaya jalan',
    settingsHint: 'Butang Lapor, pin amaran anda di peta dan poster Dicari',
  },
  zh: {
    report: '报告',
    reportWhenStopped: '停车后再报告',
    passenger: '我是乘客',
    title: '报告道路问题',
    where: '位置',
    findingRoad: '正在查找路名…',
    unknownRoad: '路名不详',
    note: '备注（可选）',
    notePlaceholder: '例如：很深，左车道',
    photo: '添加照片',
    photoHint: '照片中请避开人脸和车牌。',
    removePhoto: '删除照片',
    danger: '危险等级',
    save: '生成海报',
    cancel: '取消',
    saving: '正在保存…',
    wanted: 'WANTED · 通缉',
    lastSeen: '最后出现',
    reward: '赏金',
    dangerLevel: '危险等级',
    thisRoad: '这条路',
    share: '分享',
    download: '下载',
    saved: '已保存到你的耻辱墙',
    regenerate: '换一句笑话',
    myJalan: '提交到 MyJalan',
    myJalanCopied: '报告内容已复制，请粘贴到官方 MyJalan KKR 应用。',
    wall: '耻辱墙',
    wallEmpty: '还没有海报。停车时报告道路问题吧。',
    wallHero: (n, t) => `你已经报告了 ${n} 个${t}。道路英雄！🦸`,
    total: (n) => `${n} 份报告 · 只保存在这部手机`,
    delete: '删除',
    close: '关闭',
    sharedFallback: '这里无法分享，已改为下载图片。',
    settingsLabel: '道路问题报告',
    settingsHint: '报告按钮、地图上的警示标记和通缉海报',
  },
};
