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

// Species translation mapping (English -> Chinese)
export const SPECIES_TRANSLATIONS: Record<string, string> = {
    'largemouth bass': '大口黑鲈',
    'channel catfish': '斑点叉尾鮰',
    'culter fish': '翘嘴鲌',
    'redtail catfish': '红尾鲶',
    'trout': '鳟鱼',
    'carp': '鲤鱼',
    'salmon': '鲑鱼',
    'pike': '狗鱼',
    'perch': '鲈鱼',
    'catfish': '鲶鱼',
    'blank': '无',
    'empty': '无',
    'Unclassified': '未分类',
    'Unidentified': '未识别',
};

/**
 * Translate species name from English to Chinese.
 * Returns original name if no translation is found.
 */
export function translateSpecies(species: string): string {
    if (!species) return species;
    // Check exact match first (case-insensitive)
    const lowerSpecies = species.toLowerCase();
    for (const [key, value] of Object.entries(SPECIES_TRANSLATIONS)) {
        if (key.toLowerCase() === lowerSpecies) {
            return value;
        }
    }
    // Return original if no translation found
    return species;
}

