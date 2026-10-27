## 1. Code (shipped in 76f0885d)

- [x] 1.1 Key the parsed-GPX cache and in-flight loads by `gpxFilepath` (`gpx-track-service.ts`)
- [x] 1.2 Map layer empties the track only when its path is not cached (`gpx-track-layer.ts`)
- [x] 1.3 Route numbers hold tracks per GPX path (`use-route-metrics.ts`)
- [x] 1.4 Accepted GPX suggestion copies to `gpxStorageKey(ownerId, uuidv4())`; failed accept discards copies on server rejection only; batch sweep per bucket
- [x] 1.5 Tests for each of the above

## 2. Specs

- [x] 2.1 Delta specs for `gpx-tracks`, `tour-extended-model`, `tour-attachments`, `tour-info-extended`
