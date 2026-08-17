import type { MutateSpec } from '@/core/offline/mutate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'

// Real IndexedDB (fake-indexeddb) so the DC2 single-transaction enqueue is exercised
// end to end: the cache write-through and the queue put must land together or not at all.
// The `data-cache-db` module is wrapped so ONE test can abort the queue put mid-transaction
// and assert the cache write rolled back with it (atomicity, task 10.1a).

const sabotage = { enabled: false }

vi.mock('@/core/offline/data-cache-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/offline/data-cache-db')>()
  return {
    ...actual,
    openDataCacheDb: async () => {
      const db = await actual.openDataCacheDb()
      if (!sabotage.enabled)
        return db
      const realTransaction = db.transaction.bind(db)
      // @ts-expect-error — override for the abort simulation only.
      db.transaction = (...args: Parameters<IDBDatabase['transaction']>) => {
        const tx = realTransaction(...args)
        const realObjectStore = tx.objectStore.bind(tx)
        tx.objectStore = (name: string) => {
          const store = realObjectStore(name)
          if (name === actual.QUEUE_STORE) {
            const realPut = store.put.bind(store)
            store.put = (...putArgs: Parameters<IDBObjectStore['put']>) => {
              const req = realPut(...putArgs)
              tx.abort() // simulate a failure BETWEEN the cache write and the queue write
              return req
            }
          }
          return store
        }
        return tx
      }
      return db
    },
  }
})

const { mutate } = await import('@/core/offline/mutate')
const { isOnline } = await import('@/core/offline/use-online-status')
const { getCached, clearCached } = await import('@/core/offline/entity-cache')
const { getEntry, peekAllOrdered, remove } = await import('@/core/offline/write-queue')

interface Row { id: string, name: string }

function spec(over: Partial<MutateSpec<Row>> & { entityId: string }): MutateSpec<Row> {
  const { entityId, ...rest } = over
  return {
    run: () => {},
    intent: { entityId, kind: 'tour', op: 'create', payload: { id: entityId } },
    cacheKey: 'tours:me',
    current: [],
    apply: rows => [...rows, { id: entityId, name: 'a' }],
    assign: () => {},
    ...rest,
  }
}

describe('mutate queue-form offline enqueue (DC2)', () => {
  beforeEach(() => {
    isOnline.value = false
    sabotage.enabled = false
  })
  afterEach(async () => {
    isOnline.value = true
    await clearCached('tours:me')
    await remove('t1').catch(() => {})
  })

  it('round-trips a Blob on the queue entry and survives a DB reopen', async () => {
    const blob = new Blob(['GPX-BYTES'], { type: 'application/gpx+xml' })
    await mutate<Row>(spec({
      entityId: 't1',
      intent: { entityId: 't1', kind: 'tour', op: 'create', payload: { id: 't1' }, blobs: { 'k.gpx': blob } },
    }))

    // getEntry opens the DB afresh — proves the blob persisted under its key, not just an
    // in-memory ref. (Across the happy-dom / node realm boundary the cloned Blob loses its
    // prototype, so assert on the surviving `type` rather than instanceof / size.)
    const stored = (await getEntry('t1'))?.blobs?.['k.gpx']
    expect(stored).toBeDefined()
    expect(stored?.type).toBe('application/gpx+xml')
  })

  it('keeps ONE entry per entity across a create-then-edit (coalesced, not two rows)', async () => {
    await mutate<Row>(spec({ entityId: 't1' }))
    await mutate<Row>(spec({
      entityId: 't1',
      intent: { entityId: 't1', kind: 'tour', op: 'update', payload: { id: 't1', renamed: true } },
      current: [{ id: 't1', name: 'a' }],
      apply: rows => rows.map(r => ({ ...r, name: 'b' })),
    }))

    const all = await peekAllOrdered()
    expect(all).toHaveLength(1)
    expect(all[0].op).toBe('create') // create + update stays a create
    expect(all[0].payload).toEqual({ id: 't1', renamed: true }) // newer payload won
  })

  it('atomicity: a queue-put failure rolls back the cache write (neither lands)', async () => {
    sabotage.enabled = true

    // A manual tx.abort() rejects the enqueue (with a null tx.error) — assert it threw at all.
    let threw = false
    await mutate<Row>(spec({ entityId: 't1' })).catch(() => {
      threw = true
    })
    expect(threw).toBe(true)

    sabotage.enabled = false
    expect(await getCached('tours:me')).toBeUndefined() // cache write rolled back with the tx
    expect(await getEntry('t1')).toBeUndefined() // queue write never committed
  })
})
