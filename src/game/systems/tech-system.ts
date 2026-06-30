import type { GameState, GameAction, StateUpdate, Era, GameEvent, StateMutation } from '../core/types.js';
import type { TechTreeId, TechNode, TechNodeState, SynergyBonus, ActiveResearch } from '../core/research.js';
import { TECH_TREE_NODES, getTechNodeById, getTreeNodes, calculateSynergies } from '../data/tech-trees.js';

/**
 * TechSystem manages the five research trees (energy, materials, weapons, political, space).
 *
 * Responsibilities:
 * - Track node status transitions: locked → available → researching → completed
 * - Allow only one active research at a time
 * - Deduct currency + knowledge points when starting research
 * - Progress research each tick and emit research_complete on finish
 * - Calculate cross-tree synergy cost reductions
 *
 * Active in all eras.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export class TechSystem {
  readonly id = 'tech';

  readonly activeEras: Era[] = [
    'fossil',
    'nuclear',
    'solar',
    'orbital',
    'mars_colonization',
    'space_mining',
    'dyson_ring',
  ];

  /**
   * Returns all nodes in a given tree that are available for research,
   * i.e. all prerequisites are completed and the node is not already
   * researching or completed.
   */
  getAvailableNodes(state: GameState, tree: TechTreeId): TechNode[] {
    const treeNodes = getTreeNodes(tree);
    const treeState = state.research.trees[tree];

    return treeNodes.filter((node) => {
      const nodeState = treeState.nodes[node.id];
      // If node state exists in state, check its status
      if (nodeState) {
        return nodeState.status === 'available';
      }
      // Otherwise derive from definition: available if no prerequisites or all met
      return this.arePrerequisitesMet(state, node);
    });
  }

  /**
   * Starts research on a node. Deducts currency and knowledge points,
   * sets the node to 'researching', and sets currentResearch.
   * Returns empty update if research cannot start (already researching,
   * insufficient funds, or node unavailable).
   */
  startResearch(state: GameState, nodeId: string): StateUpdate {
    // Only one research at a time
    if (state.research.currentResearch !== null) {
      return {};
    }

    const node = getTechNodeById(nodeId);
    if (!node) return {};

    // Check node is available
    const treeState = state.research.trees[node.tree];
    const nodeState = treeState.nodes[nodeId];
    const effectiveStatus = nodeState?.status ?? (this.arePrerequisitesMet(state, node) ? 'available' : 'locked');

    if (effectiveStatus !== 'available') {
      return {};
    }

    // Apply synergy cost reductions
    const synergies = this.getCrossSynergies(state, nodeId);
    let currencyCost = node.cost.currency;
    let knowledgeCost = node.cost.knowledge;

    for (const synergy of synergies) {
      currencyCost = Math.floor(currencyCost * synergy.costReduction);
      knowledgeCost = Math.floor(knowledgeCost * synergy.costReduction);
    }

    // Check affordability
    if (state.resources.currency < currencyCost) return {};
    if (state.resources.knowledgePoints < knowledgeCost) return {};

    // Deduct costs and start research
    const activeResearch: ActiveResearch = {
      nodeId,
      treeId: node.tree,
      startTick: 0,
      remainingTicks: node.researchTime,
    };

    const mutations: StateMutation[] = [
      { path: `research.trees.${node.tree}.nodes.${nodeId}`, value: { status: 'researching', progress: 0 } satisfies TechNodeState },
      { path: 'research.currentResearch', value: activeResearch },
    ];

    return {
      resources: {
        currency: state.resources.currency - currencyCost,
        knowledgePoints: state.resources.knowledgePoints - knowledgeCost,
      },
      mutations,
    };
  }

  /**
   * Calculates cross-tree synergy bonuses applicable to a given node.
   * Synergies are based on the number of completed nodes in related trees.
   */
  getCrossSynergies(state: GameState, nodeId: string): SynergyBonus[] {
    const node = getTechNodeById(nodeId);
    if (!node) return [];

    // Count completed nodes per tree
    const completedByTree = this.countCompletedByTree(state);

    return calculateSynergies(completedByTree, node.tree);
  }

  /**
   * Processes ticks for active research. Decrements remainingTicks.
   * When research completes: marks node as completed, clears currentResearch,
   * emits research_complete event, updates dependent node availability.
   */
  update(state: GameState, deltaTicks: number): StateUpdate {
    const current = state.research.currentResearch;
    if (!current) return {};

    // Apply research speed multiplier (stored in localStorage by upgrade system).
    let speedMultiplier = 1.0;
    try { const r = localStorage.getItem('shg_research_speed'); if (r) speedMultiplier = parseFloat(r) || 1.0; } catch { /* */ }
    const effectiveDelta = deltaTicks * speedMultiplier;
    const remaining = current.remainingTicks - effectiveDelta;

    if (remaining > 0) {
      // Research still in progress, update remaining ticks and progress
      const node = getTechNodeById(current.nodeId);
      const progress = node ? node.researchTime - remaining : 0;

      return {
        mutations: [
          { path: 'research.currentResearch', value: { ...current, remainingTicks: remaining } },
          { path: `research.trees.${current.treeId}.nodes.${current.nodeId}`, value: { status: 'researching', progress } satisfies TechNodeState },
        ],
      };
    }

    // Research complete!
    const completedNode = getTechNodeById(current.nodeId);
    const mutations: StateMutation[] = [
      { path: `research.trees.${current.treeId}.nodes.${current.nodeId}`, value: { status: 'completed', progress: completedNode?.researchTime ?? 0 } satisfies TechNodeState },
      { path: 'research.currentResearch', value: null },
    ];

    // Update dependent nodes to 'available' if prerequisites are now met
    const dependentMutations = this.unlockDependentNodes(state, current.nodeId, current.treeId);
    mutations.push(...dependentMutations);

    const events: GameEvent[] = [
      {
        id: `research_complete_${current.nodeId}_${Date.now()}`,
        type: 'research_complete',
        payload: {
          nodeId: current.nodeId,
          treeId: current.treeId,
          bonus: completedNode?.bonus ?? null,
        },
        timestamp: Date.now(),
      },
    ];

    return { mutations, events };
  }

  /**
   * Checks if a specific action can be performed by this system.
   * Supports 'start_research' action type.
   */
  canPerform(state: GameState, action: GameAction): boolean {
    if (action.type !== 'start_research') return false;

    const nodeId = action.payload.nodeId as string;
    if (!nodeId) return false;

    // Can't start if already researching
    if (state.research.currentResearch !== null) return false;

    const node = getTechNodeById(nodeId);
    if (!node) return false;

    const treeState = state.research.trees[node.tree];
    const nodeState = treeState.nodes[nodeId];
    const effectiveStatus = nodeState?.status ?? (this.arePrerequisitesMet(state, node) ? 'available' : 'locked');

    if (effectiveStatus !== 'available') return false;

    // Check affordability with synergies
    const synergies = this.getCrossSynergies(state, nodeId);
    let currencyCost = node.cost.currency;
    let knowledgeCost = node.cost.knowledge;
    for (const synergy of synergies) {
      currencyCost = Math.floor(currencyCost * synergy.costReduction);
      knowledgeCost = Math.floor(knowledgeCost * synergy.costReduction);
    }

    return state.resources.currency >= currencyCost && state.resources.knowledgePoints >= knowledgeCost;
  }

  /**
   * Executes a player action. Supports 'start_research'.
   */
  perform(state: GameState, action: GameAction): StateUpdate {
    if (action.type === 'start_research') {
      const nodeId = action.payload.nodeId as string;
      return this.startResearch(state, nodeId);
    }
    return {};
  }

  /**
   * Checks whether all prerequisites for a node are completed.
   */
  private arePrerequisitesMet(state: GameState, node: TechNode): boolean {
    if (node.prerequisites.length === 0) return true;

    for (const prereqId of node.prerequisites) {
      const prereqNode = getTechNodeById(prereqId);
      if (!prereqNode) return false;

      const prereqState = state.research.trees[prereqNode.tree].nodes[prereqId];
      if (!prereqState || prereqState.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * After completing a node, check all nodes in all trees to see if any
   * now have their prerequisites met and should be unlocked to 'available'.
   */
  private unlockDependentNodes(state: GameState, completedNodeId: string, _completedTree: TechTreeId): StateMutation[] {
    const mutations: StateMutation[] = [];

    // Create a temporary state that includes the just-completed node
    // for prerequisite checking
    const tempState = this.createTempStateWithCompletion(state, completedNodeId, _completedTree);

    for (const node of TECH_TREE_NODES) {
      // Skip if this node doesn't list the completed node as a prerequisite
      if (!node.prerequisites.includes(completedNodeId)) continue;

      const nodeState = tempState.research.trees[node.tree].nodes[node.id];
      // Skip if already available, researching, or completed
      if (nodeState && nodeState.status !== 'locked') continue;

      // Check if all prerequisites are now met
      if (this.arePrerequisitesMet(tempState, node)) {
        mutations.push({
          path: `research.trees.${node.tree}.nodes.${node.id}`,
          value: { status: 'available', progress: 0 } satisfies TechNodeState,
        });
      }
    }

    return mutations;
  }

  /**
   * Creates a temporary state view with the just-completed node marked as completed.
   * Used for checking if dependent nodes should be unlocked.
   */
  private createTempStateWithCompletion(state: GameState, nodeId: string, treeId: TechTreeId): GameState {
    const node = getTechNodeById(nodeId);
    if (!node) return state;

    const updatedTreeState = {
      ...state.research.trees[treeId],
      nodes: {
        ...state.research.trees[treeId].nodes,
        [nodeId]: { status: 'completed' as const, progress: node.researchTime },
      },
    };

    return {
      ...state,
      research: {
        ...state.research,
        trees: {
          ...state.research.trees,
          [treeId]: updatedTreeState,
        },
      },
    };
  }

  /**
   * Counts completed nodes per tree from the current state.
   */
  private countCompletedByTree(state: GameState): Record<TechTreeId, number> {
    const trees: TechTreeId[] = ['energy', 'materials', 'weapons', 'political', 'space'];
    const result = {} as Record<TechTreeId, number>;

    for (const tree of trees) {
      const treeState = state.research.trees[tree];
      let count = 0;
      for (const nodeId of Object.keys(treeState.nodes)) {
        if (treeState.nodes[nodeId]?.status === 'completed') {
          count++;
        }
      }
      result[tree] = count;
    }

    return result;
  }
}
