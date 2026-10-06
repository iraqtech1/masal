export default {
  props: { icon: [Object, Function], active: Boolean, motion: Number, kind: String },
  template: `<span :key="active?motion:'idle'" class="nav-symbol" aria-hidden="true">
    <svg v-if="active" class="nav-progress-ring" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="21" pathLength="100"/>
    </svg>
    <svg v-if="active" class="nav-press-effect" viewBox="0 0 48 48" fill="none">
      <path class="nav-inward-arrow nav-inward-first" d="M39 9L28 20M28 12V20H36"/>
      <path class="nav-inward-arrow nav-inward-second" d="M9 39L20 28M12 28H20V36"/>
    </svg>
    <component :is="icon" :key="active?motion:'idle'" :size="21" class="nav-glyph" :class="kind?'nav-glyph-'+kind:undefined"/>
  </span>`
};
