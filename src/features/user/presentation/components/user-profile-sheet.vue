<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import BottomSheet from '@/core/components/bottom-sheet.vue'
import { useAuthStore } from '@/features/auth/presentation/stores/auth-store'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import { useUserProfileStore } from '@/features/user/presentation/stores/user-profile-store'

const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const authStore = useAuthStore()
const userProfileStore = useUserProfileStore()
const contactsStore = useContactsStore()
const toursStore = useToursStore()

const displayName = computed(() => {
  const p = userProfileStore.profile
  if (!p) return authStore.currentUser?.email ?? 'User'
  if (p.firstName && p.lastName) return `${p.firstName} ${p.lastName}`
  if (p.firstName) return p.firstName
  return authStore.currentUser?.email ?? 'User'
})

const email = computed(() => authStore.currentUser?.email ?? '')

async function handleSignOut() {
  contactsStore.clear()
  toursStore.clear()
  userProfileStore.clear()
  await authStore.signOut()
  emit('close')
  router.push({ name: 'home' })
}
</script>

<template>
  <BottomSheet title="Profile" @close="emit('close')">
    <div class="profile-content">
      <div class="profile-info">
        <div class="avatar">
          {{ displayName.charAt(0).toUpperCase() }}
        </div>
        <div class="info">
          <p class="name">
            {{ displayName }}
          </p>
          <p class="email">
            {{ email }}
          </p>
        </div>
      </div>

      <button class="sign-out-btn" @click="handleSignOut">
        <span class="material-symbols-outlined">logout</span>
        Sign out
      </button>
    </div>
  </BottomSheet>
</template>

<style scoped>
.profile-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.profile-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  flex-shrink: 0;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name {
  font-weight: var(--font-weight-semibold);
}

.email {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
}

.sign-out-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--color-outline-variant);
  border-radius: 12px;
  color: var(--color-error);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  transition: background-color 0.2s;
}

.sign-out-btn:hover {
  background-color: var(--color-error-container);
}
</style>
