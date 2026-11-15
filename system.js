// ============================================================
// Habitat core systems: power, life support (ECLSS),
// radiation shielding, food production + trade-off events
// ============================================================

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class BaseSystems {
  // cfg: { stormAt, stormDur, stormName, spikes: [seconds...] }
  constructor(cfg = {}) {
    this.cfg = cfg;
    this.elapsed = 0;
    this.survivalMode = !!cfg.survivalMode;

    // system states
    this.powerMode = null;      // 'solar' | 'nuclear'
    this.powerOnline = false;
    this.eclssOnline = false;
    this.shieldMode = null;     // 'regolith' | 'water'
    this.shieldOnline = false;
    this.foodOnline = false;
    this.radiationPlan = null;   // 'shelter' | 'burrow'

    // resources
    this.water = cfg.waterStart ?? 100;      // drinking reserves %
    this.crew = cfg.crewStart ?? 100;        // crew health %
    this.foodStock = cfg.foodStart ?? 65;    // food / morale %

    // events
    this.stormActive = false;
    this.stormDone = false;
    this.stormJustEnded = false;
    this.spikeActive = false;
    this.spikeJustStarted = false;

    this.brownout = false;
    this.scoreBonus = 0;        // nuclear choice applies a cost
  }

  supply() {
    if (!this.powerOnline) return 0;
    if (this.powerMode === 'nuclear') return 45; // constant baseline, costs more
    return this.stormActive ? 8 : 60;            // solar stops in storms / night
  }

  demand() {
    let d = 0;
    if (this.eclssOnline) d += 20;              // ECLSS needs continuous power
    if (this.foodOnline) d += 15;               // hydroponics needs electricity
    if (this.shieldOnline && this.shieldMode === 'regolith') d += 10; // regolith needs equipment power
    return d;
  }

  o2Multiplier() {
    let m = 1;
    if (this.brownout) m *= 2.5;                 // failing life support
    if (this.foodOnline && !this.brownout && this.water > 0) m *= 0.75; // hydroponics gives oxygen
    if (this.cfg.eclssFailure) {
      if (!this.eclssOnline) m *= 1.6;
      else if (!this.brownout) m *= 0.55;
    }
    return m;
  }

  update(dt) {
    this.elapsed += dt;
    const c = this.cfg;

    // dust storm / lunar night window
    const wasStorm = this.stormActive;
    this.stormActive = this.elapsed >= c.stormAt && this.elapsed < c.stormAt + c.stormDur;
    if (wasStorm && !this.stormActive) {
      this.stormDone = true;
      this.stormJustEnded = true;
    }

    // radiation spikes
    const wasSpike = this.spikeActive;
    this.spikeActive = (c.spikes || []).some((s) => this.elapsed >= s && this.elapsed < s + 25);
    this.spikeJustStarted = !wasSpike && this.spikeActive;

    // power balance
    this.brownout = this.demand() > this.supply();

    // water: baseline crew use; closed-loop ECLSS conserves; water walls + hydroponics consume
    let wd = this.survivalMode ? 0.07 : 0.05;
    if (this.eclssOnline && !this.brownout) wd -= this.survivalMode ? 0.02 : 0.035;
    if (this.shieldOnline && this.shieldMode === 'water') wd += this.survivalMode ? 0.06 : 0.05;
    if (this.foodOnline && !this.brownout) wd += this.survivalMode ? 0.05 : 0.045;
    this.water = clamp(this.water - wd * dt, 0, 100);

    // food: hydroponics produces when powered + watered, otherwise stock drops
    const foodGain = this.survivalMode ? 0.045 : 0.08;
    const foodLoss = this.survivalMode ? 0.085 : 0.05;
    if (this.foodOnline && !this.brownout && this.water > 0) {
      this.foodStock = clamp(this.foodStock + foodGain * dt, 0, 100);
    } else {
      this.foodStock = clamp(this.foodStock - foodLoss * dt, 0, 100);
    }

    // crew health
    let cd = 0;
    if (this.spikeActive && (!this.shieldOnline || this.brownout)) cd -= 1.6;
    if (this.brownout) cd -= 0.35;
    if (this.radiationPlan === 'shelter') {
      if (this.spikeActive) cd -= 0.85;
      if (this.foodOnline && this.water > 0) cd += 0.12;
    }
    if (this.radiationPlan === 'burrow') {
      if (this.spikeActive) cd -= 0.45;
      if (this.eclssOnline && !this.brownout) cd += 0.18;
    }
    if (this.water <= 0) cd -= this.survivalMode ? 0.7 : 0.4;
    if (this.foodStock <= 0) cd -= this.survivalMode ? 0.7 : 0.4;
    if (this.survivalMode && this.water <= 15) cd -= 0.28;
    if (this.survivalMode && this.foodStock <= 15) cd -= 0.28;
    if (cd === 0 && this.eclssOnline && !this.brownout) cd += 0.25;
    this.crew = clamp(this.crew + cd * dt, 0, 100);
  }

  eventBanner() {
    if (this.stormActive) return { text: this.cfg.stormName + ' - SOLAR OUTPUT CRITICAL', kind: 'storm' };
    if (this.spikeActive) return { text: 'RADIATION SPIKE', kind: 'rad' };
    return null;
  }
}
