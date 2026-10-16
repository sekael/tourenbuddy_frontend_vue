# Spec Delta

## MODIFIED Requirements

### Requirement: Region download includes tiles and style rendering assets

A confirmed download SHALL fetch, for the selected bounding box across every zoom
level up to the source `maxzoom`, the base-map vector tiles **and** the
style.json, sprite (json + png), and glyph range PBFs the style references, and
store them in a dedicated offline tile cache. A region downloaded this way SHALL
render offline with labels and symbols, not a blank/unlabelled base map. The
download SHALL also fetch the app's ski-route tiles for the same bounding box up
to their `maxzoom`, so marked ski routes render offline; per-route detail files
SHALL NOT be downloaded.

#### Scenario: Labels render offline

- **WHEN** a region has been downloaded and the device is offline within that
  region and zoom range
- **THEN** the base map renders with its labels and symbols, not empty tiles

#### Scenario: Ski routes render offline

- **WHEN** a region has been downloaded, the device is offline within it and the
  ski-route overlay is on at zoom 11 or closer
- **THEN** the routes with route information in that region SHALL be marked

#### Scenario: Ski-route dataset refreshed after the download

- **WHEN** a newer ski-route dataset was published after the region was
  downloaded and the device is offline within that region
- **THEN** the downloaded ski-route tiles SHALL still render

#### Scenario: Download is bounded and cancelable

- **WHEN** a region download is in progress
- **THEN** progress is reported, the download uses a bounded number of concurrent
  requests, and the user can cancel it

#### Scenario: Canceled or failed download leaves no partial region

- **WHEN** a download is canceled or fails partway
- **THEN** no "downloaded" region record is presented for it and its partial cache
  writes are rolled back

#### Scenario: Quota exhausted mid-download

- **WHEN** available storage is exhausted while a download is running
- **THEN** the download aborts, reports the failure, and does not leave a region
  presented as complete

### Requirement: Downloaded base-map assets are served offline-first

The service worker SHALL serve a base-map tile, style, sprite, or glyph asset, or a
ski-route tile, from the offline download cache whenever a copy is present, using
the network only when no offline copy exists. A downloaded copy SHALL take
precedence over the network and over the opportunistic runtime tile cache.
Requests with no offline copy SHALL behave exactly as before this change (existing
runtime caching for the respective asset).

#### Scenario: Downloaded tile preferred over network

- **WHEN** the map requests a base-map asset that exists in the offline download
  cache
- **THEN** the service worker returns the offline copy without a network request

#### Scenario: Downloaded ski-route tile preferred over network

- **WHEN** the map requests a ski-route tile that exists in the offline download
  cache
- **THEN** the service worker returns the offline copy without a network request

#### Scenario: Non-downloaded tile falls back to runtime behaviour

- **WHEN** the map requests a base-map asset not present in the offline download
  cache
- **THEN** the request is handled by the existing runtime tile caching (network
  with stale-while-revalidate), unchanged
