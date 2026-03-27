import {
  NOTES_SHARP,
  SEMITONE_TO_SPELLING,
  LETTER_TO_DIATONIC,
  PRACTICE_MIN_MIDI,
  PRACTICE_MAX_MIDI,
} from "./constants.js";

export function isBlackKey(semitone) {
  return [1, 3, 6, 8, 10].includes(semitone);
}

export function midiToName(midi) {
  const semitone = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTES_SHARP[semitone]}${octave}`;
}

export function midiToDisplaySpelling(midi) {
  const semitone = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  const [letter, accidental] = SEMITONE_TO_SPELLING[semitone];

  let adjustedOctave = octave;
  if (letter === "B" && accidental === "b") {
    adjustedOctave += 1;
  }

  return { letter, accidental, octave: adjustedOctave };
}

function diatonicIndex(letter, octave) {
  return octave * 7 + LETTER_TO_DIATONIC[letter];
}

export function staffYForNote(letter, octave) {
  const bottomLineY = 136;
  const step = 8;
  const bassBottomLineIndex = diatonicIndex("G", 2);
  const noteIndex = diatonicIndex(letter, octave);
  return bottomLineY - (noteIndex - bassBottomLineIndex) * step;
}

export function buildPracticePool() {
  const result = [];
  for (let midi = PRACTICE_MIN_MIDI; midi <= PRACTICE_MAX_MIDI; midi += 1) {
    result.push(midi);
  }
  return result;
}

export function buildPracticePoolByAccidentals(includeAccidentals) {
  if (includeAccidentals) {
    return buildPracticePool();
  }
  return buildPracticePool().filter((midi) => !isBlackKey(midi % 12));
}

export function pickRandomMidi(pool, previousMidi = null) {
  if (!pool.length) return null;
  if (pool.length === 1) return pool[0];

  let candidate = pool[Math.floor(Math.random() * pool.length)];
  while (candidate === previousMidi) {
    candidate = pool[Math.floor(Math.random() * pool.length)];
  }
  return candidate;
}
