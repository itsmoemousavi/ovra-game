import { describe, expect, it } from 'vitest';
import { CREEPS, HeroId, LANE_IDS, PlayerSlot, TICK_RATE, Team, Unit, World } from '../src/sim';
import { WARDS } from '../src/sim/data/units';
import { CREEP_AGGRO_COOLDOWN, CREEP_CHASE } from '../src/sim/world';

// Lane creep targeting (owner, 2026-11-11): the closest enemy, heroes and creeps before buildings
// before wards; hitting a creep doesn't turn it; ordering an attack on an enemy hero pulls the
// enemy creeps near you (3 s cooldown, auto attack doesn't); a pull from afar lasts 2.3 s.

function arena(a: HeroId[], b: HeroId[]) {
  const slots: PlayerSlot[] = [];
  a.forEach((heroId, i) => slots.push({ team: 0, heroId, controller: 'human', lane: LANE_IDS[i] }));
  b.forEach((heroId, i) => slots.push({ team: 1, heroId, controller: 'human', lane: LANE_IDS[i] }));
  const w = new World({ seed: 5, slots });
  return { w, hero: (t: Team, id: string) => w.heroes.find((h) => h.team === t && h.hero!.defId === id)! };
}
const place = (u: Unit, x: number, y: number) => {
  u.x = u.px = x;
  u.y = u.py = y;
};
const run = (w: World, s: number) => {
  for (let i = 0; i < Math.round(s * TICK_RATE); i++) w.step();
};
/** A lane creep that stands its ground (no lane to walk) and doesn't die. */
function creep(w: World, team: Team, x: number, y: number, type: 'melee' | 'ranged' = 'melee', damage = 0) {
  const c = w.spawnUnit('creep', team, { x, y }, { ...CREEPS[type], damage, bountyGold: 0 });
  c.maxHp = c.hp = 1e6;
  c.creep = { type, lane: 'mid', path: [{ x, y }], wp: 1, super: false, mega: false };
  return c;
}
const tough = (u: Unit) => {
  u.maxHp = u.hp = 1e6;
  u.damage = 0;
};
const X = 150;
const Y = 150;

describe('lane creeps', () => {
  it('hitting a creep does not make it turn on you', () => {
    const { w, hero } = arena(['vexa'], ['brakk']);
    const v = hero(0, 'vexa');
    tough(v);
    place(hero(1, 'brakk'), 40, 40);
    const e = creep(w, 1, X, Y);
    const f = creep(w, 0, X + 1.5, Y);
    place(v, X - 5, Y);
    run(w, 0.5);
    expect(e.targetId).toBe(f.id);
    w.applyCommand({ type: 'attack', unitId: v.id, targetId: e.id });
    run(w, 2);
    expect(e.targetId).toBe(f.id);
  });

  it('an attack order on an enemy hero pulls nearby enemy creeps; auto attack does not', () => {
    const { w, hero } = arena(['vexa'], ['brakk']);
    const v = hero(0, 'vexa');
    const b = hero(1, 'brakk');
    tough(v);
    tough(b);
    const e = creep(w, 1, X, Y);
    const f = creep(w, 0, X, Y + 1.5);
    place(v, X + 6, Y);
    place(b, X + 9, Y);
    run(w, 0.5);
    expect(e.targetId).toBe(f.id);
    // Auto attack hitting Brakk: the creep stays on its creep.
    place(v, X + 4, Y);
    run(w, 1);
    expect(e.targetId).toBe(f.id);
    // Still busy with a closer creep: the pull doesn't take it.
    w.applyCommand({ type: 'attack', unitId: v.id, targetId: b.id });
    w.step();
    expect(e.targetId).toBe(f.id);
    // Once the creep is out of the way, the next order (after the cooldown) pulls it.
    place(f, X, Y + 30);
    place(v, X + 4, Y);
    tough(f);
    e.targetId = f.id;
    run(w, CREEP_AGGRO_COOLDOWN);
    w.applyCommand({ type: 'attack', unitId: v.id, targetId: b.id });
    w.step();
    expect(e.targetId).toBe(v.id);
  });

  it('the pull works once every 3 seconds', () => {
    const { w, hero } = arena(['vexa'], ['brakk']);
    const v = hero(0, 'vexa');
    const b = hero(1, 'brakk');
    tough(v);
    tough(b);
    place(v, X, Y);
    place(b, X + 7, Y);
    w.applyCommand({ type: 'attack', unitId: v.id, targetId: b.id });
    // A creep that arrives a moment later is not pulled by a second order straight away.
    const e = creep(w, 1, X - 5, Y);
    const g = creep(w, 0, X - 5, Y - 2);
    run(w, 0.5);
    expect(e.targetId).toBe(g.id);
    w.applyCommand({ type: 'attack', unitId: v.id, targetId: b.id });
    w.step();
    expect(e.targetId).toBe(g.id);
    place(g, X - 5, Y - 40);
    tough(g);
    e.targetId = g.id;
    run(w, CREEP_AGGRO_COOLDOWN);
    w.applyCommand({ type: 'attack', unitId: v.id, targetId: b.id });
    w.step();
    expect(e.targetId).toBe(v.id);
  });

  it('pulled from outside its sight range, a creep chases for 2.3 s and then walks back', () => {
    const { w, hero } = arena(['vexa'], ['brakk']);
    const v = hero(0, 'vexa');
    const b = hero(1, 'brakk');
    tough(v);
    tough(b);
    const e = creep(w, 1, X, Y);
    place(v, X + 7.5, Y);
    place(b, X + 14, Y);
    v.hero!.autoAttack = false;
    run(w, 0.2);
    w.applyCommand({ type: 'attack', unitId: v.id, targetId: b.id });
    w.step();
    expect(e.targetId).toBe(v.id);
    expect(e.creep!.aggroId).toBe(v.id);
    // Vexa backs off out of its range (holding still there, ignoring Brakk).
    w.applyCommand({ type: 'stop', unitId: v.id });
    w.applyCommand({ type: 'setAutoAttack', unitId: v.id, enabled: false });
    place(v, X + 25, Y);
    run(w, CREEP_CHASE + 0.3);
    expect(e.targetId).not.toBe(v.id);
    run(w, 4);
    expect(Math.hypot(e.x - X, e.y - Y)).toBeLessThan(3);
  });

  it('creeps hitting a tower switch to a hero or creep in their attack range, not before', () => {
    const { w, hero } = arena(['vexa'], ['brakk']);
    const v = hero(0, 'vexa');
    tough(v);
    place(hero(1, 'brakk'), 40, 40);
    v.hero!.autoAttack = false;
    const tower = w.structures.find((s) => s.team === 0 && s.structure!.tier === 'tower1')!;
    tower.damage = 0;
    tower.maxHp = tower.hp = 1e6;
    const m = creep(w, 1, tower.x + tower.radius + 1.5, tower.y);
    const r = creep(w, 1, tower.x + tower.radius + 7, tower.y, 'ranged');
    place(v, 20, 20);
    run(w, 1);
    expect(m.targetId).toBe(tower.id);
    expect(r.targetId).toBe(tower.id);
    // Vexa next to the melee creep but out of the ranged creep's attack range.
    place(v, m.x + 1.6, m.y - 1);
    const far = Math.hypot(v.x - r.x, v.y - r.y);
    run(w, 0.5);
    expect(m.targetId).toBe(v.id);
    if (far > CREEPS.ranged.attackRange + 1.6) expect(r.targetId).toBe(tower.id);
    // Within the ranged creep's attack range: it turns too.
    place(v, r.x + 4, r.y);
    run(w, 0.5);
    expect(r.targetId).toBe(v.id);
  });

  it('wards: only when seen, only with nothing else near, and creeps need many hits', () => {
    const { w, hero } = arena(['vexa'], ['brakk']);
    place(hero(0, 'vexa'), 20, 20);
    place(hero(1, 'brakk'), 280, 280);
    const ward = w.spawnUnit('ward', 0, { x: X + 3, y: Y }, WARDS.observer);
    ward.ward = { kind: 'observer', expires: 1e9, placedAt: 0 };
    const e = creep(w, 1, X, Y, 'melee', CREEPS.melee.damage);
    run(w, 1);
    expect(e.targetId).not.toBe(ward.id); // invisible: not seen
    // An enemy sentry nearby gives true sight.
    const s = w.spawnUnit('ward', 1, { x: X - 1, y: Y + 1 }, WARDS.sentry);
    s.ward = { kind: 'sentry', expires: 1e9, placedAt: w.time };
    run(w, 2.5);
    expect(e.targetId).toBe(ward.id);
    expect(ward.alive).toBe(true);
    expect(ward.hp).toBeLessThan(ward.maxHp);
    expect(ward.hp).toBeGreaterThan(ward.maxHp / 2 - 1); // not half per hit
    run(w, 15);
    expect(ward.alive).toBe(false);
  });
});
