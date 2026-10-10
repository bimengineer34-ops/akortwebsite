import type { SvgComponent } from 'astro/types';

/**
 * İkon kayıt defteri. Tek kaynak: src/assets/icons (AKORT_WEB_ASSET_PACK_V1/02_ICONS).
 * Harici ikon kütüphanesi kullanılmaz.
 *
 * `_pending/` klasörü: Pack'te bulunmayan, pack çizgi diliyle (24×24, stroke 1.8, round) çizilmiş
 * ve kullanıcı onayı bekleyen ikonlar (TODO-ASSET-ICON).
 */
export const iconNames = [
  // services
  'services/bim-digital',
  'services/building-performance',
  'services/clash-detection',
  'services/commissioning',
  'services/cost',
  'services/due-diligence',
  'services/energy',
  'services/engineering-consulting',
  'services/mep',
  'services/owner-advisory',
  'services/project-management',
  'services/technical-spec',
  // expertise
  'expertise/analysis',
  'expertise/campus',
  'expertise/commercial',
  'expertise/education',
  'expertise/health',
  'expertise/optimization',
  // process
  'process/check',
  'process/coordination',
  'process/report',
  'process/strategy',
  'process/support',
  // ui
  'ui/arrow-right',
  'ui/location',
  'ui/mail',
  'ui/phone',
  'ui/search',
  // chatbot
  'chatbot/chat',
  // onay bekleyen (TODO-ASSET-ICON)
  '_pending/menu',
  '_pending/close',
  '_pending/diamond',
  '_pending/shield',
  '_pending/target',
  '_pending/eye',
  '_pending/gear',
  '_pending/lightning',
  '_pending/grid',
  '_pending/layers',
  '_pending/area',
  '_pending/clock',
  '_pending/user',
  '_pending/send',
  '_pending/chevron-down',
  '_pending/plus',
  '_pending/code',
] as const;

export type IconName = (typeof iconNames)[number];

const modules = import.meta.glob<SvgComponent>('/src/assets/icons/**/*.svg', {
  eager: true,
  import: 'default',
});

const registry = new Map<string, SvgComponent>(
  Object.entries(modules).map(([path, component]) => [
    path.replace('/src/assets/icons/', '').replace(/\.svg$/, ''),
    component,
  ]),
);

export const getIcon = (name: IconName): SvgComponent => {
  const icon = registry.get(name);
  if (!icon) {
    throw new Error(`[Icon] "${name}" bulunamadı. src/assets/icons altında dosya olduğundan emin olun.`);
  }
  return icon;
};
