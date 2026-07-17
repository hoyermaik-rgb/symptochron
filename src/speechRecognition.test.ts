import { describe, expect, test } from 'vitest';
import { extractFinalSpeechTranscript, SpeechRecognitionEventLike } from './speechRecognition';

function eventLike(resultIndex: number, results: Array<{ transcript: string; isFinal?: boolean }>): SpeechRecognitionEventLike {
  const indexedResults = results.reduce((acc, result, index) => {
    acc[index] = {
      isFinal: result.isFinal,
      0: { transcript: result.transcript },
    };
    return acc;
  }, { length: results.length } as SpeechRecognitionEventLike['results']);

  return { resultIndex, results: indexedResults };
}

describe('speech recognition result extraction', () => {
  test('extracts only final results from the reported result index', () => {
    const text = extractFinalSpeechTranscript(eventLike(1, [
      { transcript: 'alter text', isFinal: true },
      { transcript: 'neuer text', isFinal: true },
      { transcript: 'zwischenstand', isFinal: false },
    ]));

    expect(text).toBe('neuer text');
  });

  test('ignores interim-only results', () => {
    const text = extractFinalSpeechTranscript(eventLike(0, [
      { transcript: 'noch nicht final', isFinal: false },
    ]));

    expect(text).toBe('');
  });

  test('trims and joins final result parts', () => {
    const text = extractFinalSpeechTranscript(eventLike(0, [
      { transcript: ' erster Teil ', isFinal: true },
      { transcript: ' zweiter Teil ', isFinal: true },
    ]));

    expect(text).toBe('erster Teil zweiter Teil');
  });
});
