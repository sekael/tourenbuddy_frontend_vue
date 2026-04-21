import type enMessages from '@/locales/en.json'

export type MessageSchema = typeof enMessages

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
}
