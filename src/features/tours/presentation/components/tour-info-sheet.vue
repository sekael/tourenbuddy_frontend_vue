<script setup lang="ts">
import type { Tour } from '@/features/tours/domain/entities/tour'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import SideDrawer from '@/core/components/side-drawer.vue'
import { useIsDesktop } from '@/core/composables/use-is-desktop'
import ContactChip from '@/features/contacts/presentation/components/contact-chip.vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { SEASON_LABELS } from '@/features/tours/data/models/season'
import { TOUR_TYPE_ICONS, TOUR_TYPE_LABELS } from '@/features/tours/data/models/tour-type'

const props = defineProps<{ tour: Tour }>()
const emit = defineEmits<{ close: [] }>()

const contactsStore = useContactsStore()
const { contacts } = storeToRefs(contactsStore)
const isDesktop = useIsDesktop()

const displayName = computed(() => props.tour.name ?? 'Unnamed tour')

const formattedDate = computed(() => {
  if (!props.tour.plannedDate)
    return null
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(props.tour.plannedDate)
})

const partners = computed(() => contacts.value.filter(c => props.tour.partnerIds.includes(c.id)))

const coordinates = computed(
  () => `${props.tour.goal.lat.toFixed(4)}°N, ${props.tour.goal.lng.toFixed(4)}°E`,
)

const formattedElevation = computed(() => {
  if (props.tour.elevation == null)
    return null
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(props.tour.elevation)} m`
})

const startPointText = computed(() => {
  if (!props.tour.startPoint)
    return null
  return `${props.tour.startPoint.lat.toFixed(4)}°N, ${props.tour.startPoint.lng.toFixed(4)}°E`
})

const endPointText = computed(() => {
  if (!props.tour.endPoint)
    return null
  return `${props.tour.endPoint.lat.toFixed(4)}°N, ${props.tour.endPoint.lng.toFixed(4)}°E`
})

const isRoundTrip = computed(() => props.tour.startPoint != null && props.tour.endPoint == null)

/** Auto-link URLs in plain text: returns array of segments {text, url?}. */
function linkifyText(text: string): Array<{ text: string, url?: string }> {
  const urlPattern = /https?:\/\/[^\s<>[\]{}|\\^`"]+/g
  const segments: Array<{ text: string, url?: string }> = []
  let lastIndex = 0
  for (let match = urlPattern.exec(text); match !== null; match = urlPattern.exec(text)) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) })
    }
    segments.push({ text: match[0], url: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ text }]
}
</script>

<template>
  <component :is="isDesktop ? SideDrawer : BottomSheet" :title="displayName" @close="emit('close')">
    <div class="details">
      <!-- Tour type -->
      <div v-if="tour.tourType" class="detail-row">
        <span class="detail-icon material-symbols-outlined">{{
          TOUR_TYPE_ICONS[tour.tourType]
        }}</span>
        <span>{{ TOUR_TYPE_LABELS[tour.tourType] }}</span>
      </div>

      <!-- Planned date -->
      <div v-if="formattedDate" class="detail-row">
        <span class="detail-icon material-symbols-outlined">calendar_today</span>
        <span>{{ formattedDate }}</span>
      </div>

      <!-- Goal coordinates -->
      <div class="detail-row">
        <span class="detail-icon material-symbols-outlined">location_on</span>
        <span class="coords">{{ coordinates }}</span>
      </div>

      <!-- Elevation -->
      <div v-if="formattedElevation" class="detail-row">
        <span class="detail-icon material-symbols-outlined">landscape</span>
        <span>{{ formattedElevation }}</span>
      </div>

      <!-- Start / end points -->
      <template v-if="startPointText">
        <div class="detail-row">
          <span class="detail-icon material-symbols-outlined">trip_origin</span>
          <span class="coords">{{ startPointText }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-icon material-symbols-outlined">flag</span>
          <span v-if="isRoundTrip" class="round-trip-hint">Round trip</span>
          <span v-else class="coords">{{ endPointText }}</span>
        </div>
      </template>

      <!-- Seasons -->
      <div v-if="tour.seasons && tour.seasons.length > 0" class="detail-row align-start">
        <span class="detail-icon material-symbols-outlined">wb_sunny</span>
        <div class="season-tags">
          <span v-for="season in tour.seasons" :key="season" class="season-tag">
            {{ SEASON_LABELS[season] }}
          </span>
        </div>
      </div>

      <!-- Description -->
      <div v-if="tour.description" class="detail-row align-start">
        <span class="detail-icon material-symbols-outlined">description</span>
        <p class="description-text">
          <template v-for="(segment, i) in linkifyText(tour.description)" :key="i">
            <a
              v-if="segment.url"
              :href="segment.url"
              target="_blank"
              rel="noopener noreferrer"
              class="description-link"
            >{{ segment.text }}</a>
            <template v-else>
              {{ segment.text }}
            </template>
          </template>
        </p>
      </div>

      <!-- Equipment -->
      <div v-if="tour.equipment" class="detail-row align-start">
        <span class="detail-icon material-symbols-outlined">backpack</span>
        <p class="detail-text">
          {{ tour.equipment }}
        </p>
      </div>

      <!-- Notes -->
      <div v-if="tour.notes" class="detail-row align-start">
        <span class="detail-icon material-symbols-outlined">sticky_note_2</span>
        <p class="detail-text">
          {{ tour.notes }}
        </p>
      </div>

      <!-- GPX track indicator -->
      <div v-if="tour.gpxTrack" class="detail-row">
        <span class="detail-icon material-symbols-outlined">route</span>
        <span class="gpx-label">Track available</span>
      </div>

      <!-- Partners -->
      <div v-if="partners.length > 0" class="detail-row align-start">
        <span class="detail-icon material-symbols-outlined">group</span>
        <div class="partner-chips">
          <ContactChip
            v-for="partner in partners"
            :key="partner.id"
            :contact="partner"
            :selected="false"
            :show-actions="true"
            @toggle="() => {}"
          />
        </div>
      </div>
    </div>
  </component>
</template>

<style scoped>
.details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-base);
}

.detail-row.align-start {
  align-items: flex-start;
}

.detail-icon {
  flex-shrink: 0;
  font-size: 20px;
  color: var(--color-outline);
}

.coords {
  font-family: monospace;
  font-size: var(--font-size-sm);
}

.round-trip-hint {
  font-size: var(--font-size-sm);
  font-style: italic;
  color: var(--color-outline);
}

/* Season tags */
.season-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.season-tag {
  padding: 2px var(--spacing-sm);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

/* Description */
.description-text {
  font-size: var(--font-size-base);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.description-link {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Equipment / notes */
.detail-text {
  font-size: var(--font-size-base);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* GPX track */
.gpx-label {
  font-size: var(--font-size-sm);
  color: var(--color-primary);
  font-weight: var(--font-weight-medium);
}

/* Partners */
.partner-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}
</style>
