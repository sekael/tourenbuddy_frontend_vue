<script setup lang="ts">
import type { Season } from '@/features/tours/data/models/season'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseIcon from '@/core/components/base-icon.vue'
import { useFormatter } from '@/core/composables/use-formatter'
import { TOUR_TYPE_COLORS, TOUR_TYPE_I18N_KEYS, TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'
import { isSameGoal } from '@/features/tours/domain/distance'
import { landsByAir, legsApart } from '@/features/tours/domain/legs'
import GradeBadge from '@/features/tours/presentation/components/grade-badge.vue'

/**
 * A tour's facts as dense icon-led rows, no headings or cards (spec: design-system →
 * "Tour detail reads at a glance"), grouped by what belongs together: activity, route,
 * partners, free texts — a divider above each group. The route numbers (design D19) sit in the
 * sheet's hero, beside the date. Start and End carry a short visible
 * label — their icons alone are ambiguous; every other row is named for assistive tech only.
 * Partners and the route's GPX download come in through slots so the sheet keeps the wiring.
 */
const props = defineProps<{ tour: Tour }>()

const { t } = useI18n({ useScope: 'global' })
const { formatElevation } = useFormatter()

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
/** Same place as the map's markers and connector take it (within 10 m), not the same digits. */
const isRoundTrip = computed(() => {
  const { startPoint: s, endPoint: e } = props.tour
  return !!s && !!e && isSameGoal(s, e)
})

/** Activities as groups: one for an unsplit tour, the way up and the way down for a split one. */
const typeGroups = computed(() => {
  const legs = legsApart(props.tour.legs)
  return legs
    ? [{ way: 'up' as const, types: legs.ascent }, { way: 'down' as const, types: legs.descent }]
    : [{ way: null, types: props.tour.tourTypes }]
})
/** A flown way down ends in a landing. */
const landing = computed(() => landsByAir(props.tour))

const endValue = computed(() => {
  if (isOneWayToGoal.value)
    return landing.value ? t('tours.infoSheet.landingOpen') : t('tours.infoSheet.oneWayToGoalIndicator')
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
    <ul v-if="tour.tourTypes.length || tour.grade || tour.seasons?.length" class="fact-group">
      <!-- Chips carry their own icons, so they take the icon column too. Activities wear
           their own colour, seasons stay neutral. -->
      <li v-if="tour.tourTypes.length || tour.grade" class="fact-row fact-row--wide" data-fact="type">
        <span class="visually-hidden">{{ t('tours.infoSheet.iconTooltipType') }}</span>
        <!-- A split tour: the way up, then the way down, each led by its arrow. -->
        <span v-for="group in typeGroups" :key="group.way ?? 'all'" class="type-group" :data-leg="group.way">
          <template v-if="group.way">
            <BaseIcon :name="group.way === 'up' ? 'arrow_upward' : 'arrow_downward'" size="sm" class="leg-arrow" />
            <span class="visually-hidden">{{ t(group.way === 'up' ? 'tours.infoSheet.wayUp' : 'tours.infoSheet.wayDown') }}</span>
          </template>
          <span
            v-for="type in group.types" :key="type" class="tag type-tag"
            :style="{ '--tag-color': TOUR_TYPE_COLORS[type] }"
          >
            <BaseIcon :name="TOUR_TYPE_ICONS[type]" size="sm" />
            {{ t(`tours.type.${TOUR_TYPE_I18N_KEYS[type]}` as any) }}
          </span>
        </span>
        <GradeBadge v-if="tour.grade" :grade="tour.grade" />
      </li>

      <li v-if="tour.seasons?.length" class="fact-row fact-row--wide" data-fact="seasons">
        <span class="visually-hidden">{{ t('tours.infoSheet.iconTooltipSeasons') }}</span>
        <span v-for="season in tour.seasons" :key="season" class="tag season-tag">
          <BaseIcon :name="SEASON_ICONS[season]" size="sm" />
          {{ t(`tours.season.${season}` as any) }}
        </span>
      </li>
    </ul>

    <ul v-if="startPointText || endPointText || $slots.route" class="fact-group">
      <!-- An end without a start (a connected stage) shows on its own. -->
      <template v-if="startPointText || endPointText">
        <li v-if="startPointText" class="fact-row" data-fact="start">
          <!-- The form's point icons (D22): ring = start, flag = goal, chequered flag = end. -->
          <BaseIcon name="trip_origin" size="sm" class="row-icon" />
          <span class="row-value">
            <span class="row-label">{{ t('tours.infoSheet.startShort') }}</span>
            <span :class="{ coords: !tour.startPointName }">{{ tour.startPointName ?? startPointText }}</span>
            <span v-if="tour.startPointName && tour.startPointElevation != null" class="row-sub">{{ formatElevation(tour.startPointElevation) }}</span>
          </span>
        </li>
        <li class="fact-row" data-fact="end">
          <BaseIcon :name="isOneWayToGoal ? 'flag' : 'sports_score'" size="sm" class="row-icon" />
          <span class="row-value">
            <span class="row-label">{{ landing ? t('tours.infoSheet.landingShort') : t('tours.infoSheet.endShort') }}</span>
            <span :class="{ coords: endValue === endPointText }">{{ endValue }}</span>
            <span v-if="endElevation != null" class="row-sub">{{ formatElevation(endElevation) }}</span>
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
        <BaseIcon name="ice_axe" size="sm" class="row-icon" />
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
  color: var(--color-on-surface-variant);
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

.tag {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  padding: 2px var(--spacing-sm);
  border-radius: var(--chip-radius);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.type-group {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-xs);
}

.leg-arrow {
  color: var(--color-on-surface-variant);
}

.type-tag {
  background-color: color-mix(in srgb, var(--tag-color) 12%, var(--color-background));
  /* Darkened for the label: amber at full strength is under 4.5:1 on its own tint. */
  color: color-mix(in srgb, var(--tag-color) 75%, black);
}

.type-tag .base-icon {
  color: var(--tag-color);
}

.season-tag {
  background-color: var(--color-neutral-container);
  color: var(--color-on-surface);
}

.season-tag .base-icon {
  color: var(--color-on-surface-variant);
}

.description-link {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
