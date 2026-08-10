import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const collectionMock = {
  findOne: vi.fn(),
  updateOne: vi.fn(),
};

const dbPath = require.resolve('../src-backend/config/db.cjs');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    getHistoryCollection: () => collectionMock,
  }
};

// Dynamically import to ensure cache is modified before import
let recordFarmHistory;

describe('historyService - recordFarmHistory', () => {
  const mockCollection = collectionMock;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    if (!recordFarmHistory) {
      const module = await import('../src-backend/services/historyService.cjs');
      recordFarmHistory = module.recordFarmHistory;
    }
  });

  it('should correctly sum up Shiny Feather rewards for chores', async () => {
    // Setup mock farm history
    mockCollection.findOne.mockResolvedValue(null);

    const chores = [
      {
        category: 'Weekly Chores',
        items: [
          {
            name: 'Chore 1',
            status: 'claimed',
            rewardType: 'Shiny Feather',
            reward: 5
          },
          {
            name: 'Chore 2',
            status: 'claimed',
            rewardType: 'Shiny Feather',
            reward: 10
          },
          {
            name: 'Chore 3',
            status: 'claimed',
            rewardType: 'Coins', // Should not be counted
            reward: 20
          }
        ]
      }
    ];

    await recordFarmHistory('farm-123', [], chores, [], [], null, null, null);

    expect(mockCollection.updateOne).toHaveBeenCalled();
    const updateCall = mockCollection.updateOne.mock.calls[0];
    const updateData = updateCall[1].$set;

    // Check chores
    const weeks = Object.keys(updateData.chores);
    expect(weeks.length).toBe(1);
    const weekData = updateData.chores[weeks[0]];
    
    // Should be 15 tickets (5 + 10)
    expect(weekData.completed).toBe(15);
  });

  it('should save animal task completions with Shiny Feather rewardType', async () => {
    // Setup mock farm history
    mockCollection.findOne.mockResolvedValue(null);

    const animals = [
      {
        animalName: 'Chicken',
        level: '5',
        reward: 3,
        rewardType: 'Shiny Feather',
        status: 'claimed'
      }
    ];

    await recordFarmHistory('farm-123', [], [], [], animals, null, null, null);

    expect(mockCollection.updateOne).toHaveBeenCalled();
    const updateCall = mockCollection.updateOne.mock.calls[0];
    const updateData = updateCall[1].$set;

    const animalKeys = Object.keys(updateData.animals_completed);
    expect(animalKeys.length).toBe(1);
    expect(updateData.animals_completed[animalKeys[0]].reward).toBe(3);
    expect(updateData.animals_completed[animalKeys[0]].rewardType).toBe('Shiny Feather');
  });
});
