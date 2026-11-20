// Funny lines for the "DICARI / WANTED" posters. All original.
// Rule: the joke is always about the ROAD problem - never about people, races, religions or politicians.
// `{road}` is replaced with the road name (or "this road" when unknown).

import type { ReportType } from '../../models/report';

/** Poster languages: the app's three, plus Manglish lines mixed in for English. */
export type PosterLang = 'ms' | 'en' | 'manglish' | 'zh';

type Bank = Record<PosterLang, string[]>;
export type PosterPhrases = { crime: Bank; reward: Bank; danger: number };

export const POSTER_PHRASES: Record<ReportType, PosterPhrases> = {
  pothole: {
    danger: 4,
    crime: {
      ms: ['Dikehendaki kerana menelan 3 tayar Myvi', 'Dikehendaki kerana membuat semua kereta menari joget', 'Disyaki menyimpan air hujan secara haram', 'Dikehendaki kerana menggegarkan kopi pagi semua orang'],
      en: ['Wanted for crimes against suspensions', 'Wanted for swallowing hubcaps whole', 'Last seen making coffee jump out of cups', 'Wanted for turning {road} into a moon crater'],
      manglish: ['Wanted for making every car go "gedebuk" one', 'This one eat tyre like eat roti canai', 'Suspension cry already, still here ah?', 'Last seen making motorcyclists do wheelie by accident'],
      zh: ['因吞掉三个轮胎而被通缉', '涉嫌让所有车子跳舞', '罪名：摇晃大家的早晨咖啡', '把{road}变成月球表面'],
    },
    reward: {
      ms: ['Ganjaran: Tayar baru + rim percuma', 'Ganjaran: Seguni tar panas', 'Ganjaran: Absorber baharu sepasang'],
      en: ['Reward: New tyres + free rims', 'Reward: One bag of fresh asphalt', 'Reward: A smooth ride, finally'],
      manglish: ['Reward: Free wheel alignment lah', 'Reward: Teh tarik for the repair team', 'Reward: Your spine say thank you'],
      zh: ['赏金：新轮胎加免费轮框', '赏金：一袋新沥青', '赏金：终于平稳的路'],
    },
  },
  roadblock: {
    danger: 3,
    crime: {
      ms: ['Kali terakhir dilihat menyebabkan 200 kereta lewat kerja', 'Dikehendaki kerana mencuri masa semua orang', 'Disyaki menukar {road} jadi tempat letak kereta', 'Dikehendaki kerana membuat Waze menangis'],
      en: ['Last seen making 200 cars late for work', 'Wanted for stealing everyone’s lunch break', 'Wanted for turning {road} into a car park', 'Wanted for blocking the way, literally'],
      manglish: ['Block until cannot move one, wah lau', 'Last seen making boss angry because staff late', 'Stuck here until can finish one podcast', 'This one more stubborn than Monday morning'],
      zh: ['最后出现时让两百辆车上班迟到', '因偷走大家的时间而被通缉', '把{road}变成停车场', '罪名：挡路，字面意思'],
    },
    reward: {
      ms: ['Ganjaran: Masa anda kembali', 'Ganjaran: Jalan lancar semula', 'Ganjaran: Tiba awal walaupun sekali'],
      en: ['Reward: Your time back', 'Reward: A clear road, finally', 'Reward: Arriving early, just once'],
      manglish: ['Reward: Can reach on time for once', 'Reward: No need to U-turn three times', 'Reward: Free flow traffic lah'],
      zh: ['赏金：把时间还给你', '赏金：畅通的道路', '赏金：准时到达一次'],
    },
  },
  flooded: {
    danger: 5,
    crime: {
      ms: ['Dikehendaki kerana menukar {road} jadi Sungai {road}', 'Disyaki membuka kolam renang tanpa lesen', 'Dikehendaki kerana membuat kereta jadi bot', 'Kali terakhir dilihat bersama ikan keli'],
      en: ['Wanted for turning {road} into River {road}', 'Wanted for opening a swimming pool without a permit', 'Wanted for converting cars into boats', 'Last seen with a family of ducks'],
      manglish: ['Car or boat? This road also confused', 'Can fish here already lah', 'Wanted for making everyone wear slippers to work', 'This one need lifeguard, not traffic light'],
      zh: ['把{road}变成河流而被通缉', '涉嫌无证开设游泳池', '罪名：把汽车变成船', '最后出现时与一群鸭子同行'],
    },
    reward: {
      ms: ['Ganjaran: Pelampung', 'Ganjaran: Longkang yang lancar', 'Ganjaran: Kasut kering sepasang'],
      en: ['Reward: One life jacket', 'Reward: Drains that actually drain', 'Reward: Dry socks'],
      manglish: ['Reward: Free float, wear properly ah', 'Reward: Drain that really work one', 'Reward: Dry shoes for once'],
      zh: ['赏金：救生衣一件', '赏金：真正畅通的排水沟', '赏金：一双干袜子'],
    },
  },
  accident: {
    danger: 5,
    // Accidents can involve injured people: keep these about the traffic only, gentle and safety-minded.
    crime: {
      ms: ['Dikehendaki kerana menutup dua lorong di {road}', 'Disyaki punca kesesakan sepanjang 5 km', 'Kali terakhir dilihat memperlahankan seluruh jalan', 'Dikehendaki: semua pemandu sila perlahan dan berhati-hati'],
      en: ['Wanted for closing two lanes on {road}', 'Wanted for a 5 km queue', 'Last seen slowing the whole road down', 'Wanted: everyone to slow down and stay safe'],
      manglish: ['Two lanes closed, slow down ah', 'Jam very long, be patient lah', 'Keep distance, drive steady boss', 'Eyes on the road, not on the side ah'],
      zh: ['因封闭{road}两条车道而被通缉', '涉嫌造成五公里车龙', '最后出现时让整条路慢下来', '通缉：所有司机请减速，注意安全'],
    },
    reward: {
      ms: ['Ganjaran: Semua selamat sampai', 'Ganjaran: Pemandu yang berhati-hati', 'Ganjaran: Jalan lapang semula'],
      en: ['Reward: Everyone home safe', 'Reward: Careful drivers', 'Reward: An open road again'],
      manglish: ['Reward: Everybody reach home safe lah', 'Reward: No more kepo slow down', 'Reward: Drive carefully, boss'],
      zh: ['赏金：大家平安到家', '赏金：小心驾驶的司机', '赏金：重新畅通的道路'],
    },
  },
  traffic_light: {
    danger: 3,
    crime: {
      ms: ['Dikehendaki kerana menyebabkan semua orang jadi polis trafik', 'Disyaki berkelip-kelip tanpa sebab', 'Dikehendaki kerana merah selama-lamanya', 'Kali terakhir dilihat menyala hijau untuk semua arah'],
      en: ['Wanted for making everyone a traffic police officer', 'Wanted for blinking with no reason', 'Wanted for being red forever', 'Last seen showing green in every direction'],
      manglish: ['Red ah green ah? Even the light also blur', 'Last seen making every junction "who brave who go"', 'This light got trust issues', 'Blinking until like disco already'],
      zh: ['因让所有人都变成交警而被通缉', '涉嫌无故闪烁', '罪名：永远红灯', '最后出现时四个方向都是绿灯'],
    },
    reward: {
      ms: ['Ganjaran: Lampu yang ikut giliran', 'Ganjaran: Simpang yang tenang', 'Ganjaran: Mentol baharu'],
      en: ['Reward: Lights that take turns', 'Reward: A calm junction', 'Reward: One new bulb'],
      manglish: ['Reward: Light that know how to count', 'Reward: No more junction drama', 'Reward: New bulb, simple only'],
      zh: ['赏金：会轮流亮的灯', '赏金：平静的路口', '赏金：一颗新灯泡'],
    },
  },
  other: {
    danger: 2,
    crime: {
      ms: ['Dikehendaki kerana mengganggu perjalanan yang aman', 'Disyaki membuat pemandu menggaru kepala', 'Kali terakhir dilihat di {road}', 'Dikehendaki untuk soal siasat oleh pengguna jalan raya'],
      en: ['Wanted for disturbing a peaceful drive', 'Wanted for making drivers scratch their heads', 'Last seen lurking on {road}', 'Wanted for questioning by every road user'],
      manglish: ['Something wrong here, confirm plus chop', 'This one make everyone "eh, what is that?"', 'Last seen making drivers blur', 'Weird thing on the road, siasat lah'],
      zh: ['因打扰平静的行程而被通缉', '涉嫌让司机摸不着头脑', '最后出现在{road}', '所有道路使用者都想问个明白'],
    },
    reward: {
      ms: ['Ganjaran: Jalan yang sempurna', 'Ganjaran: Perjalanan tanpa drama', 'Ganjaran: Senyuman pemandu'],
      en: ['Reward: A perfect road', 'Reward: A drama-free drive', 'Reward: Happy drivers'],
      manglish: ['Reward: Smooth journey lah', 'Reward: No more drama', 'Reward: Drivers happy happy'],
      zh: ['赏金：完美的道路', '赏金：毫无波折的旅程', '赏金：开心的司机'],
    },
  },
};
