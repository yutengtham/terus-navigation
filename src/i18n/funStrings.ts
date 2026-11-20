import type { PersonalityId } from '../config/data/voicePersonalities';
import type { AppLanguage } from './arrowStrings';

export type AvatarStrings = {
  title: string;
  presets: string;
  build: string;
  colours: string;
  main: string;
  accent: string;
  palettes: string;
  accessory: string;
  nameTag: string;
  namePlaceholder: string;
  nameRude: string;
  allModes: string;
  upload: string;
  uploadHint: string;
  rotate: string;
  uploadOk: (triangles: number) => string;
  classicNote: string;
  done: string;
  cancel: string;
  dragHint: string;
  changeAvatar: string;
  loading: string;
};

export const AVATAR_STRINGS: Record<AppLanguage, AvatarStrings> = {
  en: {
    title: 'Avatar',
    presets: 'Choose who drives',
    build: 'Buat Sendiri (make your own)',
    colours: 'Colours',
    main: 'Main',
    accent: 'Accent',
    palettes: 'Quick colours',
    accessory: 'Accessory',
    nameTag: 'Name tag',
    namePlaceholder: 'Up to 12 letters',
    nameRude: 'Please choose a friendlier name.',
    allModes: 'Also use when walking & cycling',
    upload: 'Upload your own (.glb)',
    uploadHint: 'Max 3 MB and 20,000 triangles. Scaled to car size automatically.',
    rotate: 'Turn 90°',
    uploadOk: (n) => `Model OK · ${n.toLocaleString()} triangles`,
    classicNote: 'The classic car keeps its own colours and has no accessories.',
    done: 'Done',
    cancel: 'Cancel',
    dragHint: 'Drag to turn',
    changeAvatar: 'Change avatar',
    loading: 'Loading 3D preview…',
  },
  ms: {
    title: 'Avatar',
    presets: 'Pilih pemandu anda',
    build: 'Buat Sendiri',
    colours: 'Warna',
    main: 'Utama',
    accent: 'Aksen',
    palettes: 'Warna pantas',
    accessory: 'Aksesori',
    nameTag: 'Tag nama',
    namePlaceholder: 'Maksimum 12 huruf',
    nameRude: 'Sila pilih nama yang lebih sopan.',
    allModes: 'Guna juga semasa berjalan & berbasikal',
    upload: 'Muat naik model sendiri (.glb)',
    uploadHint: 'Maks 3 MB dan 20,000 segi tiga. Saiz dilaras ke saiz kereta secara automatik.',
    rotate: 'Pusing 90°',
    uploadOk: (n) => `Model OK · ${n.toLocaleString()} segi tiga`,
    classicNote: 'Kereta klasik mengekalkan warnanya sendiri dan tiada aksesori.',
    done: 'Siap',
    cancel: 'Batal',
    dragHint: 'Seret untuk pusing',
    changeAvatar: 'Tukar avatar',
    loading: 'Memuatkan pratonton 3D…',
  },
  zh: {
    title: '头像',
    presets: '选择你的座驾',
    build: '自己动手做',
    colours: '颜色',
    main: '主色',
    accent: '配色',
    palettes: '快速配色',
    accessory: '配饰',
    nameTag: '名牌',
    namePlaceholder: '最多 12 个字',
    nameRude: '请换一个友善的名字。',
    allModes: '步行和骑车时也使用',
    upload: '上传自己的模型（.glb）',
    uploadHint: '最大 3 MB、20,000 个三角形，会自动缩放到汽车大小。',
    rotate: '旋转 90°',
    uploadOk: (n) => `模型可用 · ${n.toLocaleString()} 个三角形`,
    classicNote: '经典汽车保留原本颜色，不能加配饰。',
    done: '完成',
    cancel: '取消',
    dragHint: '拖动旋转',
    changeAvatar: '更换头像',
    loading: '正在加载 3D 预览…',
  },
};

type PersonalityText = { name: string; desc: string };

export const VOICE_STRINGS: Record<AppLanguage, { title: string; hint: string; preview: string; sample: string; people: Record<PersonalityId, PersonalityText> }> = {
  en: {
    title: 'Voice personality',
    hint: 'Directions always come first and in full. A short joke may follow, never near a turn, at most every 2 minutes. Flood and SOS alerts stay serious.',
    preview: 'Preview',
    sample: 'In 200 metres, turn left.',
    people: {
      standard: { name: 'Standard', desc: 'Plain directions, no jokes' },
      makcik: { name: 'Mak Cik', desc: 'Caring auntie who told you so' },
      abanggrab: { name: 'Abang Grab', desc: 'Friendly e-hailing driver, knows every short cut' },
      ahbeng: { name: 'Ah Beng', desc: 'Steady Manglish buddy' },
      cikgu: { name: 'Cikgu Garang', desc: 'Strict teacher, no excuses' },
    },
  },
  ms: {
    title: 'Personaliti suara',
    hint: 'Arahan sentiasa didahulukan dan lengkap. Gurauan pendek mungkin menyusul, tidak dekat simpang, paling kerap setiap 2 minit. Amaran banjir dan SOS kekal serius.',
    preview: 'Dengar',
    sample: 'Dalam 200 meter, belok kiri.',
    people: {
      standard: { name: 'Standard', desc: 'Arahan biasa, tiada gurauan' },
      makcik: { name: 'Mak Cik', desc: 'Mak cik prihatin yang dah pesan awal-awal' },
      abanggrab: { name: 'Abang Grab', desc: 'Pemandu e-hailing mesra, tahu semua jalan pintas' },
      ahbeng: { name: 'Ah Beng', desc: 'Kawan Manglish yang steady' },
      cikgu: { name: 'Cikgu Garang', desc: 'Cikgu tegas, tiada alasan' },
    },
  },
  zh: {
    title: '语音角色',
    hint: '导航指示永远优先并完整播报，之后才可能有一句短笑话；路口附近不说，最多每 2 分钟一次。水灾和 SOS 警报保持严肃。',
    preview: '试听',
    sample: '200 米后左转。',
    people: {
      standard: { name: '标准', desc: '普通导航，没有笑话' },
      makcik: { name: 'Mak Cik 阿姨', desc: '早就提醒过你的贴心阿姨' },
      abanggrab: { name: 'Abang Grab 司机', desc: '热情的网约车司机，捷径全知道' },
      ahbeng: { name: 'Ah Beng', desc: '讲 Manglish 的稳阵朋友' },
      cikgu: { name: 'Cikgu Garang 老师', desc: '严格老师，不接受借口' },
    },
  },
};
