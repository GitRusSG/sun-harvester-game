import type { TechTreeId, TechNode, SynergyBonus } from '../core/research.js';

/**
 * Cross-tree synergy definitions.
 * Completing nodes in one tree can reduce costs in related trees.
 */
export interface SynergyRule {
  sourceTree: TechTreeId;
  targetTree: TechTreeId;
  /** Number of completed nodes in source tree required to activate */
  requiredCompletions: number;
  /** Cost reduction multiplier (e.g., 0.9 = 10% off) */
  costReduction: number;
  description: string;
}

export const SYNERGY_RULES: SynergyRule[] = [
  {
    sourceTree: 'energy',
    targetTree: 'space',
    requiredCompletions: 2,
    costReduction: 0.9,
    description: 'Energy research reduces Space tree costs by 10%',
  },
  {
    sourceTree: 'materials',
    targetTree: 'weapons',
    requiredCompletions: 2,
    costReduction: 0.85,
    description: 'Materials research reduces Weapons tree costs by 15%',
  },
  {
    sourceTree: 'political',
    targetTree: 'energy',
    requiredCompletions: 2,
    costReduction: 0.95,
    description: 'Political research reduces Energy tree costs by 5%',
  },
  {
    sourceTree: 'political',
    targetTree: 'materials',
    requiredCompletions: 2,
    costReduction: 0.95,
    description: 'Political research reduces Materials tree costs by 5%',
  },
  {
    sourceTree: 'political',
    targetTree: 'weapons',
    requiredCompletions: 2,
    costReduction: 0.95,
    description: 'Political research reduces Weapons tree costs by 5%',
  },
  {
    sourceTree: 'political',
    targetTree: 'space',
    requiredCompletions: 2,
    costReduction: 0.95,
    description: 'Political research reduces Space tree costs by 5%',
  },
];

/**
 * All tech tree node definitions. At least 3 nodes per tree (15+ total).
 */
export const TECH_TREE_NODES: TechNode[] = [
  // ─── Energy Tree ───────────────────────────────────────────────────────
  {
    id: 'energy_efficiency_1',
    tree: 'energy',
    name: 'Improved Solar Cells',
    description: 'Increase solar panel efficiency by 15%.',
    educationalContent: 'Modern photovoltaic cells convert sunlight into electricity using semiconductor materials. Monocrystalline silicon cells achieve around 20-22% efficiency in commercial panels.',
    tier: 1,
    cost: { currency: 500, knowledge: 50 },
    researchTime: 30,
    prerequisites: [],
    bonus: { type: 'solar_efficiency', value: 0.15, description: '+15% solar panel efficiency' },
    status: 'available',
  },
  {
    id: 'energy_storage_1',
    tree: 'energy',
    name: 'Advanced Batteries',
    description: 'Increase energy storage capacity by 25%.',
    educationalContent: 'Lithium-ion batteries store energy through reversible chemical reactions. Grid-scale storage helps balance intermittent solar supply with constant demand.',
    tier: 1,
    cost: { currency: 600, knowledge: 60 },
    researchTime: 35,
    prerequisites: [],
    bonus: { type: 'energy_storage', value: 0.25, description: '+25% energy storage capacity' },
    status: 'available',
  },
  {
    id: 'energy_nuclear_1',
    tree: 'energy',
    name: 'Nuclear Fission',
    description: 'Unlock nuclear power plants for base-load energy generation.',
    educationalContent: 'Nuclear fission splits heavy atoms like uranium-235, releasing enormous energy. One kilogram of uranium produces as much energy as 2,700 tonnes of coal.',
    tier: 2,
    cost: { currency: 1500, knowledge: 150 },
    researchTime: 60,
    prerequisites: ['energy_efficiency_1'],
    bonus: { type: 'unlock_nuclear', value: 1, description: 'Unlocks nuclear power plants' },
    status: 'locked',
  },
  {
    id: 'energy_fusion_1',
    tree: 'energy',
    name: 'Fusion Reactor',
    description: 'Unlock fusion power with virtually unlimited fuel from hydrogen.',
    educationalContent: 'Nuclear fusion combines light atoms into heavier ones, the same process that powers the Sun. Deuterium from seawater could provide virtually limitless clean energy.',
    tier: 3,
    cost: { currency: 5000, knowledge: 500 },
    researchTime: 120,
    prerequisites: ['energy_nuclear_1', 'energy_storage_1'],
    bonus: { type: 'unlock_fusion', value: 1, description: 'Unlocks fusion reactors' },
    status: 'locked',
  },

  // ─── Materials Tree ────────────────────────────────────────────────────
  {
    id: 'materials_refining_1',
    tree: 'materials',
    name: 'Efficient Smelting',
    description: 'Reduce material refining costs by 20%.',
    educationalContent: 'Iron smelting uses blast furnaces at over 1500°C to separate iron from its ore. Modern processes recycle heat and use oxygen injection for efficiency.',
    tier: 1,
    cost: { currency: 400, knowledge: 40 },
    researchTime: 25,
    prerequisites: [],
    bonus: { type: 'refining_cost', value: 0.2, description: '-20% refining costs' },
    status: 'available',
  },
  {
    id: 'materials_silicon_1',
    tree: 'materials',
    name: 'Silicon Purification',
    description: 'Increase silicon production rate by 30%.',
    educationalContent: 'Solar-grade silicon requires 99.9999% purity. The Siemens process uses chemical vapor deposition to achieve this extreme refinement from raw quartz.',
    tier: 1,
    cost: { currency: 450, knowledge: 45 },
    researchTime: 28,
    prerequisites: [],
    bonus: { type: 'silicon_production', value: 0.3, description: '+30% silicon production' },
    status: 'available',
  },
  {
    id: 'materials_advanced_1',
    tree: 'materials',
    name: 'Advanced Composites',
    description: 'Unlock advanced circuit production and reduce electronics cost.',
    educationalContent: 'Carbon fiber composites are five times stronger than steel at one-fifth the weight. They are essential for space structures where mass is the primary constraint.',
    tier: 2,
    cost: { currency: 1200, knowledge: 120 },
    researchTime: 50,
    prerequisites: ['materials_refining_1', 'materials_silicon_1'],
    bonus: { type: 'unlock_advanced_circuits', value: 1, description: 'Unlocks advanced circuit recipes' },
    status: 'locked',
  },
  {
    id: 'materials_nanotech_1',
    tree: 'materials',
    name: 'Nanotechnology',
    description: 'All material production rates increased by 20%.',
    educationalContent: 'Nanotechnology manipulates matter at scales below 100 nanometers. Self-assembling nanomaterials could revolutionize manufacturing with molecular precision.',
    tier: 3,
    cost: { currency: 4000, knowledge: 400 },
    researchTime: 100,
    prerequisites: ['materials_advanced_1'],
    bonus: { type: 'material_production_all', value: 0.2, description: '+20% all material production' },
    status: 'locked',
  },

  // ─── Weapons Tree ──────────────────────────────────────────────────────
  {
    id: 'weapons_conventional_1',
    tree: 'weapons',
    name: 'Advanced Ballistics',
    description: 'Increase conventional weapons production speed by 25%.',
    educationalContent: 'Modern ballistic technology uses computer-aided design and precision manufacturing to improve accuracy and reduce material waste in munitions production.',
    tier: 1,
    cost: { currency: 600, knowledge: 30 },
    researchTime: 30,
    prerequisites: [],
    bonus: { type: 'weapons_production_speed', value: 0.25, description: '+25% conventional weapons production' },
    status: 'available',
  },
  {
    id: 'weapons_armor_1',
    tree: 'weapons',
    name: 'Reactive Armor',
    description: 'Reduce damage from UN military interventions by 20%.',
    educationalContent: 'Reactive armor uses explosive panels that detonate outward on impact, disrupting incoming projectiles. Modern composite armor combines ceramics, metals, and polymers for layered protection.',
    tier: 1,
    cost: { currency: 500, knowledge: 35 },
    researchTime: 28,
    prerequisites: [],
    bonus: { type: 'damage_reduction', value: 0.2, description: '-20% damage from UN attacks' },
    status: 'available',
  },
  {
    id: 'weapons_missile_1',
    tree: 'weapons',
    name: 'Guided Missiles',
    description: 'Unlock missile category weapons with superior military power.',
    educationalContent: 'Guided missile systems use inertial navigation, GPS, and terminal guidance to achieve precision strikes. Deterrence theory suggests that credible defense capability can prevent conflict.',
    tier: 2,
    cost: { currency: 1800, knowledge: 100 },
    researchTime: 55,
    prerequisites: ['weapons_conventional_1'],
    bonus: { type: 'unlock_missiles', value: 1, description: 'Unlocks missile weapon category' },
    status: 'locked',
  },
  {
    id: 'weapons_cyber_1',
    tree: 'weapons',
    name: 'Cyber Warfare',
    description: 'Unlock cyber weapons that reduce enemy production capacity.',
    educationalContent: 'Cyber warfare targets digital infrastructure. Critical systems like power grids and communications depend on software that can be disrupted without physical conflict.',
    tier: 2,
    cost: { currency: 1500, knowledge: 120 },
    researchTime: 45,
    prerequisites: ['weapons_conventional_1'],
    bonus: { type: 'unlock_cyber', value: 1, description: 'Unlocks cyber weapon category' },
    status: 'locked',
  },
  {
    id: 'weapons_icbm_1',
    tree: 'weapons',
    name: 'Intercontinental Ballistic Missiles',
    description: 'Increase missile military power by 40% and unlock ICBM deterrence.',
    educationalContent: 'ICBMs can deliver warheads across continents in under 30 minutes. Their existence fundamentally changed geopolitics by making any nation with ICBMs capable of striking anywhere on Earth.',
    tier: 3,
    cost: { currency: 3500, knowledge: 200 },
    researchTime: 80,
    prerequisites: ['weapons_missile_1'],
    bonus: { type: 'missile_power_boost', value: 0.4, description: '+40% missile military power' },
    status: 'locked',
  },
  {
    id: 'weapons_energy_1',
    tree: 'weapons',
    name: 'Directed Energy Weapons',
    description: 'Unlock energy weapons category — lasers and particle beams.',
    educationalContent: 'Directed energy weapons use focused electromagnetic radiation or particle beams to disable targets. They offer near-instantaneous engagement at the speed of light with virtually unlimited ammunition.',
    tier: 3,
    cost: { currency: 4000, knowledge: 250 },
    researchTime: 90,
    prerequisites: ['weapons_missile_1', 'weapons_cyber_1'],
    bonus: { type: 'unlock_energy_weapons', value: 1, description: 'Unlocks energy weapon category' },
    status: 'locked',
  },
  {
    id: 'weapons_stealth_1',
    tree: 'weapons',
    name: 'Stealth Technology',
    description: 'All weapon factories produce 30% faster due to reduced detection.',
    educationalContent: 'Stealth technology minimizes radar cross-section through angular design, radar-absorbing materials, and infrared signature reduction. The F-117 was the first operational stealth aircraft in 1983.',
    tier: 3,
    cost: { currency: 3000, knowledge: 180 },
    researchTime: 70,
    prerequisites: ['weapons_cyber_1', 'weapons_armor_1'],
    bonus: { type: 'factory_speed_all', value: 0.3, description: '+30% all weapon factory production speed' },
    status: 'locked',
  },
  {
    id: 'weapons_orbital_1',
    tree: 'weapons',
    name: 'Orbital Strike Platforms',
    description: 'Unlock orbital weapons — space-based kinetic bombardment.',
    educationalContent: 'The concept of "rods from god" uses dense tungsten rods dropped from orbit, achieving devastating kinetic energy without explosives. The Outer Space Treaty of 1967 bans nuclear weapons in space but not kinetic weapons.',
    tier: 4,
    cost: { currency: 8000, knowledge: 500 },
    researchTime: 130,
    prerequisites: ['weapons_energy_1'],
    bonus: { type: 'unlock_orbital_weapons', value: 1, description: 'Unlocks orbital weapon category' },
    status: 'locked',
  },
  {
    id: 'weapons_ai_warfare_1',
    tree: 'weapons',
    name: 'Autonomous Combat Systems',
    description: 'All military power increased by 25% through AI-coordinated defense.',
    educationalContent: 'Autonomous weapons systems use AI to identify, track, and engage targets without human intervention. The ethical debate around lethal autonomous weapons ("killer robots") is one of the most pressing in modern military ethics.',
    tier: 4,
    cost: { currency: 7000, knowledge: 450 },
    researchTime: 110,
    prerequisites: ['weapons_stealth_1', 'weapons_energy_1'],
    bonus: { type: 'military_power_all', value: 0.25, description: '+25% total military power' },
    status: 'locked',
  },
  {
    id: 'weapons_planetary_defense_1',
    tree: 'weapons',
    name: 'Planetary Defense Network',
    description: 'Complete immunity to UN military interventions. Eliminates alien threats instantly.',
    educationalContent: 'A planetary defense network would coordinate ground-based, orbital, and deep-space assets into an integrated shield. Such systems could also defend against asteroid impacts — a dual-use technology for civilization preservation.',
    tier: 5,
    cost: { currency: 15000, knowledge: 800 },
    researchTime: 200,
    prerequisites: ['weapons_orbital_1', 'weapons_ai_warfare_1', 'weapons_icbm_1'],
    bonus: { type: 'absolute_defense', value: 1, description: 'Immune to UN military attacks and alien threats' },
    status: 'locked',
  },

  // ─── Political Tree ────────────────────────────────────────────────────
  {
    id: 'political_diplomacy_1',
    tree: 'political',
    name: 'Diplomatic Corps',
    description: 'Increase influence growth rate by 20%.',
    educationalContent: 'Diplomacy is the practice of conducting negotiations between nations. Effective diplomacy requires understanding cultural contexts, economic leverage, and mutual interests.',
    tier: 1,
    cost: { currency: 500, knowledge: 50 },
    researchTime: 30,
    prerequisites: [],
    bonus: { type: 'influence_growth', value: 0.2, description: '+20% influence growth rate' },
    status: 'available',
  },
  {
    id: 'political_propaganda_1',
    tree: 'political',
    name: 'Media Control',
    description: 'Reduce public approval loss from negative events by 30%.',
    educationalContent: 'Mass media shapes public opinion through narrative framing. Understanding information flows helps societies maintain informed democratic participation.',
    tier: 1,
    cost: { currency: 550, knowledge: 55 },
    researchTime: 32,
    prerequisites: [],
    bonus: { type: 'approval_loss_reduction', value: 0.3, description: '-30% approval loss from events' },
    status: 'available',
  },
  {
    id: 'political_espionage_1',
    tree: 'political',
    name: 'Intelligence Network',
    description: 'Unlock intelligence influence method with faster results.',
    educationalContent: 'Intelligence agencies gather information about other nations strategic capabilities. Open-source intelligence analysis uses publicly available data for geopolitical assessment.',
    tier: 2,
    cost: { currency: 1400, knowledge: 140 },
    researchTime: 50,
    prerequisites: ['political_diplomacy_1'],
    bonus: { type: 'unlock_intelligence', value: 1, description: 'Unlocks intelligence influence method' },
    status: 'locked',
  },

  // ─── Space Tree ────────────────────────────────────────────────────────
  {
    id: 'space_orbital_1',
    tree: 'space',
    name: 'Orbital Mechanics',
    description: 'Reduce orbital launch costs by 20%.',
    educationalContent: 'Reaching orbit requires velocity of about 7.8 km/s. The Tsiolkovsky equation shows that fuel mass grows exponentially with required velocity change.',
    tier: 1,
    cost: { currency: 800, knowledge: 80 },
    researchTime: 40,
    prerequisites: [],
    bonus: { type: 'launch_cost_reduction', value: 0.2, description: '-20% orbital launch costs' },
    status: 'available',
  },
  {
    id: 'space_solar_collectors_1',
    tree: 'space',
    name: 'Space-Based Solar',
    description: 'Unlock orbital solar collectors with no weather penalty.',
    educationalContent: 'In orbit, solar panels receive unfiltered sunlight 24 hours a day with no atmospheric absorption. A satellite in geostationary orbit gets about 1361 W/m² continuously.',
    tier: 2,
    cost: { currency: 2500, knowledge: 250 },
    researchTime: 70,
    prerequisites: ['space_orbital_1'],
    bonus: { type: 'unlock_orbital_solar', value: 1, description: 'Unlocks space-based solar collectors' },
    status: 'locked',
  },
  {
    id: 'space_mining_1',
    tree: 'space',
    name: 'Asteroid Mining',
    description: 'Unlock asteroid territory claiming and resource extraction.',
    educationalContent: 'Near-Earth asteroids contain vast mineral wealth. A single metallic asteroid 1km across could contain more platinum-group metals than ever mined on Earth.',
    tier: 3,
    cost: { currency: 6000, knowledge: 600 },
    researchTime: 150,
    prerequisites: ['space_solar_collectors_1'],
    bonus: { type: 'unlock_asteroid_mining', value: 1, description: 'Unlocks asteroid mining territories' },
    status: 'locked',
  },
];

/**
 * Look up a tech node by its ID.
 */
export function getTechNodeById(nodeId: string): TechNode | undefined {
  return TECH_TREE_NODES.find((n) => n.id === nodeId);
}

/**
 * Get all nodes belonging to a specific tree.
 */
export function getTreeNodes(tree: TechTreeId): TechNode[] {
  return TECH_TREE_NODES.filter((n) => n.tree === tree);
}

/**
 * Calculate applicable synergy bonuses for a target node based on current research state.
 */
export function calculateSynergies(
  completedNodesByTree: Record<TechTreeId, number>,
  targetTree: TechTreeId,
): SynergyBonus[] {
  const bonuses: SynergyBonus[] = [];

  for (const rule of SYNERGY_RULES) {
    if (rule.targetTree !== targetTree) continue;
    const completions = completedNodesByTree[rule.sourceTree] ?? 0;
    if (completions >= rule.requiredCompletions) {
      bonuses.push({
        sourceTree: rule.sourceTree,
        targetTree: rule.targetTree,
        costReduction: rule.costReduction,
        description: rule.description,
      });
    }
  }

  return bonuses;
}
