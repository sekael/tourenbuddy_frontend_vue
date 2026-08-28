import type {
  SuggestionItem,
  TourSuggestion,
} from '@/features/tours/domain/entities/tour-suggestion'
import type {
  ResolveResult,
  TourSuggestionsRepository,
} from '@/features/tours/domain/repositories/tour-suggestions-repository'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@/core/utils/supabase'
import { tourSuggestionRowSchema } from '@/features/tours/data/models/tour-suggestion'
import { gpxStorageKey } from '@/features/tours/data/services/gpx-storage-service'

export type StagedBucket = 'tour-gpx' | 'tour-attachments'

/** Which bucket a staged blob for this field lives in. */
export function bucketForField(field: string): StagedBucket | null {
  if (field === 'gpx')
    return 'tour-gpx'
  if (field === 'attachment_add')
    return 'tour-attachments'
  return null
}

/**
 * The suggester's own prefix (design D9). The first path segment is their uid, so the
 * EXISTING owner-insert storage policy already permits the write — no new INSERT policy,
 * no weakening of anyone's isolation.
 */
export function stagedPath(userId: string, tourId: string, ext: string): string {
  return `${userId}/suggestions/${tourId}/${uuidv4()}${ext}`
}

function extOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(dot) : ''
}

function storagePathOf(row: TourSuggestion): string | null {
  const value = row.value as { storagePath?: string } | null
  return value?.storagePath ?? null
}

export class SupabaseTourSuggestionsRepository implements TourSuggestionsRepository {
  async listForUser(): Promise<TourSuggestion[]> {
    // One query for the whole feature (D15) — the same predicate as the SELECT policy and
    // the realtime filters, so RLS alone scopes it and no `.or(...)` filter is needed.
    const { data, error } = await supabase
      .from('tour_suggestion_view')
      .select('*')
      .order('created_at', { ascending: false })

    if (error)
      throw new Error(error.message)

    return (data ?? []).map(row => tourSuggestionRowSchema.parse(row))
  }

  async upsertBatch(tourId: string, batchId: string, items: SuggestionItem[]): Promise<void> {
    const { error } = await supabase.rpc('upsert_tour_suggestions', {
      p_tour_id: tourId,
      p_batch_id: batchId,
      p_items: items.map(i => ({ field: i.field, value: i.value, targetId: i.targetId ?? null })),
    })

    if (error)
      throw new Error(error.message)
  }

  async accept(suggestion: TourSuggestion): Promise<ResolveResult> {
    const ownPath = await this.copyStagedToOwner(suggestion)

    const { data, error } = await supabase.rpc('accept_tour_suggestion', {
      p_id: suggestion.id,
      p_storage_path: ownPath,
    })

    if (error)
      throw new Error(error.message)

    const result = (data ?? {}) as Record<string, unknown>
    await this.sweepOwnerLeftovers([result.removed_storage_path as string | null], suggestion.field)

    return {
      resolvedBatches: (result.resolved_batches as string[]) ?? [],
      tourId: result.tour_id as string | undefined,
      fields: [suggestion.field],
    }
  }

  async acceptBatch(batchId: string, rows: TourSuggestion[]): Promise<ResolveResult> {
    // Copy every staged blob into the owner's prefix FIRST, then hand the map to the RPC,
    // which applies the whole review in one transaction (D10).
    const paths: Record<string, string> = {}
    for (const row of rows) {
      const ownPath = await this.copyStagedToOwner(row)
      if (ownPath)
        paths[row.id] = ownPath
    }

    const { data, error } = await supabase.rpc('accept_tour_suggestion_batch', {
      p_batch_id: batchId,
      p_storage_paths: paths,
    })

    if (error)
      throw new Error(error.message)

    const result = (data ?? {}) as Record<string, unknown>
    const removed = (result.removed_storage_paths as string[] | null) ?? []
    for (const path of removed)
      await supabase.storage.from('tour-attachments').remove([path]).catch(() => {})

    return {
      resolvedBatches: (result.resolved_batches as string[]) ?? [],
      tourId: result.tour_id as string | undefined,
      fields: (result.fields as string[]) ?? [],
    }
  }

  async decline(id: string): Promise<ResolveResult> {
    const { data, error } = await supabase.rpc('decline_tour_suggestion', { p_id: id })

    if (error)
      throw new Error(error.message)

    return {
      resolvedBatches: ((data ?? {}) as { resolved_batches?: string[] }).resolved_batches ?? [],
      fields: [],
    }
  }

  async withdraw(id: string): Promise<void> {
    const { error } = await supabase.rpc('withdraw_tour_suggestion', { p_id: id })

    if (error)
      throw new Error(error.message)
  }

  async uploadStaged(
    bucket: StagedBucket,
    tourId: string,
    userId: string,
    file: File,
  ): Promise<string> {
    const path = stagedPath(userId, tourId, extOf(file.name) || (bucket === 'tour-gpx' ? '.gpx' : ''))
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type || 'application/octet-stream' })

    if (error)
      throw new Error(error.message)

    return path
  }

  async sweepStaged(paths: { bucket: StagedBucket, path: string }[]): Promise<void> {
    const byBucket = new Map<StagedBucket, string[]>()
    for (const { bucket, path } of paths)
      byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path])

    for (const [bucket, list] of byBucket)
      await supabase.storage.from(bucket).remove(list).catch(() => {})
  }

  /**
   * Server-side copy of a staged blob into the OWNER's own prefix (D9), so the accepted
   * row never points at the suggester's prefix — where the owner's read grant expires
   * with the suggestion. Needs read on the source (the pending-scoped SELECT policy) and
   * insert on the destination (the owner's existing policy).
   *
   * Known ceiling: a crash between the copy and the RPC orphans one object in the owner's
   * prefix and leaves the suggestion pending; a retry re-copies. Same exposure as the
   * existing upload-then-write window in the attachment picker.
   */
  private async copyStagedToOwner(row: TourSuggestion): Promise<string | null> {
    const bucket = bucketForField(row.field)
    const staged = storagePathOf(row)
    if (!bucket || !staged)
      return null

    const ownPath
      = bucket === 'tour-gpx'
        ? gpxStorageKey(row.ownerId, row.tourId)
        : `${row.ownerId}/${row.tourId}/${uuidv4()}${extOf(staged)}`

    const { error } = await supabase.storage.from(bucket).copy(staged, ownPath)
    if (error)
      throw new Error(error.message)

    return ownPath
  }

  /** The tour's previous GPX object after a replace, or the removed attachment's bytes. */
  private async sweepOwnerLeftovers(paths: (string | null)[], field: string): Promise<void> {
    const bucket = field === 'gpx' ? 'tour-gpx' : 'tour-attachments'
    for (const path of paths) {
      if (path)
        await supabase.storage.from(bucket).remove([path]).catch(() => {})
    }
  }
}
