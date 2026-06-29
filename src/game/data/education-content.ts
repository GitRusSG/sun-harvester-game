import type { Quiz } from '../core/education.js';

/**
 * Educational fact presented to the player on research unlock or milestone completion.
 */
export interface EducationFact {
  id: string;
  topic: EducationTopic;
  content: string;
}

/**
 * All educational topic areas covered in the game.
 */
export type EducationTopic =
  | 'fossil_fuels'
  | 'nuclear'
  | 'solar'
  | 'materials'
  | 'orbital_mechanics'
  | 'dyson_concepts'
  | 'geopolitics'
  | 'mars'
  | 'aliens'
  | 'weapons_deterrence';

/**
 * Static educational facts organized by topic (at least 2-3 per topic).
 */
export const EDUCATION_FACTS: EducationFact[] = [
  // Fossil Fuels
  {
    id: 'fact_fossil_1',
    topic: 'fossil_fuels',
    content: 'Coal power plants convert chemical energy stored in coal into electricity through combustion, heating water to create steam that drives turbines.',
  },
  {
    id: 'fact_fossil_2',
    topic: 'fossil_fuels',
    content: 'Fossil fuels formed from ancient organic matter over millions of years. Coal comes from ancient plant material compressed in swamps.',
  },
  {
    id: 'fact_fossil_3',
    topic: 'fossil_fuels',
    content: 'A typical coal plant operates at about 33-40% thermal efficiency, meaning most energy is lost as waste heat.',
  },

  // Nuclear
  {
    id: 'fact_nuclear_1',
    topic: 'nuclear',
    content: 'Nuclear fission splits heavy atoms like Uranium-235, releasing enormous energy. One kilogram of uranium contains as much energy as 2,700 tonnes of coal.',
  },
  {
    id: 'fact_nuclear_2',
    topic: 'nuclear',
    content: 'Nuclear fusion, the process powering the Sun, combines light hydrogen isotopes into helium, releasing far more energy per unit mass than fission.',
  },
  {
    id: 'fact_nuclear_3',
    topic: 'nuclear',
    content: 'Modern nuclear reactors use control rods made of neutron-absorbing materials like boron to regulate the chain reaction rate.',
  },

  // Solar
  {
    id: 'fact_solar_1',
    topic: 'solar',
    content: 'Photovoltaic cells convert sunlight directly into electricity using the photoelectric effect, first explained by Einstein in 1905.',
  },
  {
    id: 'fact_solar_2',
    topic: 'solar',
    content: 'The Sun delivers about 1,361 watts per square meter to Earth orbit (the solar constant). Atmosphere and weather reduce this at ground level.',
  },
  {
    id: 'fact_solar_3',
    topic: 'solar',
    content: 'Modern commercial solar panels achieve 20-23% efficiency, while laboratory cells have reached over 47% using multi-junction designs.',
  },

  // Materials
  {
    id: 'fact_materials_1',
    topic: 'materials',
    content: 'Silicon is the second most abundant element in Earth\'s crust. Solar-grade silicon requires 99.9999% purity, achieved through the Czochralski process.',
  },
  {
    id: 'fact_materials_2',
    topic: 'materials',
    content: 'Steel is an alloy of iron and carbon. Adding small amounts of carbon (0.2-2.1%) transforms soft iron into a material with vastly superior strength.',
  },
  {
    id: 'fact_materials_3',
    topic: 'materials',
    content: 'Rare earth elements like neodymium and dysprosium are critical for modern electronics and renewable energy technologies despite their misleading name — they are relatively abundant but difficult to extract.',
  },

  // Orbital Mechanics
  {
    id: 'fact_orbital_1',
    topic: 'orbital_mechanics',
    content: 'Objects in low Earth orbit travel at approximately 7.8 km/s. At this speed, they complete one orbit around Earth every 90 minutes.',
  },
  {
    id: 'fact_orbital_2',
    topic: 'orbital_mechanics',
    content: 'The Tsiolkovsky rocket equation shows that reaching orbit requires exponentially more fuel for each additional kilogram of payload, making launch costs a major barrier to space industry.',
  },
  {
    id: 'fact_orbital_3',
    topic: 'orbital_mechanics',
    content: 'Geostationary orbit at 35,786 km altitude allows satellites to remain fixed over one point on Earth, ideal for communications and weather monitoring.',
  },

  // Dyson Concepts
  {
    id: 'fact_dyson_1',
    topic: 'dyson_concepts',
    content: 'Freeman Dyson proposed in 1960 that an advanced civilization could build a shell or swarm of structures around a star to capture most of its energy output.',
  },
  {
    id: 'fact_dyson_2',
    topic: 'dyson_concepts',
    content: 'A Dyson Ring is the simplest megastructure variant: a ring of solar collectors orbiting a star. It would capture only a fraction of stellar output but is far more feasible than a full sphere.',
  },
  {
    id: 'fact_dyson_3',
    topic: 'dyson_concepts',
    content: 'The Sun outputs 3.8 × 10²⁶ watts of power. Capturing even 0.001% of this would provide more energy than humanity currently uses by a factor of thousands.',
  },

  // Geopolitics
  {
    id: 'fact_geopolitics_1',
    topic: 'geopolitics',
    content: 'Energy security is a cornerstone of geopolitics. Nations with abundant energy resources wield significant international influence through supply control.',
  },
  {
    id: 'fact_geopolitics_2',
    topic: 'geopolitics',
    content: 'The United Nations was established in 1945 with the goal of maintaining international peace. Its Security Council has 5 permanent members with veto power.',
  },
  {
    id: 'fact_geopolitics_3',
    topic: 'geopolitics',
    content: 'Economic sanctions are a common tool of international pressure, restricting trade to influence a nation\'s behavior without military action.',
  },

  // Mars
  {
    id: 'fact_mars_1',
    topic: 'mars',
    content: 'Mars has 38% of Earth\'s gravity, meaning rockets launched from Mars need far less fuel to reach orbit — a major advantage for space construction.',
  },
  {
    id: 'fact_mars_2',
    topic: 'mars',
    content: 'The Martian atmosphere is 95% carbon dioxide. This CO₂ can be converted into methane fuel and oxygen through the Sabatier reaction.',
  },
  {
    id: 'fact_mars_3',
    topic: 'mars',
    content: 'Water ice exists in large quantities at the Martian poles and underground. This ice could provide drinking water, oxygen, and hydrogen fuel for a Mars colony.',
  },

  // Aliens
  {
    id: 'fact_aliens_1',
    topic: 'aliens',
    content: 'The Drake Equation estimates the number of communicating civilizations in our galaxy based on factors like star formation rate and planet frequency.',
  },
  {
    id: 'fact_aliens_2',
    topic: 'aliens',
    content: 'The Fermi Paradox asks: if intelligent life is common in the universe, why have we found no evidence of it? Proposed answers range from the Great Filter to the Zoo Hypothesis.',
  },
  {
    id: 'fact_aliens_3',
    topic: 'aliens',
    content: 'SETI (Search for Extraterrestrial Intelligence) has been scanning radio frequencies for alien signals since 1960, covering millions of star systems.',
  },

  // Weapons/Deterrence
  {
    id: 'fact_weapons_1',
    topic: 'weapons_deterrence',
    content: 'Nuclear deterrence theory (MAD — Mutually Assured Destruction) argues that nuclear weapons prevent large-scale wars by making the cost of conflict catastrophic for all parties.',
  },
  {
    id: 'fact_weapons_2',
    topic: 'weapons_deterrence',
    content: 'Cyber warfare represents a new domain of conflict where nations can disrupt infrastructure, steal secrets, and influence events without kinetic weapons.',
  },
  {
    id: 'fact_weapons_3',
    topic: 'weapons_deterrence',
    content: 'Space-based weapons platforms were theorized during the Cold War (SDI "Star Wars" program). International treaties currently limit weaponization of space.',
  },
];

/**
 * Static quiz questions for milestone completion. At least 10 quizzes
 * covering the educational topics. Each awards 25 knowledge points.
 */
export const EDUCATION_QUIZZES: Quiz[] = [
  {
    id: 'quiz_fossil_1',
    question: 'What is the typical thermal efficiency of a modern coal power plant?',
    options: ['10-15%', '33-40%', '60-70%', '90-95%'],
    correctIndex: 1,
    explanation: 'Coal plants typically achieve 33-40% thermal efficiency. Most energy is lost as waste heat through cooling systems.',
    relatedTopic: 'fossil_fuels',
    rewardKnowledgePoints: 25,
  },
  {
    id: 'quiz_nuclear_1',
    question: 'How much coal energy equivalent is contained in one kilogram of uranium?',
    options: ['27 tonnes', '270 tonnes', '2,700 tonnes', '27,000 tonnes'],
    correctIndex: 2,
    explanation: 'One kilogram of uranium contains as much energy as approximately 2,700 tonnes of coal due to the enormous energy density of nuclear fuel.',
    relatedTopic: 'nuclear',
    rewardKnowledgePoints: 25,
  },
  {
    id: 'quiz_solar_1',
    question: 'What physical effect do photovoltaic cells use to generate electricity?',
    options: ['Thermoelectric effect', 'Photoelectric effect', 'Piezoelectric effect', 'Electromagnetic induction'],
    correctIndex: 1,
    explanation: 'Photovoltaic cells exploit the photoelectric effect, where photons knock electrons free from semiconductor material, creating an electric current.',
    relatedTopic: 'solar',
    rewardKnowledgePoints: 25,
  },
  {
    id: 'quiz_materials_1',
    question: 'What purity level is required for solar-grade silicon?',
    options: ['99.9%', '99.99%', '99.9999%', '99.9999999%'],
    correctIndex: 2,
    explanation: 'Solar-grade silicon requires 99.9999% (six nines) purity to function effectively as a semiconductor in photovoltaic cells.',
    relatedTopic: 'materials',
    rewardKnowledgePoints: 25,
  },
  {
    id: 'quiz_orbital_1',
    question: 'How long does it take an object in low Earth orbit to complete one orbit?',
    options: ['45 minutes', '90 minutes', '3 hours', '24 hours'],
    correctIndex: 1,
    explanation: 'Objects in low Earth orbit travel at ~7.8 km/s and complete one full orbit approximately every 90 minutes.',
    relatedTopic: 'orbital_mechanics',
    rewardKnowledgePoints: 25,
  },
  {
    id: 'quiz_dyson_1',
    question: 'Who first proposed the concept of capturing a star\'s energy output with a megastructure?',
    options: ['Carl Sagan', 'Freeman Dyson', 'Nikolai Kardashev', 'Arthur C. Clarke'],
    correctIndex: 1,
    explanation: 'Freeman Dyson proposed the concept in 1960 in his paper "Search for Artificial Stellar Sources of Infrared Radiation."',
    relatedTopic: 'dyson_concepts',
    rewardKnowledgePoints: 25,
  },
  {
    id: 'quiz_geopolitics_1',
    question: 'How many permanent members does the UN Security Council have?',
    options: ['3', '5', '7', '10'],
    correctIndex: 1,
    explanation: 'The UN Security Council has 5 permanent members (USA, UK, France, Russia, China) each with veto power over resolutions.',
    relatedTopic: 'geopolitics',
    rewardKnowledgePoints: 25,
  },
  {
    id: 'quiz_mars_1',
    question: 'What percentage of Earth\'s gravity does Mars have?',
    options: ['10%', '25%', '38%', '62%'],
    correctIndex: 2,
    explanation: 'Mars has approximately 38% of Earth\'s surface gravity, significantly reducing the energy needed to launch material from its surface.',
    relatedTopic: 'mars',
    rewardKnowledgePoints: 25,
  },
  {
    id: 'quiz_aliens_1',
    question: 'What paradox asks why we haven\'t found evidence of alien civilizations despite the vastness of the universe?',
    options: ['Drake Paradox', 'Fermi Paradox', 'Olbers\' Paradox', 'Einstein Paradox'],
    correctIndex: 1,
    explanation: 'The Fermi Paradox (named after physicist Enrico Fermi) highlights the contradiction between the high probability of extraterrestrial civilizations and the lack of evidence for them.',
    relatedTopic: 'aliens',
    rewardKnowledgePoints: 25,
  },
  {
    id: 'quiz_weapons_1',
    question: 'What does MAD stand for in nuclear deterrence theory?',
    options: ['Military Armed Defense', 'Mutually Assured Destruction', 'Maximum Atomic Detonation', 'Multi-Arsenal Deployment'],
    correctIndex: 1,
    explanation: 'MAD (Mutually Assured Destruction) is the doctrine that nuclear weapons prevent war because any nuclear attack would result in the complete destruction of both sides.',
    relatedTopic: 'weapons_deterrence',
    rewardKnowledgePoints: 25,
  },
  {
    id: 'quiz_solar_2',
    question: 'What is the approximate solar constant (power per square meter at Earth orbit)?',
    options: ['500 W/m²', '1,000 W/m²', '1,361 W/m²', '2,500 W/m²'],
    correctIndex: 2,
    explanation: 'The solar constant is approximately 1,361 watts per square meter at Earth\'s orbital distance from the Sun.',
    relatedTopic: 'solar',
    rewardKnowledgePoints: 25,
  },
  {
    id: 'quiz_materials_2',
    question: 'What is the primary composition of steel?',
    options: ['Iron and nickel', 'Iron and carbon', 'Iron and chromium', 'Iron and silicon'],
    correctIndex: 1,
    explanation: 'Steel is an alloy of iron and carbon (0.2-2.1% carbon). The small addition of carbon dramatically increases iron\'s strength and hardness.',
    relatedTopic: 'materials',
    rewardKnowledgePoints: 25,
  },
];

/**
 * Mapping of game events/triggers to educational topics for first-encounter facts.
 */
export const TRIGGER_TOPIC_MAP: Record<string, EducationTopic> = {
  weather_first_encounter: 'solar',
  country_selection: 'geopolitics',
  weapon_manufacturing: 'weapons_deterrence',
  un_event: 'geopolitics',
  alien_signal: 'aliens',
  research_fossil: 'fossil_fuels',
  research_nuclear: 'nuclear',
  research_solar: 'solar',
  research_materials: 'materials',
  research_orbital: 'orbital_mechanics',
  research_dyson: 'dyson_concepts',
  research_mars: 'mars',
  research_weapons: 'weapons_deterrence',
  research_political: 'geopolitics',
  research_space: 'orbital_mechanics',
};

/**
 * Returns all facts for a given topic.
 */
export function getFactsByTopic(topic: EducationTopic): EducationFact[] {
  return EDUCATION_FACTS.filter((f) => f.topic === topic);
}

/**
 * Returns all quizzes for a given topic.
 */
export function getQuizzesByTopic(topic: EducationTopic): Quiz[] {
  return EDUCATION_QUIZZES.filter((q) => q.relatedTopic === topic);
}
