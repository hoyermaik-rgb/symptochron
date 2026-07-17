type SpeechResultLike = {
  isFinal?: boolean;
  0?: {
    transcript?: string;
  };
};

export type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results?: {
    length: number;
    [index: number]: SpeechResultLike | undefined;
  };
};

export function extractFinalSpeechTranscript(event: SpeechRecognitionEventLike): string {
  const results = event.results;
  if (!results) return '';

  const startIndex = Math.max(0, event.resultIndex ?? 0);
  const parts: string[] = [];

  for (let index = startIndex; index < results.length; index += 1) {
    const result = results[index];
    if (!result || result.isFinal === false) continue;

    const transcript = result[0]?.transcript?.trim();
    if (transcript) parts.push(transcript);
  }

  return parts.join(' ').trim();
}
