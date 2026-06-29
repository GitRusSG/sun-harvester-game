import type { GameState, GameAction, StateUpdate, Era } from '../core/types.js';
import type { EducationState } from '../core/education.js';
import {
  EDUCATION_QUIZZES,
  TRIGGER_TOPIC_MAP,
  getFactsByTopic,
  getQuizzesByTopic,
} from '../data/education-content.js';
import type { EducationTopic } from '../data/education-content.js';

/**
 * The number of research completions between quiz triggers.
 */
const QUIZ_MILESTONE_INTERVAL = 5;

/**
 * EducationSystem manages educational fact presentation and quizzes.
 *
 * - Presents facts on research node unlock, milestone completion, and first encounters
 * - Generates quizzes every 5 research completions
 * - Awards bonus knowledge points for correct quiz answers (25 points)
 * - Active in all eras
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 7.4, 12.7, 14.6, 15.4, 16.7, 17.7, 18.7, 19.7, 20.7, 21.6, 22.7, 23.8
 */
export class EducationSystem {
  readonly id = 'education';

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
   * Processes ticks. Checks for events from other systems and triggers
   * fact presentation or quiz generation when appropriate.
   *
   * The education system reacts to events gathered from other systems
   * (research_complete, era_unlock, weather_change, alien_signal, etc.)
   * This is typically driven by the game loop passing events collected in the current tick.
   */
  update(_state: GameState, _deltaTicks: number): StateUpdate {
    // The education system is primarily reactive — it responds to events
    // through the event-driven triggers handled by processEvents().
    // The update() tick is a no-op; all logic is triggered by perform() actions
    // or by the game loop calling processEvents after collecting events.
    return {};
  }

  /**
   * Checks if a specific action can be performed.
   */
  canPerform(state: GameState, action: GameAction): boolean {
    switch (action.type) {
      case 'answer_quiz':
        return state.education.pendingQuiz !== null;
      case 'dismiss_fact':
        return true;
      case 'trigger_education_event':
        return true;
      default:
        return false;
    }
  }

  /**
   * Executes a player action.
   *
   * Actions:
   * - 'answer_quiz': { quizId, answerIndex } — resolve pending quiz
   * - 'dismiss_fact': { factId } — mark fact as presented
   * - 'trigger_education_event': { trigger, topic? } — trigger fact/quiz from game events
   */
  perform(state: GameState, action: GameAction): StateUpdate {
    switch (action.type) {
      case 'answer_quiz':
        return this.handleAnswerQuiz(state, action.payload as { quizId: string; answerIndex: number });
      case 'dismiss_fact':
        return this.handleDismissFact(state, action.payload as { factId: string });
      case 'trigger_education_event':
        return this.handleTriggerEvent(state, action.payload as { trigger: string; topic?: EducationTopic });
      default:
        return {};
    }
  }

  /**
   * Finds an unpresented fact for the given topic, marks it as presented,
   * and returns a state update with the fact added to factsPresented.
   * Returns null if all facts for the topic have already been presented.
   */
  presentFact(state: GameState, topic: EducationTopic): StateUpdate | null {
    const topicFacts = getFactsByTopic(topic);
    const unpresented = topicFacts.filter(
      (f) => !state.education.factsPresented.includes(f.id)
    );

    if (unpresented.length === 0) return null;

    const fact = unpresented[0];
    const newFactsPresented = [...state.education.factsPresented, fact.id];

    return {
      mutations: [
        { path: 'education.factsPresented', value: newFactsPresented },
      ],
      events: [
        {
          id: `fact_presented_${fact.id}`,
          type: 'quiz' as const,
          payload: { subType: 'fact', factId: fact.id, content: fact.content, topic },
          timestamp: Date.now(),
        },
      ],
    };
  }

  /**
   * Picks a quiz for the given topic and sets it as the pending quiz.
   * Returns null if no quizzes are available or one is already pending.
   */
  generateQuiz(state: GameState, topic: EducationTopic): StateUpdate | null {
    if (state.education.pendingQuiz !== null) return null;

    const topicQuizzes = getQuizzesByTopic(topic);
    if (topicQuizzes.length === 0) {
      // Fall back to any available quiz
      return this.generateQuizFromAll(state);
    }

    // Pick a quiz not recently completed (simple: pick first available)
    const quiz = topicQuizzes[state.education.quizzesCompleted % topicQuizzes.length];

    return {
      mutations: [
        { path: 'education.pendingQuiz', value: quiz },
      ],
      events: [
        {
          id: `quiz_generated_${quiz.id}`,
          type: 'quiz' as const,
          payload: { subType: 'quiz_start', quizId: quiz.id, question: quiz.question },
          timestamp: Date.now(),
        },
      ],
    };
  }

  /**
   * Resolves the pending quiz based on the player's answer.
   * - Correct: grants knowledge points, increments quizzesCorrect
   * - Incorrect: no points granted (UI shows explanation)
   * - Always: increments quizzesCompleted, clears pendingQuiz
   */
  answerQuiz(state: GameState, answerIndex: number): StateUpdate {
    const quiz = state.education.pendingQuiz;
    if (!quiz) return {};

    const isCorrect = answerIndex === quiz.correctIndex;
    const newQuizzesCompleted = state.education.quizzesCompleted + 1;
    const newQuizzesCorrect = state.education.quizzesCorrect + (isCorrect ? 1 : 0);

    const mutations = [
      { path: 'education.pendingQuiz', value: null },
      { path: 'education.quizzesCompleted', value: newQuizzesCompleted },
      { path: 'education.quizzesCorrect', value: newQuizzesCorrect },
    ];

    const update: StateUpdate = { mutations, events: [] };

    if (isCorrect) {
      // Grant bonus knowledge points
      const newKnowledge = state.resources.knowledgePoints + quiz.rewardKnowledgePoints;
      update.resources = { knowledgePoints: newKnowledge };
      update.events = [
        {
          id: `quiz_correct_${quiz.id}`,
          type: 'quiz' as const,
          payload: {
            subType: 'quiz_result',
            quizId: quiz.id,
            correct: true,
            reward: quiz.rewardKnowledgePoints,
          },
          timestamp: Date.now(),
        },
      ];
    } else {
      update.events = [
        {
          id: `quiz_incorrect_${quiz.id}`,
          type: 'quiz' as const,
          payload: {
            subType: 'quiz_result',
            quizId: quiz.id,
            correct: false,
            explanation: quiz.explanation,
          },
          timestamp: Date.now(),
        },
      ];
    }

    return update;
  }

  /**
   * Handles the 'answer_quiz' action.
   */
  private handleAnswerQuiz(state: GameState, payload: { quizId: string; answerIndex: number }): StateUpdate {
    return this.answerQuiz(state, payload.answerIndex);
  }

  /**
   * Handles the 'dismiss_fact' action by marking the fact as presented.
   */
  private handleDismissFact(state: GameState, payload: { factId: string }): StateUpdate {
    if (state.education.factsPresented.includes(payload.factId)) {
      return {};
    }

    const newFactsPresented = [...state.education.factsPresented, payload.factId];
    return {
      mutations: [
        { path: 'education.factsPresented', value: newFactsPresented },
      ],
    };
  }

  /**
   * Handles educational event triggers from other systems.
   * Determines the topic from the trigger, presents a fact, and
   * triggers a quiz if a milestone is reached.
   */
  private handleTriggerEvent(state: GameState, payload: { trigger: string; topic?: EducationTopic }): StateUpdate {
    const topic = payload.topic ?? TRIGGER_TOPIC_MAP[payload.trigger];
    if (!topic) return {};

    // Present a fact for the topic
    const factUpdate = this.presentFact(state, topic);
    if (!factUpdate) return {};

    // Check if we should trigger a quiz (every QUIZ_MILESTONE_INTERVAL research completions)
    const isResearchTrigger = payload.trigger.startsWith('research_');
    if (isResearchTrigger) {
      const totalResearch = state.statistics.totalResearchCompleted;
      if (totalResearch > 0 && totalResearch % QUIZ_MILESTONE_INTERVAL === 0) {
        // Apply fact update first, then generate quiz on updated state
        const updatedEducation: EducationState = {
          ...state.education,
          factsPresented: factUpdate.mutations
            ? (factUpdate.mutations.find((m) => m.path === 'education.factsPresented')?.value as string[] ?? state.education.factsPresented)
            : state.education.factsPresented,
        };
        const quizState = { ...state, education: updatedEducation };
        const quizUpdate = this.generateQuiz(quizState, topic);

        if (quizUpdate) {
          // Merge fact and quiz updates
          return {
            mutations: [
              ...(factUpdate.mutations ?? []),
              ...(quizUpdate.mutations ?? []),
            ],
            events: [
              ...(factUpdate.events ?? []),
              ...(quizUpdate.events ?? []),
            ],
          };
        }
      }
    }

    return factUpdate;
  }

  /**
   * Generates a quiz from the full pool when topic-specific quizzes are unavailable.
   */
  private generateQuizFromAll(state: GameState): StateUpdate | null {
    if (state.education.pendingQuiz !== null) return null;
    if (EDUCATION_QUIZZES.length === 0) return null;

    const quiz = EDUCATION_QUIZZES[state.education.quizzesCompleted % EDUCATION_QUIZZES.length];

    return {
      mutations: [
        { path: 'education.pendingQuiz', value: quiz },
      ],
      events: [
        {
          id: `quiz_generated_${quiz.id}`,
          type: 'quiz' as const,
          payload: { subType: 'quiz_start', quizId: quiz.id, question: quiz.question },
          timestamp: Date.now(),
        },
      ],
    };
  }
}
