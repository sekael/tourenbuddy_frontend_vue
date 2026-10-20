<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { TOUR_TYPE_I18N_KEYS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'

/**
 * A tour's facts as dense icon-led rows, no headings or cards (spec: design-system →
 * "Tour detail reads at a glance"), grouped by what belongs together: activity, route,
 * partners, free texts — a divider above each group. Start and End carry a short visible
 * label — their icons alone are ambiguous; every other row is named for assistive tech only.
 * Partners and the route's GPX download come in through slots so the sheet keeps the wiring.
 */
const props = defineProps<{ tour: Tour }>()

const { t } = useI18n({ useScope: 'global' })

const SEASON_ICONS: Record<Season, string> = {
  winter: 'ac_unit',
  spring: 'local_florist',
  summer: 'wb_sunny',
  autumn: 'eco',
}

const pointText = (p: { lng: number, lat: number } | null) => (p ? `${p.lat.toFixed(4)}°N, ${p.lng.toFixed(4)}°E` : null)
const startPointText = computed(() => pointText(props.tour.startPoint))
const endPointText = computed(() => pointText(props.tour.endPoint))
const isOneWayToGoal = computed(() => !!props.tour.startPoint && !props.tour.endPoint)
const isRoundTrip = computed(() => {
  const { startPoint: s, endPoint: e } = props.tour
  return !!s && !!e && s.lng === e.lng && s.lat === e.lat
})

const endValue = computed(() => {
  if (isOneWayToGoal.value)
    return t('tours.infoSheet.oneWayToGoalIndicator')
  if (isRoundTrip.value)
    return t('tours.infoSheet.roundTrip')
  return props.tour.endPointName ?? endPointText.value
})
const endElevation = computed(() =>
  isOneWayToGoal.value || isRoundTrip.value || !props.tour.endPointName ? null : props.tour.endPointElevation,
)

/** Auto-link URLs in plain text: returns array of segments {text, url?}. */
function linkifyText(text: string): Array<{ text: string, url?: string }> {
  const urlPattern = /https?:\/\/[^\s<>[\]{}|\\^`"]+/g
  const segments: Array<{ text: string, url?: string }> = []
  let lastIndex = 0
  for (let match = urlPattern.exec(text); match !== null; match = urlPattern.exec(text)) {
    if (match.index > lastIndex)
      segments.push({ text: text.slice(lastIndex, match.index) })
    segments.push({ text: match[0], url: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length)
    segments.push({ text: text.slice(lastIndex) })
  return segments.length > 0 ? segments : [{ text }]
}
</script>

<template>
  <div class="fact-rows">
    <ul v-if="tour.tourType || tour.seasons?.length" class="fact-group">
      <li v-if="tour.tourType" class="fact-row" data-fact="type">
        <BaseIcon :name="TOUR_TYPE_ICONS[tour.tourType]" size="sm" class="row-icon" />
        <span class="visually-hidden">{{ t('tours.infoSheet.iconTooltipType') }}</span>
        <span class="row-value">{{ t(`tours.type.${TOUR_TYPE_I18N_KEYS[tour.tourType]}` as any) }}</span>
      </li>

      <!-- Each season chip carries its own icon, so the chips take the icon column too. -->
      <li v-if="tour.seasons?.length" class="fact-row fact-row--wide" data-fact="seasons">
        <span class="visually-hidden">{{ t('tours.infoSheet.iconTooltipSeasons') }}</span>
        <span v-for="season in tour.seasons" :key="season" class="season-tag">
          <BaseIcon :name="SEASON_ICONS[season]" size="sm" />
          {{ t(`tours.season.${season}` as any) }}
        </span>
      </li>
    </ul>

    <ul v-if="startPointText || $slots.route" class="fact-group">
      <template v-if="startPointText">
        <li class="fact-row" data-fact="start">
          <BaseIcon name="home" size="sm" class="row-icon" />
          <span class="row-value">
            <span class="row-label">{{ t('tours.infoSheet.startShort') }}</span>
            <span :class="{ coords: !tour.startPointName }">{{ tour.startPointName ?? startPointText }}</span>
            <span v-if="tour.startPointName && tour.startPointElevation != null" class="row-sub">{{ tour.startPointElevation }}m</span>
          </span>
        </li>
        <li class="fact-row" data-fact="end">
          <BaseIcon :name="isOneWayToGoal ? 'directions' : 'flag'" size="sm" class="row-icon" />
          <span class="row-value">
            <span class="row-label">{{ t('tours.infoSheet.endShort') }}</span>
            <span :class="{ coords: endValue === endPointText }">{{ endValue }}</span>
            <span v-if="endElevation != null" class="row-sub">{{ endElevation }}m</span>
          </span>
        </li>
      </template>
      <!-- The route's own file (GPX); the sheet owns the download. -->
      <li v-if="$slots.route" data-fact="track">
        <slot name="route" />
      </li>
    </ul>

    <ul v-if="$slots.partners" class="fact-group">
      <li class="fact-row" data-fact="partners">
        <BaseIcon name="group" size="sm" class="row-icon" />
        <span class="visually-hidden">{{ t('tours.infoSheet.iconTooltipPartners') }}</span>
        <div class="row-value">
          <slot name="partners" />
        </div>
      </li>
    </ul>

    <ul v-if="tour.description || tour.equipment || tour.notes" class="fact-group">
      <li v-if="tour.description" class="fact-row" data-fact="description">
        <BaseIcon name="description" size="sm" class="row-icon" />
        <span class="visually-hidden">{{ t('tours.infoSheet.iconTooltipDescription') }}</span>
        <p class="row-value body-text">
          <template v-for="(segment, i) in linkifyText(tour.description)" :key="i">
            <a
              v-if="segment.url" :href="segment.url" target="_blank" rel="noopener noreferrer"
              class="description-link"
            >{{ segment.text }}</a>
            <template v-else>
              {{ segment.text }}
            </template>
          </template>
        </p>
      </li>

      <li v-if="tour.equipment" class="fact-row" data-fact="equipment">
        <BaseIcon name="backpack" size="sm" class="row-icon" />
        <span class="visually-hidden">{{ t('tours.infoSheet.iconTooltipEquipment') }}</span>
        <p class="row-value body-text">
          {{ tour.equipment }}
        </p>
      </li>

      <li v-if="tour.notes" class="fact-row" data-fact="notes">
        <BaseIcon name="sticky_note_2" size="sm" class="row-icon" />
        <span class="visually-hidden">{{ t('tours.infoSheet.iconTooltipNotes') }}</span>
        <p class="row-value body-text">
          {{ tour.notes }}
        </p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* The groups sit in the sheet's column (its gap spaces them); a divider leads each one,
   since they always follow the hero. */
.fact-rows {
  display: contents;
}

.fact-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin: 0;
  padding: var(--spacing-md) 0 0;
  border-top: 1px solid var(--divider-color);
  list-style: none;
}

/* Icon column + value; the icon sits on the first text line. */
.fact-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: start;
  column-gap: var(--spacing-sm);
}

.fact-row--wide {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.row-icon {
  margin-top: 2px;
  color: var(--type-tint);
}

.row-value {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: var(--spacing-xs);
  margin: 0;
  min-width: 0;
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
  color: var(--color-on-surface);
}

.row-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
}

.row-sub {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.coords {
  font-variant-numeric: tabular-nums;
}

/* Free text keeps its own line breaks; the row's flex would collapse them. */
.body-text {
  display: block;
  white-space: pre-wrap;
  /* Break long words at syllables with a hyphen (in the page language), and mid-word
     only when no hyphenation point exists — never "Schreckhornhütt|e". */
  overflow-wrap: break-word;
  -webkit-hyphens: auto;
  hyphens: auto;
}

.season-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  padding: 2px var(--spacing-sm);
  border-radius: var(--chip-radius);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background-color: color-mix(in srgb, var(--type-tint) 10%, var(--color-background));
  color: var(--color-on-surface);
}

.season-tag .base-icon {
  color: var(--type-tint);
}

.description-link {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
