import type { CountryProfile } from '../core/country.js';
import type { CountryId } from '../core/types.js';

export const COUNTRY_PROFILES: Record<CountryId, CountryProfile> = {
  usa: {
    id: 'usa',
    name: 'United States of America',
    description:
      'Military superpower with massive defense budget and advanced technology. High starting currency and military assets make the USA ideal for players who want early-game dominance and aggressive expansion.',
    buffs: [
      {
        type: 'military_power',
        value: 1.25,
        description: '+25% military power output',
      },
    ],
    startingResources: {
      currency: 800,
      materials: {
        iron_ore: 30,
        coal: 40,
        copper: 20,
        electronics: 10,
      },
      energyCapacity: 400,
    },
    startingMilitary: 15,
  },

  china: {
    id: 'china',
    name: 'China',
    description:
      'Manufacturing powerhouse with vast raw material reserves. Unmatched production speed lets China out-build any opponent through sheer industrial output.',
    buffs: [
      {
        type: 'manufacturing_speed',
        value: 1.3,
        description: '+30% manufacturing and crafting speed',
      },
    ],
    startingResources: {
      currency: 600,
      materials: {
        iron_ore: 80,
        coal: 100,
        copper: 30,
        rare_earth: 20,
      },
      energyCapacity: 350,
    },
    startingMilitary: 10,
  },

  russia: {
    id: 'russia',
    name: 'Russia',
    description:
      'Energy giant with enormous fossil fuel and uranium reserves. Russia excels at powering early-game expansion with cheap energy and maintaining a strong military deterrent.',
    buffs: [
      {
        type: 'energy_reserves',
        value: 1.2,
        description: '+20% energy storage capacity and fuel efficiency',
      },
      {
        type: 'fuel_efficiency',
        value: 1.15,
        description: '+15% fuel consumption reduction',
      },
      {
        type: 'space_experience',
        value: 1.1,
        description: '+10% space program efficiency',
      }
    ],
    startingResources: {
      currency: 5000,
      materials: {
        uranium: 40,
        coal: 100,
        fuel: 50,
        iron_ore: 35,
      },
      energyCapacity: 600,
    },
    startingMilitary: 14,
  },

  india: {
    id: 'india',
    name: 'India',
    description:
      'Emerging solar energy leader with abundant silicon resources and strong sunlight. India offers a renewable-focused path with high solar efficiency and large energy capacity.',
    buffs: [
      {
        type: 'solar_efficiency',
        value: 1.2,
        description: '+20% solar panel output efficiency',
      },
    ],
    startingResources: {
      currency: 500,
      materials: {
        silicon: 100,
        iron_ore: 50,
        coal: 80,
        copper: 30,
      },
      energyCapacity: 550,
    },
    startingMilitary: 8,
  },

  germany: {
    id: 'germany',
    name: 'Germany',
    description:
      'Engineering excellence with highly efficient production lines. Germany builds fewer but better structures, gaining more output per unit of material invested.',
    buffs: [
      {
        type: 'engineering_efficiency',
        value: 1.25,
        description: '+25% infrastructure output efficiency',
      },
    ],
    startingResources: {
      currency: 1400,
      materials: {
        electronics: 60,
        iron_ore: 50,
        copper: 40,
        steel: 30,
      },
      energyCapacity: 450,
    },
    startingMilitary: 12,
  },

  japan: {
    id: 'japan',
    name: 'Japan',
    description:
      'Technology research leader with world-class electronics industry. Japan accelerates through the tech trees faster than any other nation, unlocking advanced systems early.',
    buffs: [
      {
        type: 'research_speed',
        value: 1.25,
        description: '+25% research completion speed',
      },
    ],
    startingResources: {
      currency: 1300,
      materials: {
        electronics: 80,
        silicon: 50,
        copper: 40,
        rare_earth: 20,
      },
      energyCapacity: 500,
    },
    startingMilitary: 10,
  },

  uk: {
    id: 'uk',
    name: 'United Kingdom',
    description:
      'Diplomatic heavyweight with strong global connections. The UK leverages soft power to influence other nations and secure favorable trade agreements.',
    buffs: [
      {
        type: 'diplomatic_influence',
        value: 1.2,
        description: '+20% political influence gain rate',
      },
    ],
    startingResources: {
      currency: 1200,
      materials: {
        iron_ore: 40,
        coal: 60,
        copper: 35,
        electronics: 30,
      },
      energyCapacity: 400,
    },
    startingMilitary: 1,
  },

  france: {
    id: 'france',
    name: 'France',
    description:
      'Space technology pioneer with advanced nuclear expertise. France provides an edge in orbital and space eras with superior launch technology and uranium processing.',
    buffs: [
      {
        type: 'space_technology',
        value: 1.15,
        description: '+15% space launch cost reduction and orbital efficiency',
      },
    ],
    startingResources: {
      currency: 1300,
      materials: {
        uranium: 60,
        iron_ore: 45,
        electronics: 25,
        steel: 20,
      },
      energyCapacity: 450,
    },
    startingMilitary: 14,
  },

  south_korea: {
    id: 'south_korea',
    name: 'South Korea',
    description:
      'Trade and electronics hub with efficient supply chains. South Korea maximizes revenue from energy sales and material trading, keeping the economy strong.',
    buffs: [
      {
        type: 'trade_bonus',
        value: 1.2,
        description: '+20% trade revenue and energy sale prices',
      },
    ],
    startingResources: {
      currency: 1100,
      materials: {
        electronics: 70,
        silicon: 40,
        copper: 35,
        steel: 25,
      },
      energyCapacity: 430,
    },
    startingMilitary: 12,
  },

  brazil: {
    id: 'brazil',
    name: 'Brazil',
    description:
      'Resource extraction powerhouse with vast mineral deposits. Brazil mines raw materials faster than anyone, providing a steady stream of building blocks for expansion.',
    buffs: [
      {
        type: 'material_extraction',
        value: 1.25,
        description: '+25% mining production rate',
      },
    ],
    startingResources: {
      currency: 900,
      materials: {
        iron_ore: 100,
        copper: 80,
        coal: 60,
        rare_earth: 15,
      },
      energyCapacity: 420,
    },
    startingMilitary: 8,
  },
};

export function getCountryProfile(id: CountryId): CountryProfile {
  return COUNTRY_PROFILES[id];
}

export function getAllCountryIds(): CountryId[] {
  return Object.keys(COUNTRY_PROFILES) as CountryId[];
}
