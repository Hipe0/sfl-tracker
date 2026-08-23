const LEVEL_EXPERIENCE = {
  1: 0,
  2: 2,
  3: 22,
  4: 205,
  5: 555,
  6: 1155,
  7: 2155,
  8: 3405,
  9: 5405,
  10: 7905,
  11: 10905,
  12: 14405,
  13: 18405,
  14: 22905,
  15: 27905,
  16: 33655,
  17: 40155,
  18: 47405,
  19: 55405,
  20: 64155,
  21: 73905,
  22: 84655,
  23: 96405,
  24: 109155,
  25: 122905,
  26: 137405,
  27: 152905,
  28: 169405,
  29: 186905,
  30: 205405,
  31: 225405,
  32: 246905,
  33: 269905,
  34: 294405,
  35: 320405,
  36: 348405,
  37: 378405,
  38: 410405,
  39: 444405,
  40: 480405,
  41: 518905,
  42: 559905,
  43: 603405,
  44: 649405,
  45: 697905,
  46: 749405,
  47: 803905,
  48: 861405,
  49: 921905,
  50: 985405,
  51: 1053905,
  52: 1127405,
  53: 1205905,
  54: 1289405,
  55: 1377905,
  56: 1476405,
  57: 1584905,
  58: 1703405,
  59: 1831905,
  60: 1970405,
  61: 2128905,
  62: 2287405,
  63: 2485905,
  64: 2704405,
  65: 2942905,
  66: 3221405,
  67: 3539905,
  68: 3898405,
  69: 4296905,
  70: 4735405,
  71: 5233905,
  72: 5743905,
  73: 6263905,
  74: 6793905,
  75: 7333905,
  76: 7883905,
  77: 8443905,
  78: 9013905,
  79: 9593905,
  80: 10183905,
  81: 10783905,
  82: 11393905,
  83: 12013905,
  84: 12643905,
  85: 13283905,
  86: 13933905,
  87: 14593905,
  88: 15263905,
  89: 15943905,
  90: 16633905,
  91: 17333905,
  92: 18043905,
  93: 18763905,
  94: 19493905,
  95: 20233905,
  96: 20983905,
  97: 21743905,
  98: 22513905,
  99: 23293905,
  100: 24083905,
  101: 24893905,
  102: 25723905,
  103: 26573905,
  104: 27443905,
  105: 28333905,
  106: 29243905,
  107: 30173905,
  108: 31123905,
  109: 32093905,
  110: 33083905,
  111: 34093905,
  112: 35123905,
  113: 36173905,
  114: 37243905,
  115: 38333905,
  116: 39443905,
  117: 40573905,
  118: 41723905,
  119: 42893905,
  120: 44083905,
  121: 45293905,
  122: 46523905,
  123: 47773905,
  124: 49043905,
  125: 50333905,
  126: 51653905,
  127: 53003905,
  128: 54383905,
  129: 55793905,
  130: 57233905,
  131: 58708905,
  132: 60218905,
  133: 61763905,
  134: 63343905,
  135: 64958905,
  136: 66613905,
  137: 68308905,
  138: 70043905,
  139: 71818905,
  140: 73633905,
  141: 75493905,
  142: 77398905,
  143: 79348905,
  144: 81343905,
  145: 83383905,
  146: 85473905,
  147: 87613905,
  148: 89803905,
  149: 92043905,
  150: 94333905,
};

const PRE_ASCENSION_MAX_LEVEL = 150;
const LEVELS_PER_ASCENSION = 50;
const ASCENSION_BAND_XP_BASE = 50_000_000;
const ASCENSION_BAND_XP_GROWTH = 1.45;
const ASCENSION_BAND_XP_ROUNDING = 5_000_000;
const ASCENSION_LEVEL_WEIGHT_PER_LEVEL = 0.03;
const ASCENSION_LEVEL_UPS = LEVELS_PER_ASCENSION - 1;
const ASCENSION_TOTAL_WEIGHT =
  ASCENSION_LEVEL_UPS +
  ASCENSION_LEVEL_WEIGHT_PER_LEVEL *
    ((ASCENSION_LEVEL_UPS * LEVELS_PER_ASCENSION) / 2);

const isMaxLevel = (experience) => {
  return experience >= LEVEL_EXPERIENCE[PRE_ASCENSION_MAX_LEVEL];
};

const getBumpkinLevel = (experience) => {
  if (isMaxLevel(experience)) {
    return PRE_ASCENSION_MAX_LEVEL;
  }
  let bumpkinLevel = 1;
  for (const key in LEVEL_EXPERIENCE) {
    const level = Number(key);
    if (level > PRE_ASCENSION_MAX_LEVEL) break;
    if (experience >= LEVEL_EXPERIENCE[level]) {
      bumpkinLevel = level;
    } else {
      break;
    }
  }
  return bumpkinLevel;
};

const bandXp = (ascension) => {
  const growth = Math.pow(ASCENSION_BAND_XP_GROWTH, ascension - 1);
  const rawXp = ASCENSION_BAND_XP_BASE * growth;
  const roundedXp = Math.round((rawXp / ASCENSION_BAND_XP_ROUNDING)) * ASCENSION_BAND_XP_ROUNDING;
  return roundedXp;
};

const levelXp = (ascension, n) => {
  return (bandXp(ascension) * (1 + ASCENSION_LEVEL_WEIGHT_PER_LEVEL * n)) / ASCENSION_TOTAL_WEIGHT;
};

const ascensionBaseline = (ascension) => {
  let xp = LEVEL_EXPERIENCE[150];
  for (let b = 1; b < ascension; b++) {
    xp += bandXp(b);
  }
  return xp;
};

const getAscensionLevel = (experience, ascensionLevel) => {
  if (ascensionLevel < 1) {
    const level = getBumpkinLevel(experience);
    return { ascension: 0, level };
  }

  const baseline = ascensionBaseline(ascensionLevel);

  if (experience < baseline) {
    return { ascension: ascensionLevel, level: 0 };
  }

  if (experience >= baseline + bandXp(ascensionLevel)) {
    return { ascension: ascensionLevel, level: LEVELS_PER_ASCENSION };
  }

  let level = 1;
  let levelStart = baseline;
  for (let n = 1; n < ASCENSION_LEVEL_UPS; n++) {
    const nextStart = levelStart + levelXp(ascensionLevel, n);
    if (experience >= nextStart) {
      level = n + 1;
      levelStart = nextStart;
    } else {
      break;
    }
  }
  return { ascension: ascensionLevel, level };
};

const getTotalBumpkinLevel = (experience, ascensionLevel = 0) => {
  if (ascensionLevel >= 1) {
    return (
      PRE_ASCENSION_MAX_LEVEL +
      (ascensionLevel - 1) * LEVELS_PER_ASCENSION +
      getAscensionLevel(experience, ascensionLevel).level
    );
  }
  return getBumpkinLevel(experience);
};

module.exports = {
  getTotalBumpkinLevel
};
