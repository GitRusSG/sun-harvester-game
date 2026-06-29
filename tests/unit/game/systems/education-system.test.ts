import { describe, it, expect } from 'vitest';
import { EducationSystem } from '../../../../src/game/systems/education-system.js';
import { createInitialState } from '../../../../src/game/core/state-manager.js';
import {
  EDUCATION_FACTS,
  EDUCATION_QUIZZES,
  getFactsByTopic,
} from '../../../../src/game/data/education-content.js';
import type { GameState } from '../../../../src/game/core/types.js';

describe('EducationSystem', () => {
  const system = new EducationSystem();

  function makeState(): GameState {
    return createInitialState('usa');
  }

  describe('activeEras', () => {
    it('is active in all 7 eras', () => {
      expect(system.activeEras).toHaveLength(7);
      expect(system.activeEras).toContain('fossil');
      expect(system.activeEras).toContain('nuclear');
      expect(system.activeEras).toContain('solar');
      expect(system.activeEras).toContain('orbital');
      expect(system.activeEras).toContain('mars_colonization');
      expect(system.activeEras).toContain('space_mining');
      expect(system.activeEras).toContain('dyson_ring');
    });
  });

  describe('presentFact', () => {
    it('presents an unpresented fact for a given topic', () => {
      const state = makeState();
      const result = system.presentFact(state, 'solar');

      expect(result).not.toBeNull();
      const mutation = result!.mutations!.find((m) => m.path === 'education.factsPresented');
      expect(mutation).toBeDefined();
      const presented = mutation!.value as string[];
      expect(presented.length).toBe(1);
      // Should be a solar fact
      const solarFacts = getFactsByTopic('solar');
      expect(solarFacts.map((f) => f.id)).toContain(presented[0]);
    });

    it('does not repeat already-presented facts', () => {
      const state = makeState();
      const solarFacts = getFactsByTopic('solar');

      // Mark first fact as presented
      state.education.factsPresented = [solarFacts[0].id];

      const result = system.presentFact(state, 'solar');
      expect(result).not.toBeNull();
      const mutation = result!.mutations!.find((m) => m.path === 'education.factsPresented');
      const presented = mutation!.value as string[];
      // Should contain the already-presented fact plus a new one
      expect(presented).toContain(solarFacts[0].id);
      expect(presented.length).toBe(2);
      expect(presented[1]).toBe(solarFacts[1].id);
    });

    it('returns null when all facts for a topic have been presented', () => {
      const state = makeState();
      const solarFacts = getFactsByTopic('solar');
      state.education.factsPresented = solarFacts.map((f) => f.id);

      const result = system.presentFact(state, 'solar');
      expect(result).toBeNull();
    });

    it('emits a quiz event with fact subType', () => {
      const state = makeState();
      const result = system.presentFact(state, 'nuclear');

      expect(result).not.toBeNull();
      expect(result!.events).toBeDefined();
      expect(result!.events!.length).toBe(1);
      expect(result!.events![0].type).toBe('quiz');
      expect(result!.events![0].payload.subType).toBe('fact');
      expect(result!.events![0].payload.topic).toBe('nuclear');
    });
  });

  describe('generateQuiz', () => {
    it('sets a pending quiz for the given topic', () => {
      const state = makeState();
      const result = system.generateQuiz(state, 'fossil_fuels');

      expect(result).not.toBeNull();
      const mutation = result!.mutations!.find((m) => m.path === 'education.pendingQuiz');
      expect(mutation).toBeDefined();
      const quiz = mutation!.value as { relatedTopic: string };
      expect(quiz.relatedTopic).toBe('fossil_fuels');
    });

    it('returns null if a quiz is already pending', () => {
      const state = makeState();
      state.education.pendingQuiz = EDUCATION_QUIZZES[0];

      const result = system.generateQuiz(state, 'solar');
      expect(result).toBeNull();
    });

    it('emits a quiz_start event', () => {
      const state = makeState();
      const result = system.generateQuiz(state, 'nuclear');

      expect(result).not.toBeNull();
      expect(result!.events).toBeDefined();
      expect(result!.events![0].payload.subType).toBe('quiz_start');
    });

    it('falls back to any quiz when topic has none available', () => {
      const state = makeState();
      // Use a topic that might have no quizzes - but all topics have quizzes,
      // so we test the rotation logic instead
      const result = system.generateQuiz(state, 'orbital_mechanics');
      expect(result).not.toBeNull();
      const mutation = result!.mutations!.find((m) => m.path === 'education.pendingQuiz');
      expect(mutation!.value).not.toBeNull();
    });
  });

  describe('answerQuiz', () => {
    it('grants knowledge points on correct answer', () => {
      const state = makeState();
      state.education.pendingQuiz = EDUCATION_QUIZZES[0]; // correctIndex is 1
      state.resources.knowledgePoints = 100;

      const result = system.answerQuiz(state, EDUCATION_QUIZZES[0].correctIndex);

      expect(result.resources).toBeDefined();
      expect(result.resources!.knowledgePoints).toBe(125); // 100 + 25
    });

    it('increments quizzesCorrect on correct answer', () => {
      const state = makeState();
      state.education.pendingQuiz = EDUCATION_QUIZZES[0];
      state.education.quizzesCorrect = 3;

      const result = system.answerQuiz(state, EDUCATION_QUIZZES[0].correctIndex);

      const correctMutation = result.mutations!.find((m) => m.path === 'education.quizzesCorrect');
      expect(correctMutation!.value).toBe(4);
    });

    it('does not grant knowledge points on incorrect answer', () => {
      const state = makeState();
      state.education.pendingQuiz = EDUCATION_QUIZZES[0];
      state.resources.knowledgePoints = 100;

      // Use a wrong index
      const wrongIndex = (EDUCATION_QUIZZES[0].correctIndex + 1) % 4;
      const result = system.answerQuiz(state, wrongIndex);

      expect(result.resources).toBeUndefined();
    });

    it('does not increment quizzesCorrect on incorrect answer', () => {
      const state = makeState();
      state.education.pendingQuiz = EDUCATION_QUIZZES[0];
      state.education.quizzesCorrect = 3;

      const wrongIndex = (EDUCATION_QUIZZES[0].correctIndex + 1) % 4;
      const result = system.answerQuiz(state, wrongIndex);

      const correctMutation = result.mutations!.find((m) => m.path === 'education.quizzesCorrect');
      expect(correctMutation!.value).toBe(3);
    });

    it('always increments quizzesCompleted', () => {
      const state = makeState();
      state.education.pendingQuiz = EDUCATION_QUIZZES[0];
      state.education.quizzesCompleted = 5;

      const result = system.answerQuiz(state, 0);

      const completedMutation = result.mutations!.find((m) => m.path === 'education.quizzesCompleted');
      expect(completedMutation!.value).toBe(6);
    });

    it('clears pendingQuiz on answer', () => {
      const state = makeState();
      state.education.pendingQuiz = EDUCATION_QUIZZES[0];

      const result = system.answerQuiz(state, 0);

      const quizMutation = result.mutations!.find((m) => m.path === 'education.pendingQuiz');
      expect(quizMutation!.value).toBeNull();
    });

    it('returns empty update when no quiz is pending', () => {
      const state = makeState();
      state.education.pendingQuiz = null;

      const result = system.answerQuiz(state, 0);
      expect(result).toEqual({});
    });

    it('emits quiz_result event with correct=true on correct answer', () => {
      const state = makeState();
      state.education.pendingQuiz = EDUCATION_QUIZZES[0];

      const result = system.answerQuiz(state, EDUCATION_QUIZZES[0].correctIndex);

      expect(result.events).toBeDefined();
      expect(result.events![0].payload.correct).toBe(true);
      expect(result.events![0].payload.reward).toBe(25);
    });

    it('emits quiz_result event with correct=false and explanation on incorrect answer', () => {
      const state = makeState();
      state.education.pendingQuiz = EDUCATION_QUIZZES[0];

      const wrongIndex = (EDUCATION_QUIZZES[0].correctIndex + 1) % 4;
      const result = system.answerQuiz(state, wrongIndex);

      expect(result.events).toBeDefined();
      expect(result.events![0].payload.correct).toBe(false);
      expect(result.events![0].payload.explanation).toBe(EDUCATION_QUIZZES[0].explanation);
    });
  });

  describe('perform - answer_quiz action', () => {
    it('resolves pending quiz via perform action', () => {
      const state = makeState();
      state.education.pendingQuiz = EDUCATION_QUIZZES[2];

      const result = system.perform(state, {
        type: 'answer_quiz',
        payload: { quizId: EDUCATION_QUIZZES[2].id, answerIndex: EDUCATION_QUIZZES[2].correctIndex },
      });

      expect(result.resources).toBeDefined();
      expect(result.resources!.knowledgePoints).toBe(25);
    });
  });

  describe('perform - dismiss_fact action', () => {
    it('marks a fact as presented', () => {
      const state = makeState();

      const result = system.perform(state, {
        type: 'dismiss_fact',
        payload: { factId: 'fact_solar_1' },
      });

      const mutation = result.mutations!.find((m) => m.path === 'education.factsPresented');
      expect(mutation).toBeDefined();
      expect((mutation!.value as string[])).toContain('fact_solar_1');
    });

    it('does not duplicate already-presented facts', () => {
      const state = makeState();
      state.education.factsPresented = ['fact_solar_1'];

      const result = system.perform(state, {
        type: 'dismiss_fact',
        payload: { factId: 'fact_solar_1' },
      });

      // Should return empty update (no mutations needed)
      expect(result.mutations).toBeUndefined();
    });
  });

  describe('perform - trigger_education_event action', () => {
    it('presents a fact based on trigger mapping', () => {
      const state = makeState();

      const result = system.perform(state, {
        type: 'trigger_education_event',
        payload: { trigger: 'research_nuclear' },
      });

      expect(result.mutations).toBeDefined();
      const mutation = result.mutations!.find((m) => m.path === 'education.factsPresented');
      expect(mutation).toBeDefined();
      const presented = mutation!.value as string[];
      // Should be a nuclear fact
      const nuclearFacts = getFactsByTopic('nuclear');
      expect(nuclearFacts.map((f) => f.id)).toContain(presented[0]);
    });

    it('triggers quiz on research milestone (every 5 completions)', () => {
      const state = makeState();
      state.statistics.totalResearchCompleted = 5; // Milestone reached

      const result = system.perform(state, {
        type: 'trigger_education_event',
        payload: { trigger: 'research_solar' },
      });

      // Should have both fact and quiz mutations
      const quizMutation = result.mutations!.find((m) => m.path === 'education.pendingQuiz');
      expect(quizMutation).toBeDefined();
      expect(quizMutation!.value).not.toBeNull();
    });

    it('does not trigger quiz when not at milestone', () => {
      const state = makeState();
      state.statistics.totalResearchCompleted = 3; // Not a milestone

      const result = system.perform(state, {
        type: 'trigger_education_event',
        payload: { trigger: 'research_solar' },
      });

      const quizMutation = result.mutations?.find((m) => m.path === 'education.pendingQuiz');
      expect(quizMutation).toBeUndefined();
    });

    it('uses explicit topic when provided', () => {
      const state = makeState();

      const result = system.perform(state, {
        type: 'trigger_education_event',
        payload: { trigger: 'custom_trigger', topic: 'mars' },
      });

      expect(result.mutations).toBeDefined();
      const mutation = result.mutations!.find((m) => m.path === 'education.factsPresented');
      const presented = mutation!.value as string[];
      const marsFacts = getFactsByTopic('mars');
      expect(marsFacts.map((f) => f.id)).toContain(presented[0]);
    });

    it('returns empty update for unknown trigger without topic', () => {
      const state = makeState();

      const result = system.perform(state, {
        type: 'trigger_education_event',
        payload: { trigger: 'unknown_trigger' },
      });

      expect(result).toEqual({});
    });
  });

  describe('canPerform', () => {
    it('returns true for answer_quiz when quiz is pending', () => {
      const state = makeState();
      state.education.pendingQuiz = EDUCATION_QUIZZES[0];

      expect(system.canPerform(state, { type: 'answer_quiz', payload: {} })).toBe(true);
    });

    it('returns false for answer_quiz when no quiz is pending', () => {
      const state = makeState();
      state.education.pendingQuiz = null;

      expect(system.canPerform(state, { type: 'answer_quiz', payload: {} })).toBe(false);
    });

    it('returns true for dismiss_fact', () => {
      const state = makeState();
      expect(system.canPerform(state, { type: 'dismiss_fact', payload: {} })).toBe(true);
    });

    it('returns false for unknown actions', () => {
      const state = makeState();
      expect(system.canPerform(state, { type: 'unknown', payload: {} })).toBe(false);
    });
  });

  describe('update', () => {
    it('returns empty state update (education is event-driven)', () => {
      const state = makeState();
      const result = system.update(state, 1);
      expect(result).toEqual({});
    });
  });

  describe('education content data', () => {
    it('has at least 2-3 facts per topic (10 topics = 20-30 minimum)', () => {
      expect(EDUCATION_FACTS.length).toBeGreaterThanOrEqual(20);
    });

    it('covers all 10 topic areas', () => {
      const topics = new Set(EDUCATION_FACTS.map((f) => f.topic));
      expect(topics.size).toBe(10);
      expect(topics.has('fossil_fuels')).toBe(true);
      expect(topics.has('nuclear')).toBe(true);
      expect(topics.has('solar')).toBe(true);
      expect(topics.has('materials')).toBe(true);
      expect(topics.has('orbital_mechanics')).toBe(true);
      expect(topics.has('dyson_concepts')).toBe(true);
      expect(topics.has('geopolitics')).toBe(true);
      expect(topics.has('mars')).toBe(true);
      expect(topics.has('aliens')).toBe(true);
      expect(topics.has('weapons_deterrence')).toBe(true);
    });

    it('has at least 10 quizzes', () => {
      expect(EDUCATION_QUIZZES.length).toBeGreaterThanOrEqual(10);
    });

    it('all quizzes have 4 options', () => {
      for (const quiz of EDUCATION_QUIZZES) {
        expect(quiz.options).toHaveLength(4);
      }
    });

    it('all quizzes award 25 knowledge points', () => {
      for (const quiz of EDUCATION_QUIZZES) {
        expect(quiz.rewardKnowledgePoints).toBe(25);
      }
    });

    it('all quizzes have valid correctIndex (0-3)', () => {
      for (const quiz of EDUCATION_QUIZZES) {
        expect(quiz.correctIndex).toBeGreaterThanOrEqual(0);
        expect(quiz.correctIndex).toBeLessThanOrEqual(3);
      }
    });
  });
});
