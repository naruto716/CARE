// Currently supported species for ReID
export const ACTIVE_SPECIES = ['largemouth bass'] as const;

// Species coming in future updates (alphabetical order)
export const FUTURE_SPECIES = [
    'channel catfish',
    'culter fish',
    'redtail catfish'
] as const;

// All species combined
export const ALL_SPECIES = [...ACTIVE_SPECIES, ...FUTURE_SPECIES] as const;

export const DEFAULT_SPECIES = 'largemouth bass';

export type ActiveSpecies = typeof ACTIVE_SPECIES[number];
export type FutureSpecies = typeof FUTURE_SPECIES[number];
export type AllSpecies = typeof ALL_SPECIES[number];
