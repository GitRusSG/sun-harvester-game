// Static game data: countries, eras, recipes, tech trees, weapons, education content, locations
export { COUNTRY_PROFILES, getCountryProfile, getAllCountryIds } from './countries.js';
export { ERA_DEFINITIONS, getEraDefinition, getErasInOrder, areEraConditionsMet } from './eras.js';
export type { EraDefinition, EraUnlockCondition } from './eras.js';
export { LOCATIONS, getLocationById, getLocationsByIrradiance } from './locations.js';
export { RECIPES, getRecipeById } from './recipes.js';
export type { Recipe } from './recipes.js';
export { TECH_TREE_NODES, SYNERGY_RULES, getTechNodeById, getTreeNodes, calculateSynergies } from './tech-trees.js';
export type { SynergyRule } from './tech-trees.js';
export { WEAPON_CATEGORIES, getWeaponCategory, getPowerPerUnit } from './weapons.js';
export type { WeaponCategoryDefinition, WeaponMaterialRequirement } from './weapons.js';
export {
  EDUCATION_FACTS,
  EDUCATION_QUIZZES,
  TRIGGER_TOPIC_MAP,
  getFactsByTopic,
  getQuizzesByTopic,
} from './education-content.js';
export type { EducationFact, EducationTopic } from './education-content.js';
