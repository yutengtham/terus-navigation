# Terus – Malaysian navigation test plan

Status key: ✅ checked · 🟡 partly checked · ⬜ not yet tested

**Important:** "checked" below means checked against live Mapbox data from a desk
(20 Nov 2026, around midnight MYT). **None of these routes have been driven yet.**
Live guidance (Phase 8) was tested with a fake GPS track fed into the app; a real drive
with a phone is the next step.

## Routes from the brief (Directions API, `driving-traffic`, alternatives on)

| Route | Normal | Avoid tolls | Notes |
|---|---|---|---|
| A · KLCC (Jalan Ampang) → Pavilion KL | 3.2 km, 7 min, no tolls, via Jalan Tun Razak | same route | 1 highway-style exit ("Take exit left") |
| B · KLCC → Mid Valley Megamall | 12.6 km, 15 min, **tolls** (E39) + 11.9 km toll-free alternative | 11.9 km, 14 min / 13.1 km, 17 min | Mapbox road name typo seen: "Jalan Tun Rahah" |
| C · Sunway Pyramid → KLIA Terminal 1 | 51.4 km, 40 min, **tolls** (E5, E6) + 47.9 km alternative | 59.2 km, 65 min, no tolls | 3 exits, 1 roundabout on main route |
| D · Kuala Lumpur → Putrajaya | 33.0 km, 29 min, **tolls** (E37, E2) + alternative | 31.4 km, 31 min / 33.3 km, 37 min | 3 exits, 1 roundabout |
| E · George Town → Penang International Airport | 16.7 km, 18 min, no tolls + alternative | same | 2 exits |

Times are traffic-aware estimates at the time of testing and will differ by time of day.

## Feature checklist

| Area | Status | How it was checked |
|---|---|---|
| Urban roads (Route A, B) | 🟡 | Real route + turn instructions received; simulated drive on screen |
| Highway navigation (C, D) | 🟡 | Motorway segments + exits returned by Mapbox |
| Highway exits ("Take exit left") | 🟡 | Seen in A, C, D, E instructions; arrow icon shown in nav screen |
| Roundabouts | 🟡 | Present in C and D data; roundabout icon exists |
| U-turn instructions | 🟡 | Seen after a reroute on Jalan Tun Razak: "Make a right U-turn … if permitted" (correct for left-hand traffic) |
| Toll identification | ✅ | Toll roads flagged from Mapbox road classes (B, C, D) |
| Toll avoidance | ✅ | Toll-free routes returned for B, C, D; switch tested in UI |
| Toll prices | n/a | Not shown – no licensed Malaysian toll price source |
| Alternatives in UI | ✅ | KL → Sunway Pyramid: 2 choices (toll / toll-free), tap to switch |
| Search: malls, airports, postcodes, cities | ✅ | 20+ live searches incl. Sabah/Sarawak |
| Search: streets / taman (OpenStreetMap) | ✅ | Jalan Tuanku Abdul Rahman, TTDI, Taman Melawati |
| Search: house numbers | 🟡 | Goes to postcode/street only – data gap in both sources |
| GPS states (finding, weak, lost, blocked) | 🟡 | Simulated GPS readings; real phone test pending |
| GPS snapping to the road | ✅ | Offline maths test + fake track with ±4 m jitter stayed on route; 20 m drift ignored |
| GPS rerouting | 🟡 | Fake track 60–120 m off route → "Rerouting." → new route in ~1 s; real drive pending |
| Arrival | 🟡 | Fake track to Pavilion → "Your destination is on the left" → Arrived |
| GPS signal lost | 🟡 | No readings for 15 s → "GPS signal lost – position not updating" |
| 3D camera behaviour | 🟡 | Follows car, auto-recentres after 6 s; real phone pending |
| Voice guidance (English) | 🟡 | Mapbox instructions spoken at the right distances in fake-GPS test; real phone audio pending |
| Screen stays on | ⬜ | Wake Lock added (Settings: Keep screen on); needs a phone to confirm |
| Settings saved on device | ✅ | Day/Night/Auto, Detailed 3D, units, avoid options persist after reload |
| Night mode (map + cards) | ✅ | Dark cards, mint arrow, night map; Auto = 7 pm–7 am Malaysia time |
| Miles / mph option | ✅ | Preview "2.0 mi", nav "in 0.3 mi", gauge "mph"; voice uses imperial units |
| Avoid highways | ✅ | Sunway → KLIA: 47.9 km via E6 → 67.8 km on ordinary roads |
| Detailed 3D off (performance) | 🟡 | Trees/landmarks/facades hidden; speed gain must be measured on a mid-range phone |

## Real-drive checklist (do this with a passenger holding the phone)

1. `npm run dev:phone`, open the https address on the phone, allow location.
2. Search a destination 2–5 km away → Directions → check the start says "Your location".
3. Start navigation, turn the volume up, keep the screen on.
4. Check: car follows you, instructions count down, voice speaks before each turn.
5. Deliberately take a wrong turn → expect "Rerouting." within ~10 s and a new route.
6. Note anything wrong (time, place, what the screen said) and send it to me.

Never operate the phone yourself while driving.
