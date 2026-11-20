# Terus – feature notes

Detailed notes on how each feature works, its data sources and its limits. For setup and the architecture overview, see the [README](../README.md).

## Search coverage (tested Nov 2026)

Mapbox: malls, airports, universities, hospitals, landmarks, postcodes, towns and cities
across Peninsular and East Malaysia, and "petrol station <area>" style searches.

Mapbox's search data is missing most Malaysian street names and neighbourhoods (taman).
To fill that gap, add a free **Geoapify** key (OpenStreetMap data, 3,000 requests/day,
commercial use allowed with credit) as `VITE_GEOAPIFY_KEY` in `.env.local`.
House-number addresses stay weak in both - results take you to the right street.

## Settings (gear button on the home screen)

Saved on the device: voice on/off (+ sample), Day / Night / Auto (7 pm–7 am MYT),
Detailed 3D (turn off on slower phones), avoid tolls / highways / ferries,
km or miles, keep screen on while navigating, clear recent searches.
Bahasa Melayu is listed as coming soon.

## Lane guidance & next-toll reminder (Navigation screen)

**Lane guidance** – before a junction, the instruction card gets a second row of lane arrows
(left to right): lanes you should use are green, the others grey and faded. Each lane shows its
own painted arrows (straight, left, right, slight, U-turn or combinations). The row slides in
**1.5 km** before an expressway junction (500 m in town) and stays until you pass it. In the last
**300 m** a small **junction view** card draws the road splitting with your lanes in green. A voice
cue says the lanes once per junction, in the Settings language, e.g. *"In 1 kilometre, keep right,
use the two right lanes, towards Kerinchi Link"* / *"Dalam 1 kilometer, ikut kanan, guna dua lorong
kanan…"* / *"1公里后靠右行驶，请走右侧两条车道…"*. Mapbox's own (English) turn instructions keep playing.

**Next toll** – a card at the bottom right (beside SOS) shows the distance to the next toll plaza,
counting down, its name, the Class 1 price from the verified toll table (or "Not priced") and the
toll after that ("Next: 16.2 km"). Within **1 km** it turns amber, says a short reminder ("Plaza tol
dalam 1 kilometer, sediakan Touch 'n Go atau kad") and vibrates once (Android). After a plaza it
moves to the next; with no tolls left it disappears.

**Data sources (Mapbox Directions API)** – lanes come from `bannerInstructions[].sub.components`
of type `lane` (fallback: `steps[].intersections[].lanes`), parsed in `services/laneGuidance.ts`
into `Lane { indications, recommended, preferredIndication }`. Lanes are only shown when Mapbox
has them *and* some lanes are not for you – never invented. Toll plazas come from
`steps[].intersections[].toll_collection`; `services/tollAhead.ts` snaps each onto the route line
and measures from your snapped position (`routeProgress`). Mapbox Standard has no real lane
geometry, so nothing is drawn on the map itself – the junction view is an illustration.

**Settings** – *Lane guidance* and *Toll reminder* (both on by default) under Navigation.

**Demo** – Home → **Lanes & tolls demo** (Bangsar → Damansara Utama via Kerinchi Link and
Damansara Link: 4-lane splits and two tolls, Pantai RM2.50 and Damansara RM2.00) → Simulate drive.
The pretend car does 80 km/h on expressways, so the first toll comes after ~4 minutes.

**Checks** – open `http://localhost:5173/?navcheck=1` (or run `npx tsx src/dev/runNavChecks.ts`):
23 checks of the lane parser, voice cues and toll distances against a saved excerpt of a real
Mapbox response (`src/dev/sampleDirections.ts`).

## Lane view on the map (cars)

When you drive (3D or 2D) and the map is zoomed in close (zoom 15.5+, which is the normal driving view), the road under the car is drawn lane by lane:
a dark road surface, white dashed lines between lanes, solid white edges, your recommended lane shaded teal, and a bright green
guide path that curves smoothly into the right lane 150–300 m before a junction. Painted arrows appear on the road 30–50 m before the junction.
The car itself is drawn in its lane. Turn it off in **Settings → Lane view on map** (it sits next to "Lane guidance").

Where the lane count comes from (best first):
1. Mapbox Directions junction data (`intersections[].lanes`) on your route.
2. OpenStreetMap `lanes` / `turn:lanes` tags along the route, fetched once per route from Overpass (12 s timeout, cached).
3. A default by road type: highway 3, main road 2, other roads 1.

Changes in lane count taper over about 100 m. Only the part of the route from 200 m behind to 1.5 km ahead is drawn, and it is
rebuilt every 20 m, so phones don't have to draw the whole route.

**Limits (please read):**
- This is drawn **along your route line**, not from real road paint. Lane widths are a standard 3.5 m, so the drawing can sit a little off
  the real road on very wide or very narrow roads.
- Lanes are numbered from the left kerb as the driver sees them (Mapbox's order), so lane 1 is the leftmost, slow lane in Malaysia.
- The car follows the green guide lane in the simulation. With live GPS it only snaps to a lane when the phone reports 4 m accuracy or better
  (most phones are 5–10 m, so usually it stays in the recommended lane). It **does not** detect which lane you are really in.
- Slip roads are drawn as a short 120 m peel-off stub; the full ramp shape isn't known.
- If anything fails (no lane data, Overpass busy, map error), it quietly falls back to the normal blue route line.
- Walking and cycling always use the normal route line.

Check page: open `/?navcheck=1` (or run `npx tsx src/dev/runNavChecks.ts`) for the lane-count, taper, S-curve and sharp-bend checks.

## Hazard reports & "DICARI / WANTED" posters

**Reporting:** tap the warning-triangle **Report** button. On the home map it's in the right-hand button column. During navigation it's in the left column, under the speed gauge and toll card, so it never touches SOS. It only opens below 5 km/h. While moving it says "Report when stopped", with an "I'm a passenger" option.
- Types: Lubang jalan, Sekatan jalan, Jalan banjir, Kemalangan, Lampu isyarat rosak, Lain-lain.
- The report saves the location, road name, time, type, an optional note and an optional photo. During navigation the location is the car's spot on the route and the road name comes from the route. On the home map it's your GPS position (or the map centre without GPS), with the road name from OSM / Mapbox reverse geocoding.
- Photos (camera or gallery) are shrunk in the browser to max 1080 px. The form shows "Avoid people's faces and car plates in the photo."
- **Stored on this phone only** (IndexedDB, photos included) behind a `ReportsRepository` interface (`services/reportsRepository.ts`), so a server can be plugged in later without touching the screens.
- Your own reports show as small yellow warning pins on the map. Turn everything off with **Settings → Hazard reports**.
- **Send to MyJalan** copies a plain, joke-free report (type, road, time, coordinates, note) and opens the official MyJalan KKR app listing (App Store / Google Play), or the government info page on a computer. Terus never submits anything itself, because MyJalan has no public API.

**The poster** (`services/posterRenderer.ts`, pure `<canvas>`, no image service or bundled art):
- Aged paper with torn edges and pins, "DICARI" with "WANTED" underneath, and your photo in a taped frame (or a cartoon of the hazard type).
- The road name in big letters (e.g. "LUBANG JALAN JALAN KLANG LAMA"), "Last seen" in Malaysia time, a funny line, a reward, a danger level (1–5 drawn flames, adjustable), and a small Terus logo.
- Funny lines come from `config/data/posterPhrases.ts` and follow the app language (BM, English plus Manglish, 中文). They're about the road only, never people, races, religions or politicians. Accident lines are deliberately gentle.
- Long road names shrink and wrap to 2 lines, or are cut with "…", and never run into the danger meter (checked).
- Actions: **Share** (Web Share with the image file, falling back to a download), **New funny line**, **Download**, **Send to MyJalan**. Every poster is saved to the **Wall of Shame** (Settings), which shows counts per type ("You've reported 7 potholes. Hero jalan raya! 🦸").

**Demo:** `?demo=fun` adds one sample pothole on Jalan Klang Lama. Open Settings → Wall of Shame → tap it to show a poster in seconds.

**Not tested yet:** the real share sheet and downloads on a phone, and photo capture from a real camera.

## Voice personalities (Settings → Voice personality)

Standard (plain directions, as before), **Mak Cik**, **Abang Grab**, **Ah Beng** and **Cikgu Garang**. Each has a **Preview** button.

**Safety rules** (`services/voiceJokes.ts`, covered by the dev checks):
- The real instruction is always spoken first and in full, in the normal clear voice. A joke can only come after it, as a short tag (max 70 characters).
- No joke within 100 m of the maneuver, at multi-lane / lane-choice junctions, or when the next instruction is under 300 m away.
- At most one joke every 2 minutes, and never the same line twice in a row.
- Any new instruction interrupts a joke, so a joke can never delay an instruction.
- Flood, hazard and SOS alerts always use the Standard voice and never get jokes.
- Walking and cycling keep the Standard voice.

**Content:** all lines are original, in `config/data/voicePersonalities.ts`, with 4 per event per personality. Events: turns, keep left/right, U-turn, exit, roundabout, arrival, reroute, traffic jam ahead, toll ahead (right after the toll reminder), speeding, long straight road, trip start. The humour is about driving only: no racial or religious jokes, no slurs, no swearing, no accent-mocking, no real people. Each personality speaks in its own Malaysian mix. The jokes are not translated, but the settings text is in English, Malay and Chinese.

**Voices:** each personality has its own Web Speech language, pitch and speed (e.g. Mak Cik uses a Malay voice, a bit higher and faster). How it sounds depends on the voices installed on the phone. To use recorded clips later, add `lineId → audio file` entries to `VOICE_CLIPS`; a clip plays instead of text-to-speech, after the instruction finishes.

**Traffic jam and speeding:** car routes now also ask Mapbox for traffic and speed limits along the route (`annotations=congestion,maxspeed`, the same request, no extra cost). Jam = at least 300 m of heavy traffic in the next 1.5 km. Speeding = more than 5 km/h over the posted limit for 4 seconds. Where Mapbox has no data, these lines are simply not used.

**Demo:** `?demo=fun` selects Mak Cik. In a simulated drive, the first joke usually comes at the first simple junction announced from far away (e.g. "In 500 metres, keep right…" then "Ikut kanan ya, tengok cermin dulu."). Because of the 2-minute limit, a short demo drive has only one or two jokes.

## Avatar (what represents you on the map)

**Settings → Avatar → Change avatar**, or tap your car while stopped (it honks), then **Change avatar**.

- **Presets** (all original Terus designs): classic car, hatchback, kapcai, lorry, durian on wheels, kucing, Malayan tapir, tiger cub and a teh tarik cup. Each one is built inside the browser from simple shapes (`services/avatarModels.ts`, `utils/mesh3d.ts`). It's written as a `.glb` (`services/glbWriter.ts`), so colours and accessories need no files or server. Every preset is under 4,000 triangles.
- **Buat Sendiri:** main and accent colour (colour pickers or quick palettes), an accessory (cap, sunglasses, little flag, crown) and a floating name tag. The name tag allows up to 12 characters and blocks rude words, even with tricks like "B0d0h". The classic car keeps its original colours and has no accessories.
- **Upload your own .glb:** up to 3 MB and 20,000 triangles, with textures inside the file. Terus checks it, then centres it, puts it on the ground and scales it to car size. It assumes the model faces the standard glTF direction; use **Turn 90°** if it faces the wrong way. It's stored on this device (IndexedDB). Draco/meshopt-compressed and un-indexed models are refused with a clear message, because the map can't draw them.
- **On the map:** the avatar uses the same model layer, position, heading, lane offset and building front-cutoff as the car. Animals bob and vehicles bounce slightly while moving. On arrival they hop or spin. Walking and cycling keep the walker and bicycle unless "Also use when walking & cycling" is on.
- **3D preview:** drag to turn. It uses three.js, which only downloads when the Avatar screen opens (about 160 KB compressed), so the map screen stays as light as before.
- **Limits:** no wheel spin, because Mapbox's model layer doesn't play animations inside a model (bounce only). Performance was measured on a desktop browser (about 70 fps), not yet on a mid-range phone.
- **Demo:** `?demo=fun` picks the durian with sunglasses, named "Raja Buah". Note that it replaces your saved avatar while that link is open.

## Flood & rain alerts on the route (cars)

Terus **does not predict floods**. It only shows official alerts that touch your route, and every alert says where it came from and when it was issued.

**Data sources (free, no key, via data.gov.my; checked 20 Nov 2026)**
- MET Malaysia warnings: `https://api.data.gov.my/weather/warning` (thunderstorms, heavy rain, strong winds…). Cached 10 min.
- MET Malaysia 7-day forecast: `https://api.data.gov.my/weather/forecast`, used for the destination chip (Malay text as published). Cached 3 hours.
- JPS river water levels: `https://api.data.gov.my/flood-warning` (the docs page leaves this URL out). Only the columns we use and only the states on the route are downloaded. Cached 10 min.
- District boundaries: DOSM `administrative_2_district` (github.com/dosm-malaysia/data-open), simplified to about 400 m and loaded only when alerts are checked.
- The API allows browser requests (CORS), so **no proxy / Vercel function is needed**. Fair use is about 4 requests per minute; the caches keep the app well under it.
- Data and information are subject to the Malaysian Government Open Data Terms of Use 1.0.

**Important: the JPS river feed is not live.** Its newest reading is 23 Feb 2024. Readings older than 3 hours are ignored, and the details list says so. Real flood alerts will only appear if JPS starts updating that feed again. MET warnings are live.

**How alerts are matched to a route**
1. The route is sampled every 2 km, and each point is placed in a district.
2. Warning text names places like "Selangor (Klang, Petaling) • W.P. Kuala Lumpur • Sabah: West Coast". Terus reads these in English and Malay and normalises the names ("W.P. Kuala Lumpur" = "Kuala Lumpur", Ulu = Hulu). It matches them to the route's districts, or to the whole state when only the state is named. Sections about the sea ("over the waters of…") are skipped.
3. A warning counts if it is active now or starts before you arrive (ETA).
4. River stations at ALERT / WARNING / DANGER within 3 km of the route are shown. Within 200 m at WARNING / DANGER, the route card is tagged "Flood alert on route".

**What you see**
- **Route preview:** a banner with the most important alert (tap for the full list with sources and times), a destination forecast chip, "Flood alert on route" tags, and **Avoid flood areas**. That first picks an existing route that is clear of the alert. If there isn't one, it asks Mapbox for routes that keep off the alert spot (`exclude=point(...)`, a beta feature that only tries its best) plus a detour either side, and only offers one that is actually clear. It is labelled "Avoids current official flood alerts", never "safe".
- **Navigation:** amber (rain / storm / alert level) or red (flood warning / danger) glow along the affected stretch, under the route and lane view. A small pill under the instruction card ("Flood alert in 5 km") can only be tapped for details when stopped. It steps aside while the junction view shows. A voice alert plays about 5 km and again 1 km before, in the app language (English / Malay / Chinese), with one vibration. Alerts refresh every 10 minutes and after a reroute.
- **Settings:** "Flood & weather alerts" and "Voice hazard alerts" (both on by default), plus "Flood alerts demo".

**Limits:** warnings are matched by district, so a warning for a district colours the whole stretch inside it. Sabah divisions ("West Coast", "Interior") are expanded to their districts; other area names that aren't districts are ignored rather than guessed. Alerts may not cover every flooded road. Never drive through flood water.

**Demo for presentations:** open the app with `?demo=flood` (or turn on Settings → Flood alerts demo), then use "Lanes & tolls demo". It adds a fake JPS station at danger level and a fake MET thunderstorm warning, both labelled DEMO, on the trip's first route. They go through the same matching code as real data. Checks: `/?navcheck=1` or `npx tsx src/dev/runNavChecks.ts` (60 checks, including name normalisation, time windows, station distance and segments, using saved real API responses).

## Toll estimates (cars, Class 1)

On the route screen each car route shows **Toll RM…** using the toll plazas Mapbox says the route
passes and verified fixed rates in `src/config/tollRates.ts` (open-system plazas in the Klang
Valley, KL–Karak and the Penang Bridge; each rate confirmed by 2+ published sources, last checked
20 Nov 2026). Distance-based highways (PLUS, NKVE, ELITE, LPT, LEKAS, WCE…) and unconfirmed plazas
are listed as **"Not priced"** with a link to the official LLM calculator – Terus never guesses a
toll. "RM4.40+" means some plazas on that route aren't priced. Festive discounts aren't included.
Re-check the rates file after any toll announcement.

## Arrow Mode (minimal "follow the arrow" screen)

One big arrow that points the way, the distance left, and almost nothing else – easy to follow at
a glance, friendly for older users, and handy for the **last mile** (the right building, R&R
entrance, car park or shop once you're in the area).

**Open it:** search for a place (or **long-press anywhere on the map** – right-click on a computer –
to drop a pin) → **Directions** → choose **Car / Walk / Cycle** → **Arrow Mode** (next to Start).
The arrow follows a route for the mode you chose. "Show Map" returns to the route screen.

**How the arrow works**
- It points at a spot ~20 m ahead **along the route** (70 m when driving), so it leads you round
  real corners instead of through buildings. Arrow angle = bearing to that spot − the way your
  phone faces (compass).
- No route (none found, or no internet) → points straight at the destination and says
  "Straight-line direction". It retries the route when the internet comes back.
- Colour: **green** = facing the right way (±20°), **amber** = a bit off, **red + "Turn around"**
  = facing away (beyond ±120°). **Grey** = waiting for GPS or paused (keeps the last direction).
- Off the route for 3 readings in a row → a new route is fetched automatically (max every 15 s).
- Distance (exact metres under 1 km), place name and time left (from your current speed, else the
  route estimate, else walking pace). Arrived within ~25 m → "You have arrived" + **Done**.
- Above **15 km/h** it switches to a driving view: arrow, distance and next turn only, bigger buttons.
- Voice cues ("Go straight", "Turn left/right", "You have arrived") in **English, Bahasa Melayu or
  Chinese** (Settings → Language). Light buzz when you get back on track, strong buzz on arrival
  (vibration works on Android; iPhone browsers don't allow it).
- Screen stays on. **Pause** switches location off to save battery.

**Test it at a desk – demo mode:** Settings → **Arrow Mode demo** on (or open the app with
`?demo=1` at the end of the address, e.g. `http://localhost:5173/?demo=1`). Pick any place →
Directions → Arrow Mode. A pretend walker starts ~450 m away (1.5 km if your travel mode is Car) and follows the
real route at 3× speed with a pretend compass: it starts facing the wrong way (amber), walks
(green), stops at 40% and looks back (red "Turn around"), then arrives. Choose **Car** on the route
screen first to demo the driving view.

**Test it for real (phone):** run `npm run dev:phone`, open the https address on your phone, allow
location and (iPhone) motion & orientation, then walk. If the arrow seems off, wave the phone in a
figure-8 to calibrate the compass. Most laptops have no compass, so there the arrow points as on a
north-up map until you move.

