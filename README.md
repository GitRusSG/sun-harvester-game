# Sun Harvester

A browser-based incremental management game where you progress from coal power to constructing a Dyson Ring around the Sun.

## Play

**[Play online →](https://gitrussg.github.io/sun-harvester-game/)**

## Features

- 7 progression eras: Fossil → Nuclear → Solar → Orbital → Mars → Space Mining → Dyson Ring
- 12 game systems: Weather, Resources, Supply Chain, Tech, Weapons, Political, Opposition, Alien, Space, Mars, Dyson, Education
- 10 playable countries with unique buffs and strategies
- 3D solar system view with celestial body navigation (Three.js)
- 30 educational facts and 12 quizzes about energy, space, and geopolitics
- Offline earnings (up to 24h)
- Save/load with localStorage + manual JSON export/import
- Full keyboard navigation and WCAG 2.1 AA accessibility

## Tech Stack

- TypeScript + Vite
- Three.js for 3D rendering
- Vitest for testing (600+ tests)
- GitHub Pages deployment

## Development

```bash
npm install
npm run dev      # Start dev server
npm test         # Run all tests
npm run build    # Production build
```

## Architecture

The game uses an ECS-inspired architecture with a central game loop, modular systems, and a renderer interface that allows swapping between DOM and Three.js backends without touching game logic.

```
src/game/
├── core/       # Game loop, state manager, event controller, types
├── systems/    # 12 independent game systems
├── data/       # Static data (countries, eras, recipes, tech trees)
├── ui/         # Renderer interface + DOM/Three.js implementations
└── utils/      # Formatting, ID generation
```
