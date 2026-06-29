export type WeatherCondition = 'sunny' | 'partly_cloudy' | 'overcast' | 'rainy';

export interface WeatherState {
  current: WeatherCondition;
  ticksUntilChange: number;
  changeInterval: number; // configurable ticks between changes
  history: WeatherCondition[]; // last N conditions for pattern
}

export const WEATHER_MODIFIERS: Record<WeatherCondition, number> = {
  sunny: 1.0,
  partly_cloudy: 0.7,
  overcast: 0.4,
  rainy: 0.2,
};
