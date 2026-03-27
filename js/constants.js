export const KEYBOARD_START_MIDI = 36; // C2
export const KEYBOARD_END_MIDI = 95; // B6

// Диапазон тренировки: до 2 добавочных линий от басового стана
export const PRACTICE_MIN_MIDI = 36; // C2 (вторая добавочная линия снизу)
export const PRACTICE_MAX_MIDI = 65; // F4 (пробел над второй добавочной линией сверху)

export const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const LETTER_TO_DIATONIC = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

export const SEMITONE_TO_SPELLING = {
  0: ["C", ""],
  1: ["C", "#"],
  2: ["D", ""],
  3: ["E", "b"],
  4: ["E", ""],
  5: ["F", ""],
  6: ["F", "#"],
  7: ["G", ""],
  8: ["A", "b"],
  9: ["A", ""],
  10: ["B", "b"],
  11: ["B", ""],
};
