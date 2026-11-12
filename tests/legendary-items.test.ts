import { describe, expect, it } from 'vitest';
import { itemCard } from '../src/client/describe';
import { CREEPS, HERO_IDS, ITEMS, ItemId, LANE_IDS, MAX_LEVEL, PlayerSlot, TICK_RATE, Team, Unit, World, XP_TABLE, isInvisible, manaCostOf } from '../src/sim';
import { HEROES } from '../src/sim';

const LEGENDARY: ItemId[] = ['worldbreaker', 'warStandard', 'bulwarkOfAges', 'astralScepter', 'tempestBlade', 'phantomMantle', 'silencePike'];

function humans() {
  const slots: PlayerSlot[] = [];
  for (const team of [0, 1] as Team[]) HERO_IDS.slice(0, 3).forEach((heroId, i) => slots.push({ team, heroId, controller: 'human', lane: LANE_IDS[i] }));
  const w = new World({ seed: 5, slots });
  const hero = (team: Team, id: string) => w.heroes.find((h) => h.team === team && h.hero!.defId === id)!;
  return { w, hero };
}
const place = (u: Unit, x: number, y: number) => {
  u.x = u.px = x;
  u.y = u.py = y;
};
const run = (w: World, s: number) => {
  for (let i = 0; i < Math.round(s * TICK_RATE); i++) w.step();
};
const give = (w: World, u: Unit, ...ids: ItemId[]) => {
  ids.forEach((id, i) => (u.hero!.items[i] = { id, count: 1 }));
  w.applyHeroStats(u);
};
const clear = (w: World, keep: Unit[]) => {
  for (const u of w.units) if (!keep.includes(u) && u.kind !== 'structure') place(u, 5, 5);
};
const SPOT = { x: 150, y: 150 };

describe('legendary items', () => {
  it('each is built from two finished items, costs more than both, sits in the Legend tab and has a card', () => {
    for (const id of LEGENDARY) {
      const d = ITEMS[id];
      expect(d.recipe).toHaveLength(2);
      for (const p of d.recipe!) expect(ITEMS[p].cost).toBeGreaterThanOrEqual(1200);
      expect(d.cost).toBeGreaterThan(d.recipe!.reduce((s, p) => s + ITEMS[p].cost, 0));
      expect(d.tab).toBe('legendary');
      expect(itemCard(id).length).toBeGreaterThan(40);
    }
  });

  it('buying one at the shop uses up both finished items', () => {
    const { w, hero } = humans();
    const me = hero(0, 'brakk');
    give(w, me, 'siegeMaul', 'reaperEdge');
    const f = w.map.fountains[0];
    place(me, f.x, f.y);
    me.hero!.gold = 2000;
    w.applyCommand({ type: 'buy', unitId: me.id, itemId: 'worldbreaker' });
    const ids = me.hero!.items.filter(Boolean).map((s) => s!.id);
    expect(ids).toEqual(['worldbreaker']);
    expect(me.hero!.gold).toBe(2000 - (5000 - 1200 - 2700));
  });

  it('Bulwark of Ages halves the damage you take while it lasts', () => {
    const { w, hero } = humans();
    const me = hero(0, 'brakk');
    const foe = hero(1, 'orin');
    clear(w, [me, foe]);
    place(me, SPOT.x, SPOT.y);
    place(foe, SPOT.x + 3, SPOT.y);
    give(w, me, 'bulwarkOfAges');
    let hp = me.hp;
    w.dealDamage(foe.id, me, 200, 'spell');
    const full = hp - me.hp;
    w.applyCommand({ type: 'useItem', unitId: me.id, slot: 0 });
    hp = me.hp;
    w.dealDamage(foe.id, me, 200, 'spell');
    expect(hp - me.hp).toBeCloseTo(full / 2, 3);
  });

  it('Astral Scepter makes abilities cost 25% less mana', () => {
    const { w, hero } = humans();
    const me = hero(0, 'orin');
    const def = HEROES.orin.abilities[0];
    const before = manaCostOf(me, def, 1);
    give(w, me, 'astralScepter');
    expect(manaCostOf(me, def, 1)).toBeCloseTo(before * 0.75, 5);
  });

  it('War Standard powers up allies and nearby lane creeps, and does not stack with a Banner', () => {
    const { w, hero } = humans();
    const me = hero(0, 'brakk');
    const ally = hero(0, 'vexa');
    clear(w, [me, ally]);
    place(me, SPOT.x, SPOT.y);
    place(ally, SPOT.x + 4, SPOT.y);
    give(w, me, 'warStandard');
    give(w, ally, 'bannerOfValor');
    (w as unknown as { spawnWave(): void }).spawnWave();
    const creep = w.units.find((u) => u.creep && u.team === 0)!;
    place(creep, SPOT.x - 4, SPOT.y);
    run(w, 0.2);
    const aura = (u: Unit) => u.buffs.filter((b) => b.key === 'aura:valor');
    expect(aura(ally)).toHaveLength(1);
    expect(aura(ally)[0].armor).toBe(6);
    expect(aura(creep)[0]?.buildingDamagePct).toBe(50);
    expect(aura(creep)[0]?.bonusDamage).toBe(15);
  });

  it('Phantom Mantle blinks further and leaves you invisible for a moment', () => {
    const { w, hero } = humans();
    const me = hero(0, 'brakk');
    clear(w, [me]);
    place(me, SPOT.x, SPOT.y);
    give(w, me, 'phantomMantle');
    w.applyCommand({ type: 'useItem', unitId: me.id, slot: 0, x: SPOT.x + 14, y: SPOT.y });
    expect(me.x).toBeGreaterThan(SPOT.x + 11);
    expect(isInvisible(me)).toBe(true);
    run(w, 2.2);
    expect(isInvisible(me)).toBe(false);
  });

  it('Tempest Blade throws lightning at up to 4 enemies near the target', () => {
    const { w, hero } = humans();
    const me = hero(0, 'vexa');
    give(w, me, 'tempestBlade');
    expect(me.hero!.bonus.chainTargets).toBe(4);
    give(w, me, 'stormBlade');
    expect(me.hero!.bonus.chainTargets).toBe(2);
  });
});

describe('levels 16-20', () => {
  it('heroes reach level 20; levels after 15 give stats but no ability points', () => {
    const { w, hero } = humans();
    const me = hero(0, 'brakk');
    expect(MAX_LEVEL).toBe(20);
    w.giveXp(me, XP_TABLE[14] - me.hero!.xp);
    expect(me.hero!.level).toBe(15);
    const points = me.hero!.skillPoints;
    const hp15 = me.maxHp;
    const dmg15 = me.damage;
    w.giveXp(me, XP_TABLE[19] - me.hero!.xp + 1e6);
    expect(me.hero!.level).toBe(20);
    expect(me.hero!.skillPoints).toBe(points);
    expect(me.maxHp).toBeGreaterThan(hp15);
    expect(me.damage).toBeGreaterThan(dmg15);
  });
});
