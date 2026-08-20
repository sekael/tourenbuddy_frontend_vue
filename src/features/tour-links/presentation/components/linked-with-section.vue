<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { resolveFriendName } from '@/features/friendships/domain/resolve-friend-name'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const props = withDefaults(defineProps<{
  /** Tour ids of the group siblings (excluding the current tour). */
  siblings: string[]
  /**
   * Render the complete sibling list (no overflow pill). Parent's sheet
   * provides its own back / close chrome.
   */
  fullList?: boolean
}>(), { fullList: false })
const emit = defineEmits<{
  /** Navigate to a sibling tour. */
  openTour: [tourId: string]
  /** Switch the parent sheet into "view all linked tours" mode. */
  viewAll: []
}>()

const { t } = useI18n({ useScope: 'global' })

const toursStore = useToursStore()
const friendshipsStore = useFriendshipsStore()
const contactsStore = useContactsStore()
const { tours, friendTours } = storeToRefs(toursStore)
const { userIdToPhoneMap } = storeToRefs(friendshipsStore)

/**
 * Sibling is unresolvable when neither own tours nor friend tours hold it.
 * Tour info is then unreachable from this client — pill must be inert.
 */
function isResolvable(id: string): boolean {
  return tours.value.some(t => t.id === id) || friendTours.value.some(t => t.id === id)
}

function tourName(id: string): string {
  const t1 = tours.value.find(t => t.id === id)
  const t2 = friendTours.value.find(t => t.id === id)
  return t1?.name ?? t2?.name ?? t('tours.infoSheet.unnamedTour')
}

// Owner display name comes from friendships store (userId → profile name map).
// `partnerNames` on a friend tour holds the tour's PARTNERS, never the owner.
// A sibling can belong to a group member who is NOT a direct friend of the
// viewer (the friendship invariant on link groups is not strictly enforced
// across all pairs), in which case friendTours won't contain it. Surface
// "Unknown buddy" rather than collapsing the pill to just a tour name.
function partnerName(id: string): string {
  const t1 = tours.value.find(t => t.id === id)
  if (t1)
    return '' // own sibling — no partner label
  const t2 = friendTours.value.find(t => t.id === id)
  if (!t2)
    return t('tourLinks.unknownPartner')
  const resolved = resolveFriendName(t2.userId, userIdToPhoneMap.value, phone =>
    contactsStore.findContactByMethodValue('phone', phone))
  return resolved || t('tourLinks.unknownPartner')
}

/** Pill label: "{partnerName}: {tourName}", or just tourName for own siblings. */
function pillLabel(id: string): string {
  const name = partnerName(id)
  return name ? `${name}: ${tourName(id)}` : tourName(id)
}

/**
 * Siblings reordered so the viewer's own tours come first — both in the inline
 * pill row and the full list. Stable wrt the original order otherwise.
 */
const orderedSiblings = computed(() => {
  const own: string[] = []
  const rest: string[] = []
  for (const id of props.siblings) {
    if (tours.value.some(t => t.id === id))
      own.push(id)
    else
      rest.push(id)
  }
  return [...own, ...rest]
})

const inlineIds = computed(() => orderedSiblings.value.slice(0, 2))
const overflowIds = computed(() => orderedSiblings.value.slice(2))
const overflowCount = computed(() => overflowIds.value.length)

// One batched phone lookup for the sibling owners so pills aren't blank.
watch(
  () => props.siblings,
  (ids) => {
    const owners = [...new Set(
      ids
        .map(id => friendTours.value.find(t => t.id === id)?.userId)
        .filter((uid): uid is string => !!uid),
    )]
    if (owners.length > 0)
      void friendshipsStore.ensurePhones(owners)
  },
  { immediate: true },
)

function handlePillClick(id: string) {
  if (!isResolvable(id))
    return
  emit('openTour', id)
}
</script>

<template>
  <section v-if="props.siblings.length > 0" class="linked-with-section">
    <h4 v-if="!fullList" class="section-title">
      {{ t('tourLinks.linkedWithHeader') }}
    </h4>

    <div v-if="!fullList" class="pills-row">
      <button
        v-for="id in inlineIds"
        :key="id"
        type="button"
        class="pill"
        :class="{ 'pill--inert': !isResolvable(id) }"
        :disabled="!isResolvable(id)"
        @click="handlePillClick(id)"
      >
        {{ pillLabel(id) }}
      </button>
      <button
        v-if="overflowCount > 0"
        type="button"
        class="pill pill--more"
        @click="emit('viewAll')"
      >
        {{ t('tourLinks.moreLinked', { count: overflowCount }) }}
      </button>
    </div>

    <ul v-else class="full-list">
      <li v-for="id in orderedSiblings" :key="id">
        <button
          type="button"
          class="full-row"
          :class="{ 'full-row--inert': !isResolvable(id) }"
          :disabled="!isResolvable(id)"
          @click="handlePillClick(id)"
        >
          <span class="full-name">{{ partnerName(id) || tourName(id) }}</span>
          <span v-if="partnerName(id)" class="full-tour">{{ tourName(id) }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.linked-with-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.section-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.pills-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.pill {
  padding: var(--spacing-xxs) var(--spacing-sm);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-outline-variant);
  background: var(--color-surface-variant);
  color: var(--color-on-surface);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background 0.15s;
}

.pill:hover:not(:disabled) {
  background: var(--color-surface);
}

.pill--inert {
  cursor: default;
  opacity: 0.7;
}

.pill--more {
  font-weight: var(--font-weight-medium);
}

.full-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.full-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: var(--spacing-sm);
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  border-radius: var(--radius-sm);
}

.full-row:hover:not(:disabled) {
  background: var(--color-surface-variant);
}

.full-row--inert {
  cursor: default;
  opacity: 0.7;
}

.full-name {
  font-weight: var(--font-weight-medium);
}

.full-tour {
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
}
</style>
