<script setup lang="ts">
import type { TourLinkRequest } from '@/features/tour-links/domain/entities/tour-link'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { useLogger } from '@/core/logging/use-logger'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { resolveFriendName } from '@/features/friendships/domain/resolve-friend-name'
import { useFriendshipsStore } from '@/features/friendships/presentation/stores/friendships-store'
import { useTourLinksStore } from '@/features/tour-links/presentation/stores/tour-links-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'

const props = defineProps<{
  request: TourLinkRequest
}>()

const { t } = useI18n({ useScope: 'global' })
const logger = useLogger('link-request-banner')
const tourLinksStore = useTourLinksStore()
const toursStore = useToursStore()
const authStore = useAuthStore()
const friendshipsStore = useFriendshipsStore()
const contactsStore = useContactsStore()
const { tours, friendTours } = storeToRefs(toursStore)
const { currentUser } = storeToRefs(authStore)
const { userIdToPhoneMap } = storeToRefs(friendshipsStore)

// Defensive: friend-tours has no realtime sub yet (#198). If a link request
// realtime arrives before the initial friend-tours fetch resolves, the banner
// can't resolve the counterpart's name or tour. Refresh on mount.
toursStore.loadFriendTours()

const submitting = ref(false)
const submitError = ref<string | null>(null)

/** Incoming = target tour is mine. Outgoing = initiator tour is mine. */
const isIncoming = computed(() => {
  const me = currentUser.value?.id
  if (!me)
    return false
  const target = tours.value.find(t => t.id === props.request.targetTourId)
  return target?.userId === me
})

const otherTourName = computed(() => {
  const otherId = isIncoming.value ? props.request.initiatorTourId : props.request.targetTourId
  const t1 = friendTours.value.find(t => t.id === otherId)
  return t1?.name ?? t('tours.infoSheet.unnamedTour')
})

// The counterpart is a confirmed friend, so name them by the viewer's own contact.
// `partnerNames` on a friend tour holds the tour's PARTNERS, never the owner.
const otherFriendName = computed(() => {
  const otherId = isIncoming.value ? props.request.initiatorTourId : props.request.targetTourId
  const t1 = friendTours.value.find(t => t.id === otherId)
  if (!t1)
    return ''
  return resolveFriendName(t1.userId, userIdToPhoneMap.value, phone =>
    contactsStore.findContactByMethodValue('phone', phone)) ?? ''
})

// Ensure the counterpart's phone (hence contact) is resolvable.
watch(
  () => {
    const otherId = isIncoming.value ? props.request.initiatorTourId : props.request.targetTourId
    return friendTours.value.find(t => t.id === otherId)?.userId
  },
  (uid) => {
    if (uid)
      void friendshipsStore.ensurePhones([uid])
  },
  { immediate: true },
)

async function accept() {
  submitting.value = true
  submitError.value = null
  try {
    await tourLinksStore.acceptRequest(props.request.id)
  }
  catch (err) {
    logger.error('acceptRequest failed', err)
    submitError.value = err instanceof Error ? err.message : 'failed'
  }
  finally {
    submitting.value = false
  }
}

async function decline() {
  submitting.value = true
  submitError.value = null
  try {
    await tourLinksStore.declineRequest(props.request.id)
  }
  catch (err) {
    logger.error('declineRequest failed', err)
    submitError.value = err instanceof Error ? err.message : 'failed'
  }
  finally {
    submitting.value = false
  }
}

async function withdraw() {
  submitting.value = true
  submitError.value = null
  try {
    await tourLinksStore.withdrawRequest(props.request.id)
  }
  catch (err) {
    logger.error('withdrawRequest failed', err)
    submitError.value = err instanceof Error ? err.message : 'failed'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="link-request-banner" :class="{ 'link-request-banner--incoming': isIncoming }">
    <div class="message">
      <BaseIcon name="link" class="icon" />
      <span v-if="isIncoming">
        {{ t('tourLinks.bannerIncoming', { name: otherFriendName, tour: otherTourName }) }}
      </span>
      <span v-else>
        {{ t('tourLinks.bannerOutgoing', { name: otherFriendName, tour: otherTourName }) }}
      </span>
    </div>
    <div class="actions">
      <template v-if="isIncoming">
        <BaseButton type="button" variant="primary" size="sm" :disabled="submitting" @click="accept">
          {{ t('tourLinks.acceptBtn') }}
        </BaseButton>
        <BaseButton type="button" variant="secondary" size="sm" :disabled="submitting" @click="decline">
          {{ t('tourLinks.declineBtn') }}
        </BaseButton>
      </template>
      <template v-else>
        <BaseButton type="button" variant="secondary" size="sm" :disabled="submitting" @click="withdraw">
          {{ t('tourLinks.withdrawBtn') }}
        </BaseButton>
      </template>
    </div>
    <p v-if="submitError" class="error">
      {{ submitError }}
    </p>
  </section>
</template>

<style scoped>
.link-request-banner {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.link-request-banner--incoming {
  border-left: 3px solid var(--color-primary);
  background: var(--color-surface-variant);
}

.message {
  display: flex;
  gap: var(--spacing-xs);
  align-items: flex-start;
  font-size: var(--font-size-sm);
}

.icon {
  font-size: 18px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.actions {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

/* Accept/decline/withdraw use shared BaseButton. */

.error {
  color: var(--color-error);
  font-size: var(--font-size-xs);
  margin: 0;
}
</style>
