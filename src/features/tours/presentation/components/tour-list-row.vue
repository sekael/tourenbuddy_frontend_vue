<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { resolveContactName } from '@/features/contacts/domain/entities/contact'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useFriendDisplayName } from '@/features/friendships/presentation/composables/use-friend-display-name'
import { TOUR_TYPE_COLORS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'
import { useTourSuggestionsStore } from '@/features/tours/presentation/stores/tour-suggestions-store'

const props = defineProps<{ tour: Tour }>()
const emit = defineEmits<{ click: [] }>()

const { t } = useI18n({ useScope: 'global' })
const contactsStore = useContactsStore()
const suggestionsStore = useTourSuggestionsStore()

// Fed by the one feature-wide query (design D15) — no per-row fetch. Offline it reads the
// cached snapshot (D14): a stale-but-truthful count beats a silent zero, which would read
// as "nobody suggested anything".
const pendingSuggestions = computed(() =>
  props.tour.isFriendTour ? 0 : (suggestionsStore.pendingCountByTour[props.tour.id] ?? 0),
)

const displayName = computed(() => props.tour.name ?? t('tours.infoSheet.unnamedTour'))

// The activity type IS the row's identity at a glance — same icon+color language the
// map markers and calendar already speak. A typeless tour keeps the neutral primary tint
// via the CSS default, so the null case needs no template branch.
const avatarIcon = computed(() => (props.tour.tourType ? TOUR_TYPE_ICONS[props.tour.tourType] : 'tour'))
const avatarTint = computed(() =>
  props.tour.tourType ? { '--avatar-tint': TOUR_TYPE_COLORS[props.tour.tourType] } : undefined,
)

// Friend tours: the owner is named by the viewer's OWN contact for them, gated so the
// name renders once in final form (never "a friend" swapped for "Mum").
const { displayName: ownerName, isResolved: ownerResolved } = useFriendDisplayName(
  () => (props.tour.isFriendTour ? props.tour.userId : null),
)
const ownerLabel = computed(() =>
  ownerName.value === null ? null : t('tours.list.ownedByLabel', { name: ownerName.value }),
)

// Friend-tour rows show only the goal name + owner ("by X"); partners stay
// hidden in the list (privacy + clutter). Own tours still list their partners.
const partnerSubtitle = computed(() => {
  if (props.tour.isFriendTour)
    return null
  const names = props.tour.partnerIds.map((id) => {
    const contact = contactsStore.contacts.find(c => c.id === id)
    return contact ? resolveContactName(contact) : null
  })
  const joined = names.filter(Boolean).join(', ')
  return joined || null
})
</script>

<template>
  <li class="tour-row" @click="emit('click')">
    <div class="tour-avatar" :style="avatarTint">
      <BaseIcon :name="avatarIcon" />
      <BaseIcon v-if="tour.isFriendTour" name="group" class="friend-badge" />
    </div>
    <div class="tour-info">
      <span class="tour-name">{{ displayName }}</span>
      <span v-if="tour.isFriendTour && ownerResolved" class="tour-owner">{{ ownerLabel }}</span>
      <span v-else-if="tour.isFriendTour" class="tour-owner-skeleton" aria-hidden="true" />
      <span v-if="partnerSubtitle" class="tour-subtitle">{{ partnerSubtitle }}</span>
    </div>
    <span
      v-if="pendingSuggestions > 0" class="suggestion-badge"
      :title="t('tours.suggestions.pendingCount', { count: pendingSuggestions })"
    >
      <BaseIcon name="feedback" />
      {{ pendingSuggestions }}
    </span>
    <BaseIcon name="chevron_right" class="row-arrow" />
  </li>
</template>

<style scoped>
.tour-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.15s;
}

.tour-row:hover {
  background-color: var(--color-surface-variant);
}

.tour-avatar {
  --avatar-tint: var(--color-primary);

  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: color-mix(in srgb, var(--avatar-tint) 16%, transparent);
  color: var(--avatar-tint);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.friend-badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  font-size: 14px;
  padding: 2px;
  border-radius: 50%;
  background-color: var(--color-surface);
  color: var(--color-on-surface-variant);
}

.tour-owner {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Occupies the exact line box of the owner label so the swap causes no reflow, and
   derives its fill from the slot's own color so it blends on both themes. */
.tour-owner-skeleton {
  font-size: var(--font-size-sm);
  min-height: 1em;
  width: 7ch;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, currentcolor 10%, transparent);
  animation: owner-skeleton-pulse 1.6s ease-in-out infinite;
}

@keyframes owner-skeleton-pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tour-owner-skeleton {
    animation: none;
  }
}

.tour-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tour-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tour-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  color: var(--color-primary);
}

.row-arrow {
  color: var(--color-outline-variant);
  flex-shrink: 0;
}
</style>
