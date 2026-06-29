import type { GameState, GameAction, StateUpdate, Era, GameEvent, StateMutation } from '../core/types.js';
import type { MaterialType } from '../core/resources.js';
import type { MaterialRequirement } from '../core/infrastructure.js';
import type { DysonSegment } from '../core/space.js';
import { generateId } from '../utils/id.js';

/**
 * Default Dyson Ring segments with material requirements.
 */
const DEFAULT_SEGMENTS: Array<{ name: string; requirements: MaterialRequirement[] }> = [
  {
    name: 'Foundation Arc',
    requirements: [
      { material: 'steel', quantity: 100 },
      { material: 'advanced_circuits', quantity: 50 },
    ],
  },
  {
    name: 'Energy Collector Array',
    requirements: [
      { material: 'solar_cells', quantity: 150 },
      { material: 'electronics', quantity: 80 },
    ],
  },
  {
    name: 'Structural Ring',
    requirements: [
      { material: 'steel', quantity: 200 },
      { material: 'rare_earth', quantity: 100 },
    ],
  },
  {
    name: 'Power Distribution Grid',
    requirements: [
      { material: 'advanced_circuits', quantity: 120 },
      { material: 'electronics', quantity: 80 },
      { material: 'fuel_rods', quantity: 60 },
    ],
  },
  {
    name: 'Solar Harvester Crown',
    requirements: [
      { material: 'steel', quantity: 250 },
      { material: 'advanced_circuits', quantity: 150 },
      { material: 'solar_cells', quantity: 100 },
    ],
  },
];

/**
 * DysonSystem manages Dyson Ring construction as the end-game megastructure.
 *
 * Responsibilities:
 * - Initialize 5 segments with material requirements on first activation
 * - Track segment completion progress
 * - Calculate energy multiplier proportional to completed segments (1.0 + completedSegments * 0.5)
 * - Trigger victory event when all segments are completed
 *
 * Active from Dyson Ring Era only.
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.5
 */
export class DysonSystem {
  readonly id = 'dyson';

  readonly activeEras: Era[] = ['dyson_ring'];

  /**
   * Main update loop:
   * - On first activation (unlocked=false), initialize segments
   * - Recalculate energyMultiplier based on completed segments
   */
  update(state: GameState, _deltaTicks: number): StateUpdate {
    const mutations: StateMutation[] = [];

    // Initialize segments on first activation
    if (!state.dyson.unlocked) {
      const segments: DysonSegment[] = DEFAULT_SEGMENTS.map((seg, index) => ({
        id: `dyson_segment_${index + 1}`,
        name: seg.name,
        requirements: [...seg.requirements],
        progress: 0,
        completed: false,
      }));

      mutations.push(
        { path: 'dyson.unlocked', value: true },
        { path: 'dyson.segments', value: segments },
        { path: 'dyson.totalSegments', value: segments.length },
        { path: 'dyson.completedSegments', value: 0 },
        { path: 'dyson.energyMultiplier', value: 1.0 },
        { path: 'dyson.victoryAchieved', value: false },
      );

      return { mutations };
    }

    // Recalculate energy multiplier
    const energyMultiplier = 1.0 + state.dyson.completedSegments * 0.5;
    if (energyMultiplier !== state.dyson.energyMultiplier) {
      mutations.push({ path: 'dyson.energyMultiplier', value: energyMultiplier });
    }

    if (mutations.length === 0) return {};
    return { mutations };
  }

  /**
   * Checks if a specific action is valid given the current state.
   */
  canPerform(state: GameState, action: GameAction): boolean {
    switch (action.type) {
      case 'contribute_to_segment':
        return this.canContributeToSegment(state, action.payload);
      default:
        return false;
    }
  }

  /**
   * Executes a player action.
   */
  perform(state: GameState, action: GameAction): StateUpdate {
    switch (action.type) {
      case 'contribute_to_segment':
        return this.contributeToSegment(state, action.payload);
      default:
        return {};
    }
  }

  // --- Private helpers ---

  private canContributeToSegment(state: GameState, payload: Record<string, unknown>): boolean {
    if (!state.dyson.unlocked) return false;

    const segmentId = payload.segmentId as string;
    const materials = payload.materials as Record<string, number> | undefined;

    if (!segmentId || !materials) return false;

    // Find the segment
    const segment = state.dyson.segments.find((s) => s.id === segmentId);
    if (!segment || segment.completed) return false;

    // Check player has all specified materials
    for (const [material, amount] of Object.entries(materials)) {
      if (amount <= 0) return false;
      const stockpile = state.materials.stockpiles[material as MaterialType] ?? 0;
      if (stockpile < amount) return false;
    }

    // Check that at least one contributed material is actually required by this segment
    const requiredMaterials = new Set(segment.requirements.map((r) => r.material));
    const hasRelevantMaterial = Object.keys(materials).some((m) => requiredMaterials.has(m as MaterialType));
    if (!hasRelevantMaterial) return false;

    return true;
  }

  private contributeToSegment(state: GameState, payload: Record<string, unknown>): StateUpdate {
    if (!this.canContributeToSegment(state, payload)) return {};

    const segmentId = payload.segmentId as string;
    const contributedMaterials = payload.materials as Record<string, number>;

    const segment = state.dyson.segments.find((s) => s.id === segmentId)!;
    const segmentIndex = state.dyson.segments.indexOf(segment);

    const mutations: StateMutation[] = [];
    const events: GameEvent[] = [];

    // Deduct materials from player stockpiles
    const newStockpiles = { ...state.materials.stockpiles };
    for (const [material, amount] of Object.entries(contributedMaterials)) {
      newStockpiles[material as MaterialType] = (newStockpiles[material as MaterialType] ?? 0) - amount;
    }

    // Calculate new progress based on percentage of total requirements met
    // Progress = average percentage of each requirement fulfilled (cumulative)
    const newSegments = [...state.dyson.segments];
    const updatedSegment = { ...segment, requirements: [...segment.requirements] };

    // For progress calculation, we need to track how much has been contributed
    // Progress is based on the ratio of contributed materials to total required
    // We calculate the minimum fulfillment percentage across all required materials
    // But actually per spec: "progress based on percentage of total requirements met"
    // We'll calculate as average fulfillment across all requirements

    // First, calculate the total "value" of all requirements (sum of all quantities)
    const totalRequirementValue = segment.requirements.reduce((sum, req) => sum + req.quantity, 0);

    // Calculate how much of the contributed materials apply to requirements
    let contributedValue = 0;
    for (const req of segment.requirements) {
      const contributed = contributedMaterials[req.material] ?? 0;
      // Cap contribution to what's actually needed (considering existing progress)
      const alreadyFilled = (segment.progress / 100) * req.quantity;
      const remaining = req.quantity - alreadyFilled;
      const effective = Math.min(contributed, remaining);
      contributedValue += effective;
    }

    // New progress as a percentage
    const progressIncrease = (contributedValue / totalRequirementValue) * 100;
    const newProgress = Math.min(100, segment.progress + progressIncrease);
    updatedSegment.progress = newProgress;

    const wasCompleted = segment.completed;
    if (newProgress >= 100 && !wasCompleted) {
      updatedSegment.completed = true;
    }

    newSegments[segmentIndex] = updatedSegment;

    mutations.push({ path: 'dyson.segments', value: newSegments });

    // Handle segment completion
    let newCompletedSegments = state.dyson.completedSegments;
    if (updatedSegment.completed && !wasCompleted) {
      newCompletedSegments += 1;
      mutations.push({ path: 'dyson.completedSegments', value: newCompletedSegments });

      // Update energy multiplier
      const newMultiplier = 1.0 + newCompletedSegments * 0.5;
      mutations.push({ path: 'dyson.energyMultiplier', value: newMultiplier });

      events.push({
        id: generateId(),
        type: 'dyson_segment_complete',
        payload: { segmentId, segmentName: updatedSegment.name, completedSegments: newCompletedSegments },
        timestamp: Date.now(),
      });

      // Check victory condition: all segments complete
      if (newCompletedSegments >= state.dyson.totalSegments) {
        mutations.push({ path: 'dyson.victoryAchieved', value: true });
        events.push({
          id: generateId(),
          type: 'victory',
          payload: { totalSegments: state.dyson.totalSegments },
          timestamp: Date.now(),
        });
      }
    }

    return {
      materials: { stockpiles: newStockpiles },
      mutations,
      events: events.length > 0 ? events : undefined,
    };
  }
}
