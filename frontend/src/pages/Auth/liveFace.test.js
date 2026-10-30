import { describe, expect, it } from 'vitest';
import { averageBrightness, judgeFrame } from './liveFace';

describe('judgeFrame', () => {
  it('rejects a covered camera after several dark frames', () => {
    let darkFrames = 0;
    let hits = 0;
    let verdict = { done: false };
    for (let i = 0; i < 8; i += 1) {
      verdict = judgeFrame({ brightness: 4, faceCount: 0, darkFrames, hits });
      darkFrames = verdict.darkFrames;
      hits = verdict.hits;
    }
    expect(verdict).toMatchObject({ done: true, error: 'covered' });
  });

  it('accepts only after a face is visible three times', () => {
    let hits = 0;
    let verdict = { done: false };
    for (let i = 0; i < 2; i += 1) {
      verdict = judgeFrame({ brightness: 80, faceCount: 1, darkFrames: 0, hits });
      hits = verdict.hits;
    }
    expect(verdict.done).toBe(false);
    verdict = judgeFrame({ brightness: 80, faceCount: 1, darkFrames: 0, hits });
    expect(verdict).toMatchObject({ done: true, ok: true });
  });

  it('does not treat a bright empty frame as a face', () => {
    const verdict = judgeFrame({
      brightness: 90,
      faceCount: 0,
      darkFrames: 3,
      hits: 2,
    });
    expect(verdict).toEqual({ done: false, darkFrames: 0, hits: 0 });
  });
});

describe('averageBrightness', () => {
  it('reads a black frame as dark', () => {
    const data = new Uint8ClampedArray(64);
    const score = averageBrightness({ data });
    expect(score).toBeLessThan(18);
  });
});
