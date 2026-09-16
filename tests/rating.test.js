import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getRatingTier, getWinProbability, calculateContestRatingChanges } from '../src/core/rating.js';

describe('DEVER-Forces Rating Engine Tests', () => {
  test('Phân hạng Tier chuẩn màu sắc và danh hiệu', () => {
    assert.equal(getRatingTier(1050).name, 'Newbie');
    assert.equal(getRatingTier(1050).color, '#808080');

    assert.equal(getRatingTier(1300).name, 'Pupil');
    assert.equal(getRatingTier(1300).color, '#008000');

    assert.equal(getRatingTier(1550).name, 'Specialist');
    assert.equal(getRatingTier(1550).color, '#03A89E');

    assert.equal(getRatingTier(1750).name, 'Expert');
    assert.equal(getRatingTier(1750).color, '#0000FF');

    assert.equal(getRatingTier(2000).name, 'Candidate Master');
    assert.equal(getRatingTier(2300).name, 'Master');
    assert.equal(getRatingTier(2500).name, 'Grandmaster');
    assert.equal(getRatingTier(2500).color, '#FF0000');
  });

  test('Xác suất thắng theo Elo: 2 người bằng điểm xác suất là 0.5', () => {
    const p = getWinProbability(1500, 1500);
    assert.ok(Math.abs(p - 0.5) < 1e-4);
  });

  test('Người có rating cao hơn 400 điểm có khoảng 91% khả năng thắng', () => {
    // A=1900, B=1500 => xác suất B thắng A là 1 / (1 + 10^(400/400)) = 1/11 ~ 0.0909
    const probBBeatsA = getWinProbability(1900, 1500);
    assert.ok(Math.abs(probBBeatsA - 0.0909) < 1e-3);
  });

  test('Thí sinh hạng 1 vượt trội phải được cộng điểm (positive delta)', () => {
    const participants = [
      { id: 'u1', name: 'Alice_K19', oldRating: 1400, points: 2500 },
      { id: 'u2', name: 'Bob_K20', oldRating: 1450, points: 1800 },
      { id: 'u3', name: 'Charlie_K18', oldRating: 1600, points: 1200 },
      { id: 'u4', name: 'Dave_K20', oldRating: 1200, points: 600 }
    ];

    const results = calculateContestRatingChanges(participants);
    
    // Alice xếp hạng 1 với điểm vượt trội so với rating cũ
    const alice = results.find(r => r.name === 'Alice_K19');
    assert.ok(alice.delta > 0, 'Alice hạng nhất phải được cộng rating');
    assert.equal(alice.rank, 1);

    // Charlie rating 1600 nhưng về hạng 3 (dưới Bob 1450 và Alice 1400) phải bị trừ rating
    const charlie = results.find(r => r.name === 'Charlie_K18');
    assert.ok(charlie.delta < 0, 'Charlie thể hiện kém so với rating kỳ vọng phải bị trừ rating');
  });
});
