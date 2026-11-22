<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '@/core/components/base-button.vue'
import BaseIcon from '@/core/components/base-icon.vue'
import { isOnline } from '@/core/offline/use-online-status'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import DeleteAccountDialog from '@/features/user/presentation/components/delete-account-dialog.vue'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'
import { TERMS_VERSION } from '../../domain/terms'
import { useTermsStore } from '../stores/terms-store'

// Change: add-terms-acceptance. The PWA's acceptance page, worded and behaving as the native apps'.
const { t, tm, locale } = useI18n({ useScope: 'global' })
const router = useRouter()
const terms = useTermsStore()
const { gate, offline, accepting, failed } = storeToRefs(terms)
const authStore = useAuthStore()
const profileStore = useUserProfileStore()

const canAccept = computed(() => gate.value === 'accept' || gate.value === 'changed')
const noConnection = computed(() => !isOnline.value || offline.value)
// What the terms mean for the user, one line each, in this order.
const points = [
  { key: 'plans', icon: 'share' },
  { key: 'risk', icon: 'hiking' },
  { key: 'liability', icon: 'warning' },
  { key: 'indemnity', icon: 'group' },
] as const
const whatChanged = computed(() => (tm('terms.whatChanged') as Record<string, string>)[TERMS_VERSION] ?? '')
const site = computed(() => `https://tourenbuddy.ch${locale.value.startsWith('de') ? '/de' : ''}`)

// Back online: an earlier failure is stale, and with nothing confirmed, ask the server again.
watch(isOnline, (online) => {
  if (!online)
    return
  failed.value = false
  if (offline.value)
    void terms.check()
})

const showDelete = ref(false)
const deleting = ref(false)
const deleteError = ref<string | null>(null)

// The web app updates by loading again.
function reload() {
  window.location.reload()
}

async function signOut() {
  await authStore.signOut()
  router.push({ name: 'home' })
}

async function deleteAccount() {
  if (!isOnline.value) {
    deleteError.value = t('user.profile.deleteAccount.offline')
    return
  }
  deleting.value = true
  deleteError.value = null
  const deleted = await profileStore.deleteAccount()
  deleting.value = false
  if (!deleted) {
    deleteError.value = t('user.profile.deleteAccount.failed')
    return
  }
  showDelete.value = false
  profileStore.clear()
  await signOut()
}
</script>

<template>
  <div class="page">
    <main class="card" aria-labelledby="terms-title">
      <h1 id="terms-title" class="title">
        {{ t('terms.title') }}
      </h1>

      <p v-if="gate === 'loading'" class="muted" role="status">
        …
      </p>
      <template v-else>
        <template v-if="canAccept">
          <p class="text">
            {{ gate === 'changed' ? t('terms.changedLead', { changes: whatChanged }) : t('terms.lead') }}
          </p>
          <ul class="points">
            <li v-for="point in points" :key="point.key" class="point">
              <span class="badge"><BaseIcon :name="point.icon" /></span>
              <span>{{ t(`terms.points.${point.key}`) }}</span>
            </li>
          </ul>
        </template>
        <i18n-t v-if="canAccept" keypath="terms.read" tag="p" class="text">
          <template #terms>
            <a :href="`${site}/terms`" target="_blank" rel="noopener">{{ t('terms.termsLink') }}</a>
          </template>
          <template #privacy>
            <a :href="`${site}/privacy`" target="_blank" rel="noopener">{{ t('terms.privacyLink') }}</a>
          </template>
        </i18n-t>
        <p v-else class="text">
          {{ gate === 'update' ? t('terms.update') : t('terms.unavailable') }}
        </p>

        <p v-if="canAccept && noConnection" class="muted" role="status">
          {{ t('terms.offline') }}
        </p>
        <p v-if="canAccept && failed && !noConnection" class="error" role="alert">
          {{ t('terms.failed') }}
        </p>

        <BaseButton
          v-if="canAccept"
          :disabled="accepting || noConnection || deleting"
          data-testid="terms-accept"
          @click="terms.accept()"
        >
          {{ accepting ? t('terms.accepting') : t('terms.acceptBtn') }}
        </BaseButton>
        <BaseButton v-else-if="gate === 'update'" @click="reload">
          {{ t('terms.updateBtn') }}
        </BaseButton>
        <BaseButton v-else @click="terms.check()">
          {{ t('terms.retryBtn') }}
        </BaseButton>

        <BaseButton variant="secondary" :disabled="accepting || deleting" @click="signOut">
          {{ t('terms.signOutBtn') }}
        </BaseButton>
        <BaseButton variant="text" :disabled="accepting || deleting" @click="showDelete = true">
          {{ t('terms.deleteBtn') }}
        </BaseButton>
      </template>
    </main>

    <DeleteAccountDialog
      v-if="showDelete"
      :deleting="deleting"
      :error="deleteError"
      @confirm="deleteAccount"
      @cancel="showDelete = false"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  justify-content: center;
  align-items: safe center;
  min-height: 100lvh;
  padding: calc(var(--spacing-xl) + var(--safe-top)) var(--spacing-xl) calc(var(--spacing-xl) + var(--safe-bottom));
  background-color: var(--color-background);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  width: 100%;
  max-width: 400px;
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-medium);
  letter-spacing: -0.01em;
}

.text {
  line-height: 1.5;
}

.text a {
  color: var(--color-accent);
}

.points {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin: 0;
  padding: 0;
  list-style: none;
}

.point {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  line-height: 1.4;
}

.badge {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--color-accent);
  background-color: var(--color-secondary-container);
}

.muted {
  color: var(--color-on-surface-variant);
}

.error {
  color: var(--color-error);
}
</style>
