export const CHAPTERS = {
  "Solar Flare": {
    startDate: new Date("2023-01-01T00:00:00.000Z").getTime(),
    endDate: new Date("2023-05-01T00:00:00.000Z").getTime(),
  },
  "Dawn Breaker": {
    startDate: new Date("2023-05-01T00:00:00.000Z").getTime(),
    endDate: new Date("2023-08-01T00:00:00.000Z").getTime(),
  },
  "Witches' Eve": {
    startDate: new Date("2023-08-01T00:00:00.000Z").getTime(),
    endDate: new Date("2023-11-01T00:00:00.000Z").getTime(),
  },
  "Catch the Kraken": {
    startDate: new Date("2023-11-01T00:00:00.000Z").getTime(),
    endDate: new Date("2024-02-01T00:00:00.000Z").getTime(),
  },
  "Spring Blossom": {
    startDate: new Date("2024-02-01T00:00:00.000Z").getTime(),
    endDate: new Date("2024-05-01T00:00:00.000Z").getTime(),
  },
  "Clash of Factions": {
    startDate: new Date("2024-05-01T00:00:00.000Z").getTime(),
    endDate: new Date("2024-08-01T00:00:00.000Z").getTime(),
  },
  "Pharaoh's Treasure": {
    startDate: new Date("2024-08-01T00:00:00.000Z").getTime(),
    endDate: new Date("2024-11-01T00:00:00.000Z").getTime(),
  },
  "Bull Run": {
    startDate: new Date("2024-11-01T00:00:00.000Z").getTime(),
    endDate: new Date("2025-02-03T00:00:00.000Z").getTime(),
  },
  "Winds of Change": {
    startDate: new Date("2025-02-03T00:00:00.000Z").getTime(),
    endDate: new Date("2025-05-01T00:00:00.000Z").getTime(),
  },
  "Great Bloom": {
    startDate: new Date("2025-05-01T00:00:00.000Z").getTime(),
    endDate: new Date("2025-08-04T00:00:00.000Z").getTime(),
  },
  "Better Together": {
    startDate: new Date("2025-08-04T00:00:00.000Z").getTime(),
    endDate: new Date("2025-11-03T00:00:00.000Z").getTime(),
  },
  "Paw Prints": {
    startDate: new Date("2025-11-03T00:00:00.000Z").getTime(),
    endDate: new Date("2026-02-02T00:00:00.000Z").getTime(),
  },
  "Crabs and Traps": {
    startDate: new Date("2026-02-02T00:00:00.000Z").getTime(),
    endDate: new Date("2026-05-04T00:00:00.000Z").getTime(),
  },
  "Salt Awakening": {
    startDate: new Date("2026-05-04T00:00:00.000Z").getTime(),
    endDate: new Date("2026-08-03T00:00:00.000Z").getTime(),
  },
  "Ascension Age": {
    startDate: new Date("2026-08-03T00:00:00.000Z").getTime(),
    endDate: new Date("2026-11-02T00:00:00.000Z").getTime(),
  }
};

export const CHAPTER_ORDER = {
  "Solar Flare": 1,
  "Dawn Breaker": 2,
  "Witches' Eve": 3,
  "Catch the Kraken": 4,
  "Spring Blossom": 5,
  "Clash of Factions": 6,
  "Pharaoh's Treasure": 7,
  "Bull Run": 8,
  "Winds of Change": 9,
  "Great Bloom": 10,
  "Better Together": 11,
  "Paw Prints": 12,
  "Crabs and Traps": 13,
  "Salt Awakening": 14,
  "Ascension Age": 15,
};

export const getChapterForDate = (timestamp) => {
  if (!timestamp) return "Unknown";
  for (const [chapter, times] of Object.entries(CHAPTERS)) {
    if (timestamp >= times.startDate && timestamp < times.endDate) {
      return chapter;
    }
  }
  return "Unknown";
};

import assetsMap from '../data/assetsMap.json';
import knownIds from '../data/knownIds.json';

export const ASSET_URLS = {
  SFL: "/sfl-assets/icons/flower.png",
  COIN: "/sfl-assets/icons/coins.webp",
  GEM: "/sfl-assets/icons/gem.webp",
  LOVE_CHARM: "/sfl-assets/icons/love_charm.webp",
  MARK: "/sfl-assets/icons/mark.webp"
};

export const getAssetUrl = (itemName) => {
  if (!itemName) return '';
  const key = itemName.toLowerCase().replace(/_/g, '').replace(/-/g, '').replace(/ /g, '');
  
  const aliases = {
    'lauriethechucklecrow': 'laurie',
    // add more if needed
  };

  const lookupKey = aliases[key] || key;

  const mappedAsset = assetsMap[lookupKey];
  
  if (mappedAsset && mappedAsset.includes('/wearables/')) {
    return mappedAsset;
  }

  if (knownIds[itemName]) {
    return `/sfl-assets/items/${knownIds[itemName]}.webp`;
  }

  if (mappedAsset) {
    return mappedAsset;
  }
  
  return `/sfl-assets/items/${encodeURIComponent(itemName.toLowerCase().replace(/ /g, '_'))}.png`;
};
