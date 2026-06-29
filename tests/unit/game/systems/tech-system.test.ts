import { describe, it, expect } from 'vitest';
import { TechSystem } from '../../../../src/game/systems/tech-system.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import { TECH_TREE_NODES, getTechNodeById, getTreeNodes } from '../../../../src/game/data/tech-trees.js';
import type { GameState } from '../../../../src/game/core/types.js';
import type { TechNodeState } from '../../../../src/game/core/research.js';

describe('TechSystem', () => {
  const system = new TechSystem();

  function createStateWithFunds(currency = 10000, knowledge = 1000): GameState {
    const state = createInitialState('usa');
    state.resources.currency = currency;
    state.resources.knowledgePoints = knowledge;
    return state;
  }

  describe('activeEras', () => {
    it('is active in all 7 eras', () => {
      expect(system.activeEras).toHaveLength(7);
      expect(system.activeEras).toContain('fossil');
      expect(system.activeEras).toContain('dyson_ring');
    });
  });

  describe('getAvailableNodes', () => {
    it('returns tier-1 nodes with no prerequisites as available', () => {
      const state = createStateWithFunds();
      const available = system.getAvailableNodes(state, 'energy');

      // Tier 1 energy nodes have no prerequisites
      expect(available.length).toBeGreaterThanOrEqual(2);
      const ids = available.map((n) => n.id);
      expect(ids).toContain('energy_efficiency_1');
      expect(ids).toContain('energy_storage_1');
    });

    it('does not return nodes with unmet prerequisites', () => {
      const state = createStateWithFunds();
      const available = system.getAvailableNodes(state, 'energy');
      const ids = available.map((n) => n.id);

      // energy_nuclear_1 requires energy_efficiency_1
      expect(ids).not.toContain('energy_nuclear_1');
    });

    it('returns nodes whose prerequisites are completed', () => {
      const state = createStateWithFunds();
      // Mark energy_efficiency_1 as completed
      state.research.trees.energy.nodes['energy_efficiency_1'] = {
        status: 'completed',
        progress: 30,
      };

      const available = system.getAvailableNodes(state, 'energy');
      const ids = available.map((n) => n.id);

      // energy_nuclear_1 depends only on energy_efficiency_1
      expect(ids).toContain('energy_nuclear_1');
    });

    it('does not return researching or completed nodes', () => {
      const state = createStateWithFunds();
      state.research.trees.energy.nodes['energy_efficiency_1'] = {
        status: 'researching',
        progress: 10,
      };

      const available = system.getAvailableNodes(state, 'energy');
      const ids = available.map((n) => n.id);
      expect(ids).not.toContain('energy_efficiency_1');
    });

    it('returns available nodes for all five trees', () => {
      const state = createStateWithFunds();
      const trees = ['energy', 'materials', 'weapons', 'political', 'space'] as const;

      for (const tree of trees) {
        const available = system.getAvailableNodes(state, tree);
        expect(available.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('startResearch', () => {
    it('deducts currency and knowledge points', () => {
      const state = createStateWithFunds(10000, 1000);
      const node = getTechNodeById('energy_efficiency_1')!;

      const update = system.startResearch(state, 'energy_efficiency_1');

      expect(update.resources).toBeDefined();
      expect(update.resources!.currency).toBe(10000 - node.cost.currency);
      expect(update.resources!.knowledgePoints).toBe(1000 - node.cost.knowledge);
    });

    it('sets node status to researching', () => {
      const state = createStateWithFunds();
      const update = system.startResearch(state, 'energy_efficiency_1');

      expect(update.mutations).toBeDefined();
      const nodeMutation = update.mutations!.find(
        (m) => m.path === 'research.trees.energy.nodes.energy_efficiency_1'
      );
      expect(nodeMutation).toBeDefined();
      expect((nodeMutation!.value as TechNodeState).status).toBe('researching');
    });

    it('sets currentResearch with correct values', () => {
      const state = createStateWithFunds();
      const node = getTechNodeById('energy_efficiency_1')!;

      const update = system.startResearch(state, 'energy_efficiency_1');

      const currentMutation = update.mutations!.find(
        (m) => m.path === 'research.currentResearch'
      );
      expect(currentMutation).toBeDefined();
      const research = currentMutation!.value as { nodeId: string; treeId: string; remainingTicks: number };
      expect(research.nodeId).toBe('energy_efficiency_1');
      expect(research.treeId).toBe('energy');
      expect(research.remainingTicks).toBe(node.researchTime);
    });

    it('returns empty update if already researching', () => {
      const state = createStateWithFunds();
      state.research.currentResearch = {
        nodeId: 'energy_storage_1',
        treeId: 'energy',
        startTick: 0,
        remainingTicks: 20,
      };

      const update = system.startResearch(state, 'energy_efficiency_1');
      expect(update).toEqual({});
    });

    it('returns empty update if insufficient currency', () => {
      const state = createStateWithFunds(0, 1000);
      const update = system.startResearch(state, 'energy_efficiency_1');
      expect(update).toEqual({});
    });

    it('returns empty update if insufficient knowledge', () => {
      const state = createStateWithFunds(10000, 0);
      const update = system.startResearch(state, 'energy_efficiency_1');
      expect(update).toEqual({});
    });

    it('returns empty update for locked nodes', () => {
      const state = createStateWithFunds();
      // energy_nuclear_1 requires energy_efficiency_1 to be completed
      const update = system.startResearch(state, 'energy_nuclear_1');
      expect(update).toEqual({});
    });

    it('returns empty update for non-existent node', () => {
      const state = createStateWithFunds();
      const update = system.startResearch(state, 'nonexistent_node');
      expect(update).toEqual({});
    });
  });

  describe('update - research progress', () => {
    it('decrements remaining ticks when research is active', () => {
      const state = createStateWithFunds();
      state.research.currentResearch = {
        nodeId: 'energy_efficiency_1',
        treeId: 'energy',
        startTick: 0,
        remainingTicks: 30,
      };
      state.research.trees.energy.nodes['energy_efficiency_1'] = {
        status: 'researching',
        progress: 0,
      };

      const update = system.update(state, 5);

      const currentMutation = update.mutations!.find(
        (m) => m.path === 'research.currentResearch'
      );
      expect(currentMutation).toBeDefined();
      expect((currentMutation!.value as { remainingTicks: number }).remainingTicks).toBe(25);
    });

    it('returns empty update when no active research', () => {
      const state = createStateWithFunds();
      const update = system.update(state, 5);
      expect(update).toEqual({});
    });

    it('completes research when remaining ticks reach 0', () => {
      const state = createStateWithFunds();
      state.research.currentResearch = {
        nodeId: 'energy_efficiency_1',
        treeId: 'energy',
        startTick: 0,
        remainingTicks: 5,
      };
      state.research.trees.energy.nodes['energy_efficiency_1'] = {
        status: 'researching',
        progress: 25,
      };

      const update = system.update(state, 5);

      // Node should be marked completed
      const nodeMutation = update.mutations!.find(
        (m) => m.path === 'research.trees.energy.nodes.energy_efficiency_1'
      );
      expect(nodeMutation).toBeDefined();
      expect((nodeMutation!.value as TechNodeState).status).toBe('completed');

      // currentResearch should be cleared
      const currentMutation = update.mutations!.find(
        (m) => m.path === 'research.currentResearch'
      );
      expect(currentMutation).toBeDefined();
      expect(currentMutation!.value).toBeNull();
    });

    it('emits research_complete event on completion', () => {
      const state = createStateWithFunds();
      state.research.currentResearch = {
        nodeId: 'energy_efficiency_1',
        treeId: 'energy',
        startTick: 0,
        remainingTicks: 5,
      };
      state.research.trees.energy.nodes['energy_efficiency_1'] = {
        status: 'researching',
        progress: 25,
      };

      const update = system.update(state, 5);

      expect(update.events).toBeDefined();
      expect(update.events!.length).toBe(1);
      const event = update.events![0];
      expect(event.type).toBe('research_complete');
      expect(event.payload.nodeId).toBe('energy_efficiency_1');
      expect(event.payload.treeId).toBe('energy');
      expect(event.payload.bonus).toBeDefined();
    });

    it('unlocks dependent nodes on completion', () => {
      const state = createStateWithFunds();
      state.research.currentResearch = {
        nodeId: 'energy_efficiency_1',
        treeId: 'energy',
        startTick: 0,
        remainingTicks: 1,
      };
      state.research.trees.energy.nodes['energy_efficiency_1'] = {
        status: 'researching',
        progress: 29,
      };

      const update = system.update(state, 1);

      // energy_nuclear_1 depends on energy_efficiency_1, should be unlocked
      const unlockMutation = update.mutations!.find(
        (m) => m.path === 'research.trees.energy.nodes.energy_nuclear_1'
      );
      expect(unlockMutation).toBeDefined();
      expect((unlockMutation!.value as TechNodeState).status).toBe('available');
    });
  });

  describe('getCrossSynergies', () => {
    it('returns empty array when no synergies are active', () => {
      const state = createStateWithFunds();
      const synergies = system.getCrossSynergies(state, 'space_orbital_1');
      expect(synergies).toEqual([]);
    });

    it('returns energy→space synergy when energy tree has enough completions', () => {
      const state = createStateWithFunds();
      // Complete 2 energy nodes to activate synergy
      state.research.trees.energy.nodes['energy_efficiency_1'] = { status: 'completed', progress: 30 };
      state.research.trees.energy.nodes['energy_storage_1'] = { status: 'completed', progress: 35 };

      const synergies = system.getCrossSynergies(state, 'space_orbital_1');
      expect(synergies.length).toBe(1);
      expect(synergies[0].sourceTree).toBe('energy');
      expect(synergies[0].targetTree).toBe('space');
      expect(synergies[0].costReduction).toBe(0.9);
    });

    it('returns materials→weapons synergy when materials tree has enough completions', () => {
      const state = createStateWithFunds();
      state.research.trees.materials.nodes['materials_refining_1'] = { status: 'completed', progress: 25 };
      state.research.trees.materials.nodes['materials_silicon_1'] = { status: 'completed', progress: 28 };

      const synergies = system.getCrossSynergies(state, 'weapons_conventional_1');
      expect(synergies.length).toBe(1);
      expect(synergies[0].sourceTree).toBe('materials');
      expect(synergies[0].costReduction).toBe(0.85);
    });

    it('returns political synergy affecting multiple trees', () => {
      const state = createStateWithFunds();
      state.research.trees.political.nodes['political_diplomacy_1'] = { status: 'completed', progress: 30 };
      state.research.trees.political.nodes['political_propaganda_1'] = { status: 'completed', progress: 32 };

      // Political should give 5% reduction to energy, materials, weapons, space
      const energySynergies = system.getCrossSynergies(state, 'energy_efficiency_1');
      expect(energySynergies.length).toBe(1);
      expect(energySynergies[0].costReduction).toBe(0.95);

      const spaceSynergies = system.getCrossSynergies(state, 'space_orbital_1');
      expect(spaceSynergies.length).toBe(1);
      expect(spaceSynergies[0].costReduction).toBe(0.95);
    });

    it('applies synergy cost reduction when starting research', () => {
      const state = createStateWithFunds(10000, 1000);
      // Activate energy→space synergy (10% reduction)
      state.research.trees.energy.nodes['energy_efficiency_1'] = { status: 'completed', progress: 30 };
      state.research.trees.energy.nodes['energy_storage_1'] = { status: 'completed', progress: 35 };

      const node = getTechNodeById('space_orbital_1')!;
      const update = system.startResearch(state, 'space_orbital_1');

      expect(update.resources).toBeDefined();
      // Cost should be reduced by 10%
      const expectedCurrency = 10000 - Math.floor(node.cost.currency * 0.9);
      const expectedKnowledge = 1000 - Math.floor(node.cost.knowledge * 0.9);
      expect(update.resources!.currency).toBe(expectedCurrency);
      expect(update.resources!.knowledgePoints).toBe(expectedKnowledge);
    });
  });

  describe('canPerform', () => {
    it('returns true for valid start_research action', () => {
      const state = createStateWithFunds();
      const result = system.canPerform(state, {
        type: 'start_research',
        payload: { nodeId: 'energy_efficiency_1' },
      });
      expect(result).toBe(true);
    });

    it('returns false when already researching', () => {
      const state = createStateWithFunds();
      state.research.currentResearch = {
        nodeId: 'energy_storage_1',
        treeId: 'energy',
        startTick: 0,
        remainingTicks: 20,
      };

      const result = system.canPerform(state, {
        type: 'start_research',
        payload: { nodeId: 'energy_efficiency_1' },
      });
      expect(result).toBe(false);
    });

    it('returns false for unsupported action types', () => {
      const state = createStateWithFunds();
      const result = system.canPerform(state, {
        type: 'build_solar_panel',
        payload: {},
      });
      expect(result).toBe(false);
    });

    it('returns false for locked nodes', () => {
      const state = createStateWithFunds();
      const result = system.canPerform(state, {
        type: 'start_research',
        payload: { nodeId: 'energy_nuclear_1' },
      });
      expect(result).toBe(false);
    });

    it('returns false when insufficient funds', () => {
      const state = createStateWithFunds(0, 0);
      const result = system.canPerform(state, {
        type: 'start_research',
        payload: { nodeId: 'energy_efficiency_1' },
      });
      expect(result).toBe(false);
    });
  });

  describe('perform', () => {
    it('delegates start_research action to startResearch', () => {
      const state = createStateWithFunds();
      const update = system.perform(state, {
        type: 'start_research',
        payload: { nodeId: 'energy_efficiency_1' },
      });

      expect(update.resources).toBeDefined();
      expect(update.mutations).toBeDefined();
    });

    it('returns empty update for unsupported actions', () => {
      const state = createStateWithFunds();
      const update = system.perform(state, {
        type: 'unknown_action',
        payload: {},
      });
      expect(update).toEqual({});
    });
  });

  describe('tech tree data integrity', () => {
    it('has at least 15 total nodes across all trees', () => {
      expect(TECH_TREE_NODES.length).toBeGreaterThanOrEqual(15);
    });

    it('has at least 3 nodes per tree', () => {
      const trees = ['energy', 'materials', 'weapons', 'political', 'space'] as const;
      for (const tree of trees) {
        const nodes = getTreeNodes(tree);
        expect(nodes.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('all prerequisites reference existing nodes', () => {
      for (const node of TECH_TREE_NODES) {
        for (const prereqId of node.prerequisites) {
          const prereq = getTechNodeById(prereqId);
          expect(prereq).toBeDefined();
        }
      }
    });

    it('all nodes have required fields', () => {
      for (const node of TECH_TREE_NODES) {
        expect(node.id).toBeTruthy();
        expect(node.tree).toBeTruthy();
        expect(node.name).toBeTruthy();
        expect(node.description).toBeTruthy();
        expect(node.educationalContent).toBeTruthy();
        expect(node.tier).toBeGreaterThanOrEqual(1);
        expect(node.cost.currency).toBeGreaterThan(0);
        expect(node.cost.knowledge).toBeGreaterThan(0);
        expect(node.researchTime).toBeGreaterThan(0);
        expect(node.bonus).toBeDefined();
      }
    });
  });
});
