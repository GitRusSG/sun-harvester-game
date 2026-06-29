import type { Renderer, SceneId } from './renderer-interface.js';

/**
 * A single tutorial step shown to the player.
 */
export interface TutorialStep {
  /** Title shown at the top of the tutorial dialog. */
  title: string;
  /** Explanatory text. */
  body: string;
  /** If set, the tutorial navigates to this scene before showing the step. */
  scene?: SceneId;
  /** Button label (defaults to "Next" or "Got it" on the last step). */
  buttonLabel?: string;
}

/**
 * The tutorial sequence shown to first-time players.
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Welcome to Sun Harvester! ☀️',
    body: 'Your goal: progress from primitive coal power all the way to building a Dyson Ring around the Sun. Let\'s show you the basics.',
  },
  {
    title: 'Dashboard',
    body: 'This is your command center. You can see your resources, energy production, weather conditions, and era progress at a glance.',
    scene: 'dashboard',
  },
  {
    title: 'Building Infrastructure',
    body: 'Use your starting currency to build coal power plants and mines. Power plants generate energy (which earns currency), and mines extract raw materials you\'ll need for crafting.',
    scene: 'dashboard',
  },
  {
    title: 'Research',
    body: 'The Research tab has 5 tech trees: Energy, Materials, Weapons, Political, and Space. Unlock new technologies to advance through the eras. You can only research one thing at a time.',
    scene: 'tech',
  },
  {
    title: 'Crafting',
    body: 'Raw materials can be refined into components here. Steel Beams, Solar Cells, Electronics — you\'ll need these to build advanced infrastructure and weapons.',
    scene: 'crafting',
  },
  {
    title: 'World Map',
    body: 'Exert political influence over other nations. Install politicians when influence reaches 75%. Control 5+ countries to achieve World Domination and disable UN sanctions.',
    scene: 'world',
  },
  {
    title: 'Weather Affects Solar',
    body: 'Weather changes every 60 ticks. Sunny gives 100% solar output, while rain drops it to 20%. Plan your energy mix accordingly — coal and nuclear ignore weather.',
    scene: 'dashboard',
  },
  {
    title: '3D Solar System',
    body: 'Click on celestial bodies (Earth, Moon, Mars, Asteroids, Sun) in the 3D view to navigate directly to their management panels. You can also drag to orbit and scroll to zoom.',
    scene: 'earth',
  },
  {
    title: 'Saving',
    body: 'Your game auto-saves every 60 seconds. You can also manually export/import saves from the Settings tab. Offline earnings accumulate for up to 24 hours.',
    scene: 'settings',
  },
  {
    title: 'Ready to Play! 🚀',
    body: 'Build power plants, mine resources, research technologies, and expand to space. The ultimate goal: complete all 5 segments of the Dyson Ring. Good luck!',
    scene: 'dashboard',
    buttonLabel: 'Start Playing',
  },
];

const TUTORIAL_STORAGE_KEY = 'sun_harvester_tutorial_complete';

/**
 * The tutorial controller. Walks the player through the tutorial steps using
 * the renderer's dialog system. Remembers completion in localStorage so it
 * only shows once.
 */
export class TutorialController {
  private currentStep = 0;
  private renderer: Renderer | null = null;
  private active = false;

  /** Whether the tutorial has been completed before (persisted). */
  static isComplete(): boolean {
    try {
      return localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  /** Mark the tutorial as complete. */
  private static markComplete(): void {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors.
    }
  }

  /** Start the tutorial if not previously completed. */
  start(renderer: Renderer): void {
    if (TutorialController.isComplete()) return;
    this.renderer = renderer;
    this.active = true;
    this.currentStep = 0;
    this.showStep();
  }

  /** Force-start the tutorial (e.g. from a "Replay Tutorial" button). */
  forceStart(renderer: Renderer): void {
    this.renderer = renderer;
    this.active = true;
    this.currentStep = 0;
    this.showStep();
  }

  isActive(): boolean {
    return this.active;
  }

  private showStep(): void {
    if (!this.renderer || !this.active) return;
    if (this.currentStep >= TUTORIAL_STEPS.length) {
      this.finish();
      return;
    }

    const step = TUTORIAL_STEPS[this.currentStep];
    const isLast = this.currentStep === TUTORIAL_STEPS.length - 1;

    // Navigate to the relevant scene if specified.
    if (step.scene) {
      this.renderer.setScene(step.scene);
    }

    const buttonLabel = step.buttonLabel ?? (isLast ? 'Got it' : 'Next →');

    this.renderer.showDialog({
      title: step.title,
      body: step.body,
      options: [
        {
          label: buttonLabel,
          action: () => {
            this.currentStep++;
            this.showStep();
          },
        },
        ...(this.currentStep > 0 ? [{
          label: 'Skip Tutorial',
          action: () => this.finish(),
        }] : []),
      ],
    });
  }

  private finish(): void {
    this.active = false;
    TutorialController.markComplete();
    // Navigate back to dashboard.
    this.renderer?.setScene('dashboard');
  }
}
