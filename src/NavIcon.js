export default {
  props: { icon: [Object, Function], active: Boolean, motion: Number },
  template: `<span class="nav-symbol" aria-hidden="true">
    <svg v-if="active" :key="motion" class="nav-progress-ring" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="21" pathLength="100"/>
    </svg>
    <component :is="icon" :size="21" class="nav-glyph"/>
  </span>`
};
