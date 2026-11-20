// Voice personalities: short, affectionate joke tags said AFTER the real instruction.
// All lines are original. Rules for writers: humour about driving and roads only - no racial or
// religious jokes, no slurs, no swearing, no mocking of accents, no real people or celebrities.
// Each personality writes in its own natural Malaysian mix (Malay / English / Manglish).
// Flood and hazard alerts never get jokes (the bank is empty and the code blocks it too).

export type PersonalityId = 'standard' | 'makcik' | 'abanggrab' | 'ahbeng' | 'cikgu';

export type VoiceEvent =
  | 'turn_left'
  | 'turn_right'
  | 'keep_left'
  | 'keep_right'
  | 'uturn'
  | 'exit'
  | 'roundabout'
  | 'arrive'
  | 'reroute'
  | 'traffic_jam'
  | 'toll_ahead'
  | 'flood_alert'
  | 'speeding'
  | 'long_straight'
  | 'trip_start';

/** Web Speech settings that make each personality sound different (where the phone has the voice). */
export type PersonalityVoice = { lang: string; pitch: number; rate: number };

export type Personality = {
  id: PersonalityId;
  voice: PersonalityVoice;
  /** Lines per event. A line's id is `${personality}.${event}.${index}`. */
  lines: Partial<Record<VoiceEvent, string[]>>;
};

/**
 * Optional pre-recorded audio per line id (e.g. 'makcik.arrive.0': '/audio/makcik-arrive-0.mp3').
 * When a clip exists it is played instead of text-to-speech. Empty for now.
 */
export const VOICE_CLIPS: Partial<Record<string, string>> = {};

export const PERSONALITIES: Record<PersonalityId, Personality> = {
  standard: { id: 'standard', voice: { lang: 'en-GB', pitch: 1, rate: 1 }, lines: {} },

  makcik: {
    id: 'makcik',
    voice: { lang: 'ms-MY', pitch: 1.25, rate: 1.05 },
    lines: {
      turn_left: ['Haa, belok kiri! Kan mak dah cakap tadi.', 'Kiri ya sayang, jangan buat-buat lupa.', 'Kiri tu kiri, bukan kanan. Mak tengok ni.', 'Pelan-pelan belok, mak bawa kuih ni.'],
      turn_right: ['Kanan, nak. Signal dulu, jangan main redah.', 'Haa kanan! Macam abah kamu bawa kereta dulu.', 'Belok kanan, lepas tu kita singgah beli nasi lemak.', 'Kanan ya. Mak percaya kamu boleh.'],
      keep_left: ['Ikut kiri, jangan potong-potong orang.', 'Lorong kiri, nak. Tenang-tenang sahaja.', 'Kiri sikit, macam letak baju dalam almari, kemas.', 'Duduk kiri, biar orang laju lalu dulu.'],
      keep_right: ['Ikut kanan ya, tengok cermin dulu.', 'Kanan sikit, nak. Jangan terkejut-kejut.', 'Lorong kanan, tapi jangan laju sangat, mak risau.', 'Haa kanan, pandai anak mak.'],
      uturn: ['U-turn? Tak apa, mak pun selalu tersilap jalan.', 'Pusing balik, nak. Rezeki tak lari.', 'Patah balik, perlahan-lahan ya.', 'Hmm, tadi mak dah bagi tahu. Tak apa, pusing.'],
      exit: ['Keluar sini, jangan terlepas macam minggu lepas.', 'Exit ni, nak. Nanti mak belanja teh tarik.', 'Ambil susur keluar ya, jangan mengelamun.', 'Keluar sini, bagus, dengar cakap mak.'],
      roundabout: ['Bulatan! Pusing elok-elok, jangan pening.', 'Masuk bulatan, bagi laluan dulu ya.', 'Pusing-pusing bulatan, macam mak kacau dodol.', 'Bulatan depan, sabar sikit.'],
      arrive: ['Syukur, sampai jugak. Jangan lupa makan.', 'Dah sampai! Mak bangga dengan kamu.', 'Sampai dah, nak. Kirim salam semua orang.', 'Selamat sampai. Jangan lupa kunci kereta.'],
      reroute: ['Haa kan, tak dengar cakap mak. Tak apa, kita cari jalan lain.', 'Sesat sikit je, nak. Mak tunjuk jalan baru.', 'Tak apa, jalan banyak. Rilek dulu.', 'Itulah, sibuk sangat. Ikut jalan baru ni.'],
      traffic_jam: ['Jem depan. Sabar, nak, makan kerepek dulu.', 'Alamak, sesak. Tak apa, kita borak-borak.', 'Jem lagi. Jalan raya ni macam pasar malam.', 'Depan jem, jangan marah-marah, nanti cepat tua.'],
      toll_ahead: ['Tol depan, dah ada duit dalam kad?', 'Tol, nak. Mak harap baki cukup.', 'Sediakan kad tol, jangan kelam-kabut.', 'Tol lagi, mahal betul jalan ni.'],
      speeding: ['Perlahan sikit, mak tak nak kamu masuk surat khabar.', 'Laju sangat ni! Mak pegang dada ni.', 'Slow sikit, nak, kita bukan nak kejar kenduri.', 'Aduhai, laju! Kurangkan sikit.'],
      long_straight: ['Jalan lurus panjang. Jangan mengantuk, nak.', 'Lurus je ni. Mak nyanyi sikit boleh?', 'Lurus lagi. Minum air dulu, nak.', 'Jalan lurus, macam sabar mak dengan kamu.'],
      trip_start: ['Okey sayang, jom gerak. Pakai tali pinggang.', 'Jom jalan, nak. Mak duduk sebelah ni.', 'Jalan dulu, nanti lapar kita berhenti.', 'Okey, gerak! Jangan lupa signal.'],
    },
  },

  abanggrab: {
    id: 'abanggrab',
    voice: { lang: 'ms-MY', pitch: 0.95, rate: 1.08 },
    lines: {
      turn_left: ['Kiri bos, saya tahu jalan ni.', 'Kita masuk kiri, short cut sikit bos.', 'Kiri, bos. Aircond okey tak?', 'Belok kiri, lagu radio sedap ni bos.'],
      turn_right: ['Kanan bos, jalan ni lagi laju.', 'Masuk kanan, bos rilek je.', 'Kanan, bos. Saya hafal jalan ni.', 'Kanan, lepas tu straight je bos.'],
      keep_left: ['Ambil kiri bos, elak lorong laju.', 'Kiri sikit bos, selamat sampai.', 'Lorong kiri, bos, jalan senang.', 'Duduk kiri, kita santai je bos.'],
      keep_right: ['Kanan bos, lepas tu clear.', 'Lorong kanan, bos, laju sikit.', 'Ambil kanan bos, percaya saya.', 'Kanan bos, saya tak sesat punya.'],
      uturn: ['Pusing balik bos, jalan depan tutup tadi.', 'U-turn bos, sikit je tak apa.', 'Patah balik bos, saya bagi diskaun.', 'U-turn, bos. Tak caj extra.'],
      exit: ['Keluar sini bos, dah dekat.', 'Exit ni bos, lagi sikit sampai.', 'Ambil exit bos, jalan ni tak jem.', 'Keluar bos, saya tahu jalan belakang.'],
      roundabout: ['Bulatan bos, pegang kopi tu.', 'Masuk bulatan, bos, rilek.', 'Pusing bulatan, bos, jangan pening.', 'Bulatan ni saya dah lalu seribu kali bos.'],
      arrive: ['Sampai dah bos, jangan lupa bagi five star.', 'Dah sampai bos, barang jangan tertinggal.', 'Sampai bos! Terima kasih naik dengan saya.', 'Okey bos, kita dah sampai, selamat jalan.'],
      reroute: ['Tak apa bos, saya cari jalan lain.', 'Jalan tadi jem bos, kita ikut ni.', 'Bos rilek, jalan baru lagi cepat.', 'Ubah jalan bos, sama je sampai.'],
      traffic_jam: ['Bos, depan jem sikit, kita ikut jalan ni okey?', 'Jem bos. Nak saya pasang lagu?', 'Sesak depan bos, sabar sikit.', 'Jem bos, tapi meter tak naik, jangan risau.'],
      toll_ahead: ['Tol depan bos, saya dah top up.', 'Tol bos, kad dah ready.', 'Lepas tol ni, dah dekat bos.', 'Tol bos, nanti masuk dalam resit.'],
      speeding: ['Bos, saya slow sikit, rating penting.', 'Laju sikit ni bos, kita perlahan.', 'Slow bos, saman mahal sekarang.', 'Perlahan bos, selamat lebih penting.'],
      long_straight: ['Jalan lurus bos, rehat dulu.', 'Straight je bos, saya jaga.', 'Lurus panjang bos, nak air mineral?', 'Lurus bos, sambil tu cerita sikit.'],
      trip_start: ['Okey bos, kita gerak sekarang.', 'Selamat datang bos, pakai seat belt ya.', 'Jom bos, saya dah tengok jalan.', 'Gerak bos, kita sampai awal.'],
    },
  },

  ahbeng: {
    id: 'ahbeng',
    voice: { lang: 'en-GB', pitch: 1.05, rate: 1.12 },
    lines: {
      turn_left: ['Left lah boss, steady.', 'Turn left, slowly ah, no need to rush.', 'Left ah, I know this road one.', 'Left lor, easy peasy.'],
      turn_right: ['Right ah boss, signal first.', 'Turn right lah, look properly.', 'Right lor, then straight only.', 'Right ah, steady boss.'],
      keep_left: ['Keep left ah, slow lane also can.', 'Left lane lah boss, no need to race.', 'Stay left, relax one.', 'Left side ah, chill.'],
      keep_right: ['Keep right ah, then can go already.', 'Right lane lah, but don’t simply cut.', 'Right side boss, steady.', 'Keep right lor, almost there.'],
      uturn: ['Wah lau eh, wrong turn again ah? Never mind, U-turn lor.', 'U-turn lah boss, small thing only.', 'Turn back lor, road won’t run away.', 'Aiyo, U-turn lah, relax.'],
      exit: ['Exit here ah, don’t miss.', 'Take exit lah boss, near already.', 'Exit ah, then can makan.', 'Exit lor, steady.'],
      roundabout: ['Roundabout ah, go round slowly.', 'Round and round lah, like my weekend.', 'Roundabout boss, give way first.', 'Roundabout ah, don’t blur.'],
      arrive: ['Reach already boss, power lah!', 'Arrived ah, good job boss.', 'Sampai already lor, go makan.', 'Reached, boss. Steady one.'],
      reroute: ['Aiyo, never mind, new route lor.', 'Wrong way ah? Can, I find another one.', 'Relax boss, new road also can reach.', 'Okay okay, change route lah.'],
      traffic_jam: ['Jam again ah? Like that one lah KL.', 'Front jam boss, patience lor.', 'Wah, car park on the road ah.', 'Jam lah boss, play some songs.'],
      toll_ahead: ['Toll coming, prepare Touch ’n Go ah boss.', 'Toll ah, hope got balance.', 'Toll again lor, road also need makan.', 'Toll boss, card ready or not?'],
      speeding: ['Wah boss, so fast ah? Slow down lah.', 'Too fast lah boss, saman coming.', 'Easy ah boss, this one not F1.', 'Slow a bit lah, safety first.'],
      long_straight: ['Long straight road, don’t sleep ah.', 'Straight only, boss, steady.', 'Straight road ah, drink some water.', 'Very long one ah, chill.'],
      trip_start: ['Okay boss, jom go!', 'Seat belt on ah, we go now.', 'Start already, steady boss.', 'Let’s go lah boss.'],
    },
  },

  cikgu: {
    id: 'cikgu',
    voice: { lang: 'ms-MY', pitch: 0.9, rate: 1.0 },
    lines: {
      turn_left: ['Kiri! Dengar baik-baik.', 'Belok kiri, macam cikgu ajar tadi.', 'Kiri. Siapa tak dengar, ulang semula.', 'Kiri! Fokus, jangan main telefon.'],
      turn_right: ['Kanan! Signal dulu, baru belok.', 'Belok kanan. Ini akan masuk peperiksaan.', 'Kanan! Duduk tegak.', 'Kanan. Bagus, ada harapan.'],
      keep_left: ['Lorong kiri. Beratur, jangan potong barisan.', 'Ikut kiri, macam beratur di kantin.', 'Kiri. Jangan ikut suka hati.', 'Lorong kiri, disiplin itu penting.'],
      keep_right: ['Lorong kanan. Tengok cermin, kemudian bergerak.', 'Kanan. Ikut arahan, jangan berangan.', 'Ikut kanan. Cikgu perhati ni.', 'Kanan! Satu, dua, tiga, gerak.'],
      uturn: ['Siapa suruh tak ikut arahan? U-turn sekarang!', 'Pusing balik. Lain kali dengar.', 'U-turn. Tulis seratus kali: saya akan ikut arahan.', 'Patah balik! Jangan buat muka.'],
      exit: ['Keluar sini. Jangan berangan.', 'Exit! Siapa terlepas, kerja rumah tambah.', 'Ambil susur keluar. Bagus.', 'Keluar sekarang, ikut arahan.'],
      roundabout: ['Bulatan. Bagi laluan kepada kanan, ingat!', 'Masuk bulatan, ikut peraturan.', 'Bulatan! Jangan pusing tiga kali.', 'Bulatan. Fokus, kelas.'],
      arrive: ['Sampai. Lambat lagi?! Esok datang awal!', 'Sampai. Markah: lulus.', 'Bagus, sampai dengan selamat. Kelas bersurai.', 'Sampai. Simpan barang, beratur keluar.'],
      reroute: ['Siapa yang salah jalan? Tak apa, cikgu betulkan.', 'Salah jalan. Kita ulang kaji laluan baru.', 'Tersasar. Dengar arahan baru ni.', 'Jalan baru. Kali ini tumpu perhatian.'],
      traffic_jam: ['Jem. Sementara itu, hafal sifir tujuh.', 'Sesak depan. Sabar itu sebahagian dari ujian.', 'Jem. Jangan merungut, duduk diam.', 'Kenderaan banyak. Bersabar, kelas.'],
      toll_ahead: ['Tol di hadapan. Sediakan kad, jangan tercari-cari.', 'Tol. Siapa tak bawa kad, berdiri luar kelas.', 'Tol depan, bersedia.', 'Tol. Baki kad dah semak?'],
      speeding: ['Laju! Kurangkan kelajuan sekarang!', 'Ini bukan sukan tahunan. Perlahan!', 'Siapa benarkan laju macam ni? Perlahan.', 'Had laju itu peraturan, bukan cadangan.'],
      long_straight: ['Jalan lurus. Jangan tidur dalam kelas.', 'Lurus panjang. Duduk tegak, mata depan.', 'Lurus. Cikgu masih perhati.', 'Jalan lurus, macam garis pembaris.'],
      trip_start: ['Baik, kelas bermula. Pakai tali pinggang.', 'Kita mulakan. Ikut semua arahan.', 'Bangun! Kita bergerak sekarang.', 'Sedia? Mula!'],
    },
  },
};

export const PERSONALITY_IDS: PersonalityId[] = ['standard', 'makcik', 'abanggrab', 'ahbeng', 'cikgu'];
