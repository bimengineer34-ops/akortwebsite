/**
 * AKORT BIM Viewer motoru — ThatOpen (@thatopen/components) + web-ifc + three.js.
 *
 * Yalnızca /bim sayfasında, kullanıcı bir model seçtiğinde dinamik import ile yüklenir (diğer sayfalara JS yükü yok).
 * IFC dosyası tarayıcıda işlenir; sunucuya gönderilmez. worker ve WASM kendi sitemizden sunulur (/bim/…),
 * kütüphanenin varsayılanı olan unpkg.com isteği kullanılmaz (bkz. scripts/copy-bim-assets.mjs).
 */
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import { RenderedFaces } from '@thatopen/fragments';
import type { FragmentsModel, SpatialTreeItem } from '@thatopen/fragments';

export interface PropRow {
  name: string;
  value: string;
}
export interface PropGroup {
  title: string;
  rows: PropRow[];
}
export interface SelectionInfo {
  name: string;
  category: string;
  guid: string;
  groups: PropGroup[];
}
export interface StoreyInfo {
  localId: number;
  name: string;
  count: number;
}
export interface DisciplineInfo {
  key: string;
  label: string;
  count: number;
}
export interface ModelSummary {
  fileName: string;
  itemCount: number;
  storeys: StoreyInfo[];
  disciplines: DisciplineInfo[];
}

export interface ViewerEvents {
  onSelect: (info: SelectionInfo | null) => void;
  onError: (message: string) => void;
}

/** Disiplin filtreleri — IFC kategori adlarına göre (Master Prompt §24: mimari, taşıyıcı, HVAC, tesisat, elektrik). */
const DISCIPLINES: { key: string; label: string; match: RegExp[] }[] = [
  { key: 'mimari', label: 'Mimari', match: [/^IFC(WALL|WALLSTANDARDCASE|DOOR|WINDOW|STAIR|STAIRFLIGHT|RAILING|ROOF|COVERING|CURTAINWALL|SLAB|SPACE|FURNISHINGELEMENT)$/i] },
  { key: 'tasiyici', label: 'Taşıyıcı', match: [/^IFC(BEAM|COLUMN|FOOTING|PILE|MEMBER|PLATE|REINFORCINGBAR|REINFORCINGMESH)$/i] },
  { key: 'hvac', label: 'Mekanik (HVAC)', match: [/^IFC(DUCTSEGMENT|DUCTFITTING|DUCTSILENCER|AIRTERMINAL|AIRTERMINALBOX|FAN|UNITARYEQUIPMENT|BOILER|CHILLER|COIL|DAMPER|HEATEXCHANGER|HUMIDIFIER|COMPRESSOR|PUMP)$/i] },
  { key: 'tesisat', label: 'Tesisat', match: [/^IFC(PIPESEGMENT|PIPEFITTING|VALVE|SANITARYTERMINAL|WASTETERMINAL|TANK|FLOWMETER|FIRESUPPRESSIONTERMINAL)$/i] },
  { key: 'elektrik', label: 'Elektrik', match: [/^IFC(CABLESEGMENT|CABLECARRIERSEGMENT|CABLEFITTING|CABLECARRIERFITTING|LAMP|LIGHTFIXTURE|ELECTRICAPPLIANCE|ELECTRICDISTRIBUTIONBOARD|OUTLET|SWITCHINGDEVICE|SENSOR|ALARM|COMMUNICATIONSAPPLIANCE|ELECTRICGENERATOR|ELECTRICMOTOR|TRANSFORMER)$/i] },
];

type AnyRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is AnyRecord => typeof v === 'object' && v !== null && !Array.isArray(v);
const attrValue = (v: unknown): string | undefined => {
  if (isRecord(v) && 'value' in v) {
    const x = v.value;
    if (x === null || x === undefined || x === '') return undefined;
    return typeof x === 'number' ? String(Math.round(x * 1000) / 1000) : String(x);
  }
  return undefined;
};

/** ItemData → okunabilir gruplar. Yapı: nitelikler + (IsDefinedBy → özellik/miktar setleri). */
export const toGroups = (data: AnyRecord): PropGroup[] => {
  const groups: PropGroup[] = [];
  const base: PropRow[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith('_')) continue;
    const v = attrValue(val);
    if (v !== undefined) base.push({ name: key, value: v });
  }
  if (base.length) groups.push({ title: 'Nitelikler', rows: base });

  const sets = data.IsDefinedBy;
  if (Array.isArray(sets)) {
    for (const set of sets) {
      if (!isRecord(set)) continue;
      const title = attrValue(set.Name) ?? 'Özellik seti';
      const rows: PropRow[] = [];
      for (const [k, children] of Object.entries(set)) {
        if (!Array.isArray(children)) continue;
        if (k !== 'HasProperties' && k !== 'Quantities') continue;
        for (const p of children) {
          if (!isRecord(p)) continue;
          const name = attrValue(p.Name);
          const valueKey = Object.keys(p).find((x) => /Value$/.test(x) && x !== 'Unit');
          const value = valueKey ? attrValue(p[valueKey]) : undefined;
          if (name && value !== undefined) rows.push({ name, value });
        }
      }
      if (rows.length) groups.push({ title, rows });
    }
  }
  return groups;
};

const collectIds = (node: SpatialTreeItem, out: number[]) => {
  if (node.localId !== null) out.push(node.localId);
  node.children?.forEach((c) => collectIds(c, out));
};
/**
 * Fragments uzamsal ağacı: kategori düğümü (category: 'IFCBUILDINGSTOREY', localId: null) → altında gerçek örnekler
 * (localId dolu, category null). Bu yüzden kat örnekleri, kategori düğümünün localId'li çocuklarıdır.
 */
const findStoreys = (node: SpatialTreeItem, out: SpatialTreeItem[]) => {
  if (node.category && /^IFCBUILDINGSTOREY$/i.test(node.category)) {
    node.children?.forEach((c) => c.localId !== null && out.push(c));
    return;
  }
  node.children?.forEach((c) => findStoreys(c, out));
};

export class AkortViewer {
  private constructor(
    private readonly components: OBC.Components,
    private readonly world: OBC.SimpleWorld<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>,
    private readonly container: HTMLElement,
    private readonly renderer: OBC.SimpleRenderer,
    private readonly events: ViewerEvents,
  ) {}

  private model: FragmentsModel | null = null;
  private selected: number | null = null;
  private all: number[] = [];
  private storeyItems = new Map<number, number[]>();
  private disciplineItems = new Map<string, number[]>();
  private resizeObserver?: ResizeObserver;

  static async create(container: HTMLElement, events: ViewerEvents): Promise<AkortViewer> {
    const components = new OBC.Components();
    const worlds = components.get(OBC.Worlds);
    const world = worlds.create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();

    world.scene = new OBC.SimpleScene(components);
    world.scene.setup();
    world.scene.three.background = new THREE.Color('#eef3f8');
    const renderer = new OBC.SimpleRenderer(components, container);
    world.renderer = renderer;
    world.camera = new OBC.SimpleCamera(components);
    components.init();

    const fragments = components.get(OBC.FragmentsManager);
    fragments.init('/bim/worker.mjs');

    const ifcLoader = components.get(OBC.IfcLoader);
    await ifcLoader.setup({ autoSetWasm: false, wasm: { path: '/bim/', absolute: true } });

    const viewer = new AkortViewer(components, world, container, renderer, events);
    viewer.bind(fragments);
    return viewer;
  }

  private bind(fragments: OBC.FragmentsManager) {
    const { world } = this;
    world.camera.controls.addEventListener('update', () => fragments.core.update());
    world.camera.controls.addEventListener('rest', () => fragments.core.update(true));
    fragments.list.onItemSet.add(({ value: model }) => {
      model.useCamera(world.camera.three);
      world.scene.three.add(model.object);
      void fragments.core.update(true);
    });

    // Seçim: tıklama (sürükleme = orbit olduğu için yalnızca küçük hareketli tıklamalar)
    const canvas = this.renderer.three.domElement;
    let down: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    canvas.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5;
      down = null;
      if (!moved) void this.pick(e.clientX, e.clientY);
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.renderer.resize();
      world.camera.updateAspect();
    });
    this.resizeObserver.observe(this.container);
  }

  private get fragments() {
    return this.components.get(OBC.FragmentsManager);
  }

  /** IFC dosyasını yükler ve model özetini döndürür. */
  async loadIfc(data: Uint8Array, fileName: string): Promise<ModelSummary> {
    await this.unload();
    const ifcLoader = this.components.get(OBC.IfcLoader);
    const model = await ifcLoader.load(data, true, fileName.replace(/\.ifc$/i, ''));
    this.model = model;
    await this.fragments.core.update(true);

    const tree = await model.getSpatialStructure();
    const storeyNodes: SpatialTreeItem[] = [];
    findStoreys(tree, storeyNodes);
    const storeys: StoreyInfo[] = [];
    this.storeyItems.clear();
    for (const node of storeyNodes) {
      if (node.localId === null) continue;
      const ids: number[] = [];
      collectIds(node, ids);
      // Kat düğümünün kendisi geometri değil; yalnızca altındaki öğeler
      const children = ids.filter((id) => id !== node.localId);
      this.storeyItems.set(node.localId, children);
      const [d] = await model.getItemsData([node.localId], { attributesDefault: true, relationsDefault: { attributes: false, relations: false } });
      const name = (d && attrValue((d as AnyRecord).Name)) ?? `Kat ${storeys.length + 1}`;
      storeys.push({ localId: node.localId, name, count: children.length });
    }

    // Disiplinler
    this.disciplineItems.clear();
    const disciplines: DisciplineInfo[] = [];
    for (const d of DISCIPLINES) {
      const found = await model.getItemsOfCategories(d.match);
      const ids = Object.values(found).flat();
      if (ids.length) {
        this.disciplineItems.set(d.key, ids);
        disciplines.push({ key: d.key, label: d.label, count: ids.length });
      }
    }

    this.all = [];
    collectIds(tree, this.all);
    this.fitView();
    return { fileName, itemCount: this.all.length, storeys, disciplines };
  }

  async unload() {
    if (this.model) {
      await this.clearSelection();
      this.world.scene.three.remove(this.model.object);
      this.fragments.list.delete(this.model.modelId);
      this.model = null;
    }
  }

  /** İzometrik başlangıç açısı + tüm modeli kadraja alma. */
  fitView() {
    if (!this.model) return;
    const box = this.model.box.clone();
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const dist = Math.max(size.x, size.y, size.z, 1) * 1.6;
    const controls = this.world.camera.controls;
    void controls.setLookAt(center.x + dist * 0.8, center.y + dist * 0.6, center.z + dist * 0.8, center.x, center.y, center.z, false);
    void controls.fitToBox(box, true, { paddingLeft: 0.4, paddingRight: 0.4, paddingTop: 0.4, paddingBottom: 0.4 });
  }

  private map(ids: number[]): OBC.ModelIdMap {
    return this.model ? { [this.model.modelId]: new Set(ids) } : {};
  }

  private async pick(clientX: number, clientY: number) {
    if (!this.model) return;
    const { world } = this;
    const result = await this.fragments.raycast({
      camera: world.camera.three,
      mouse: new THREE.Vector2(clientX, clientY),
      dom: this.renderer.three.domElement,
    });
    if (!result) {
      await this.clearSelection();
      this.events.onSelect(null);
      return;
    }
    await this.select(result.localId);
  }

  async select(localId: number) {
    if (!this.model) return;
    this.selected = localId;
    await this.fragments.resetHighlight();
    await this.fragments.highlight(
      { color: new THREE.Color('#0b6f9f'), renderedFaces: RenderedFaces.ONE, opacity: 1, transparent: false },
      this.map([localId]),
    );
    const [data] = await this.model.getItemsData([localId], {
      attributesDefault: true,
      relations: {
        IsDefinedBy: { attributes: true, relations: true },
        DefinesOccurrence: { attributes: false, relations: false },
      },
    });
    const d = (data ?? {}) as AnyRecord;
    this.events.onSelect({
      name: attrValue(d.Name) ?? 'İsimsiz öğe',
      category: attrValue(d._category) ?? '—',
      guid: attrValue(d._guid) ?? '—',
      groups: toGroups(d),
    });
  }

  async clearSelection() {
    this.selected = null;
    await this.fragments.resetHighlight();
  }

  // ---- Görünürlük (gizle / göster / izole / kat / disiplin)
  private get hider() {
    return this.components.get(OBC.Hider);
  }
  async hideSelected() {
    if (this.selected !== null) await this.hider.set(false, this.map([this.selected]));
    await this.clearSelection();
    this.events.onSelect(null);
  }
  async isolateSelected() {
    if (this.selected !== null) await this.hider.isolate(this.map([this.selected]));
  }
  async showAll() {
    await this.hider.set(true);
  }
  async isolateStorey(localId: number) {
    const ids = this.storeyItems.get(localId);
    if (ids?.length) await this.hider.isolate(this.map(ids));
  }
  async isolateDiscipline(key: string) {
    const ids = this.disciplineItems.get(key);
    if (ids?.length) await this.hider.isolate(this.map(ids));
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.components.dispose();
  }
}
