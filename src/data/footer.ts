import type { NavItem } from './navigation';
import { ov } from '@/utils/overrides';

/** Footer alt satırındaki yasal linkler (referans: Gizlilik Politikası | KVKK | Çerez Tercihleri). */
export const legalNav: NavItem[] = ov('footer.legalNav', [
  { label: 'Gizlilik Politikası', href: '/gizlilik-politikasi' },
  { label: 'KVKK', href: '/kvkk' },
  { label: 'Çerez Tercihleri', href: '/cerez-tercihleri' },
]);
