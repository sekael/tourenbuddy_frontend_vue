## Context

`tours.updated_at` advances on every row write (`set_updated_at` trigger), so any cache keyed by
it misses on a completion or visibility toggle. The GPX bytes behind a tour only change when
`gpx_filepath` changes — provided no key is ever overwritten.

## Decisions

- **Key the parse by `gpx_filepath`, not `id@updatedAt`.** Keys are write-once (a pick mints a
  fresh uuid, an accepted suggestion copies to one), so the path identifies the bytes. Rejected:
  keeping the old parse on screen while reloading under the new key — it reloads a file that
  cannot have changed, and needs guards for overwrites that never happen.
- **Accept copies to a fresh key.** Copying to `<uid>/<tourId>.gpx` collided with the track of a
  tour created with a GPX, which the accept RPC then removed as "previous".
- **Discard copies only on a server answer.** An error code shaped like PostgREST (`PGRST…`) or
  SQLSTATE (five characters) means the call rolled back; anything else may have committed.
  Ceiling: a crash or lost response orphans one object.

## Risks

- The in-memory cache holds 10 tracks; an outing overview with more than 10 GPX stages refetches
  on re-selection (blob cache serves the bytes). Unchanged by this change.
