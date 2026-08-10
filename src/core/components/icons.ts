import type { Component } from 'vue'
import IconAccountCircleOutline from '~icons/material-symbols/account-circle-outline'
import IconAdd from '~icons/material-symbols/add'
import IconAddLocationAltOutline from '~icons/material-symbols/add-location-alt-outline'
import IconArrowBack from '~icons/material-symbols/arrow-back'
import IconArrowForward from '~icons/material-symbols/arrow-forward'
import IconAttachFile from '~icons/material-symbols/attach-file'
import IconBadgeOutline from '~icons/material-symbols/badge-outline'
import IconBlockOutline from '~icons/material-symbols/block-outline'
import IconBrokenImageOutline from '~icons/material-symbols/broken-image-outline'
import IconCalendarTodayOutline from '~icons/material-symbols/calendar-today-outline'
import IconCallOutline from '~icons/material-symbols/call-outline'
import IconChatOutline from '~icons/material-symbols/chat-outline'
import IconCheck from '~icons/material-symbols/check'
import IconCheckCircleOutline from '~icons/material-symbols/check-circle-outline'
import IconChevronLeft from '~icons/material-symbols/chevron-left'
import IconChevronRight from '~icons/material-symbols/chevron-right'
import IconClose from '~icons/material-symbols/close'
import IconCloudOffOutline from '~icons/material-symbols/cloud-off-outline'
import IconContactsOutline from '~icons/material-symbols/contacts-outline'
import IconDeleteOutline from '~icons/material-symbols/delete-outline'
import IconDescriptionOutline from '~icons/material-symbols/description-outline'
import IconDirectionsBike from '~icons/material-symbols/directions-bike'
import IconDirectionsOutline from '~icons/material-symbols/directions-outline'
import IconDoNotDisturbOnOutline from '~icons/material-symbols/do-not-disturb-on-outline'
import IconDownhillSkiing from '~icons/material-symbols/downhill-skiing'
import IconDownload from '~icons/material-symbols/download'
import IconDownloadForOfflineOutline from '~icons/material-symbols/download-for-offline-outline'
import IconDragIndicator from '~icons/material-symbols/drag-indicator'
import IconEditOutline from '~icons/material-symbols/edit-outline'
import IconExpandLess from '~icons/material-symbols/expand-less'
import IconExploreOutline from '~icons/material-symbols/explore-outline'
import IconFeedbackOutline from '~icons/material-symbols/feedback-outline'
import IconFilterHdr from '~icons/material-symbols/filter-hdr'
import IconFlagOutline from '~icons/material-symbols/flag-outline'
import IconGroupOutline from '~icons/material-symbols/group-outline'
import IconHardwareOutline from '~icons/material-symbols/hardware-outline'
import IconHelpOutline from '~icons/material-symbols/help-outline'
import IconHiking from '~icons/material-symbols/hiking'
import IconHomeOutline from '~icons/material-symbols/home-outline'
import IconImageOutline from '~icons/material-symbols/image-outline'
import IconInfoOutline from '~icons/material-symbols/info-outline'
import IconLandscapeOutline from '~icons/material-symbols/landscape-outline'
import IconLink from '~icons/material-symbols/link'
import IconLocationOnOutline from '~icons/material-symbols/location-on-outline'
import IconLockOutline from '~icons/material-symbols/lock-outline'
import IconLogout from '~icons/material-symbols/logout'
import IconMailOutline from '~icons/material-symbols/mail-outline'
import IconMapOutline from '~icons/material-symbols/map-outline'
import IconMenu from '~icons/material-symbols/menu'
import IconMyLocationOutline from '~icons/material-symbols/my-location-outline'
import IconNordicWalking from '~icons/material-symbols/nordic-walking'
import IconParaglidingOutline from '~icons/material-symbols/paragliding-outline'
import IconPersonAddOutline from '~icons/material-symbols/person-add-outline'
import IconPersonOutline from '~icons/material-symbols/person-outline'
import IconPersonRemoveOutline from '~icons/material-symbols/person-remove-outline'
import IconPhoneEnabledOutline from '~icons/material-symbols/phone-enabled-outline'
import IconPictureAsPdfOutline from '~icons/material-symbols/picture-as-pdf-outline'
import IconPrivacyTipOutline from '~icons/material-symbols/privacy-tip-outline'
import IconRadioButtonUnchecked from '~icons/material-symbols/radio-button-unchecked'
import IconReplay from '~icons/material-symbols/replay'
import IconRouteOutline from '~icons/material-symbols/route-outline'
import IconScheduleOutline from '~icons/material-symbols/schedule-outline'
import IconSearch from '~icons/material-symbols/search'
import IconSearchOff from '~icons/material-symbols/search-off'
import IconSnowboarding from '~icons/material-symbols/snowboarding'
import IconSportsScore from '~icons/material-symbols/sports-score'
import IconSprint from '~icons/material-symbols/sprint'
import IconStar from '~icons/material-symbols/star'
import IconStarOutline from '~icons/material-symbols/star-outline'
import IconSyncAlt from '~icons/material-symbols/sync-alt'
import IconTourOutline from '~icons/material-symbols/tour-outline'
import IconTripOrigin from '~icons/material-symbols/trip-origin'
import IconTune from '~icons/material-symbols/tune'
import IconUploadFileOutline from '~icons/material-symbols/upload-file-outline'
import IconVerifiedOutline from '~icons/material-symbols/verified-outline'
import IconWarningOutline from '~icons/material-symbols/warning-outline'
import IconWbSunnyOutline from '~icons/material-symbols/wb-sunny-outline'

/**
 * Central icon registry: internal name → bundled SVG component.
 *
 * Icons are bundled, tree-shaken Material Symbols SVGs (via `unplugin-icons` +
 * Iconify `@iconify-json/material-symbols`). There is no icon font and no CDN.
 *
 * Why a registry instead of importing at each call site: `<BaseIcon>` receives
 * its icon `name` as a runtime string (`:name="TOUR_TYPE_ICONS[type]"`, prop
 * pass-through, ternaries). `unplugin-icons` resolves `~icons/...` imports at
 * BUILD time by static analysis, so a dynamic `import(`~icons/${name}`)` cannot
 * work. Every used icon is therefore statically imported here and mapped by its
 * internal name; `BaseIcon` looks the name up in this map.
 *
 * Keys keep the app's historic underscore names (`location_on`) so all existing
 * `<BaseIcon name="…">` call sites are unchanged. Values use the Iconify
 * `-outline` variant to match the previous Material Symbols Outlined + FILL 0
 * look (glyph-only icons like `add`/`close` ship a single variant).
 *
 * To ADD an icon: add one import + one entry mapping `internal_name` to
 * `~icons/material-symbols/<kebab-name>` (append `-outline` for the unfilled
 * variant). See `.claude/conventions.md` → Styling.
 */
export const iconRegistry: Record<string, Component> = {
  account_circle: IconAccountCircleOutline,
  add: IconAdd,
  add_location_alt: IconAddLocationAltOutline,
  arrow_back: IconArrowBack,
  arrow_forward: IconArrowForward,
  attach_file: IconAttachFile,
  badge: IconBadgeOutline,
  block: IconBlockOutline,
  broken_image: IconBrokenImageOutline,
  calendar_today: IconCalendarTodayOutline,
  call: IconCallOutline,
  chat: IconChatOutline,
  check: IconCheck,
  check_circle: IconCheckCircleOutline,
  chevron_left: IconChevronLeft,
  chevron_right: IconChevronRight,
  close: IconClose,
  cloud_off: IconCloudOffOutline,
  contacts: IconContactsOutline,
  delete: IconDeleteOutline,
  description: IconDescriptionOutline,
  directions: IconDirectionsOutline,
  directions_bike: IconDirectionsBike,
  downhill_skiing: IconDownhillSkiing,
  download: IconDownload,
  download_for_offline: IconDownloadForOfflineOutline,
  drag_indicator: IconDragIndicator,
  edit: IconEditOutline,
  expand_less: IconExpandLess,
  explore: IconExploreOutline,
  feedback: IconFeedbackOutline,
  flag: IconFlagOutline,
  group: IconGroupOutline,
  hardware: IconHardwareOutline,
  help: IconHelpOutline,
  hiking: IconHiking,
  home: IconHomeOutline,
  image: IconImageOutline,
  info: IconInfoOutline,
  landscape: IconLandscapeOutline,
  link: IconLink,
  location_on: IconLocationOnOutline,
  lock: IconLockOutline,
  logout: IconLogout,
  mail: IconMailOutline,
  map: IconMapOutline,
  menu: IconMenu,
  my_location: IconMyLocationOutline,
  nordic_walking: IconNordicWalking,
  paragliding: IconParaglidingOutline,
  person: IconPersonOutline,
  person_add: IconPersonAddOutline,
  person_remove: IconPersonRemoveOutline,
  phone: IconPhoneEnabledOutline,
  picture_as_pdf: IconPictureAsPdfOutline,
  privacy_tip: IconPrivacyTipOutline,
  radio_button_unchecked: IconRadioButtonUnchecked,
  // Material Symbols draws remove_circle_outline and do_not_disturb_on as the
  // same glyph; Iconify only ships the latter name.
  remove_circle_outline: IconDoNotDisturbOnOutline,
  replay: IconReplay,
  route: IconRouteOutline,
  schedule: IconScheduleOutline,
  search: IconSearch,
  search_off: IconSearchOff,
  snowboarding: IconSnowboarding,
  sports_score: IconSportsScore,
  sprint: IconSprint,
  star: IconStarOutline,
  // Filled star for the "primary method" selected state (was CSS FILL 1).
  star_filled: IconStar,
  sync_alt: IconSyncAlt,
  // Iconify has no `terrain`; `filter_hdr` is Material's identical mountains glyph.
  terrain: IconFilterHdr,
  tour: IconTourOutline,
  trip_origin: IconTripOrigin,
  tune: IconTune,
  upload_file: IconUploadFileOutline,
  verified: IconVerifiedOutline,
  warning: IconWarningOutline,
  wb_sunny: IconWbSunnyOutline,
}
