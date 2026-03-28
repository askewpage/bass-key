import { KEYBOARD_START_MIDI, KEYBOARD_END_MIDI } from "./constants.js";
import { buildPracticePoolByAccidentals, midiToName, pickRandomMidi } from "./music.js";
import { renderBassNoteSvg } from "./staffRenderer.js";
import { createKeyboard } from "./keyboard.js";
import { PianoAudio } from "./audio.js";

const THEME_STORAGE_KEY = "bass_clef_theme";
const OCTAVE_LABELS_STORAGE_KEY = "bass_clef_octave_labels";

const INTERVAL_OPTIONS = [
  { semitones: 0, short: "ч1", label: "Чистая прима" },
  { semitones: 1, short: "м2", label: "Малая секунда" },
  { semitones: 2, short: "б2", label: "Большая секунда" },
  { semitones: 3, short: "м3", label: "Малая терция" },
  { semitones: 4, short: "б3", label: "Большая терция" },
  { semitones: 5, short: "ч4", label: "Чистая кварта" },
  { semitones: 6, short: "ув4", label: "Тритон" },
  { semitones: 7, short: "ч5", label: "Чистая квинта" },
  { semitones: 8, short: "м6", label: "Малая секста" },
  { semitones: 9, short: "б6", label: "Большая секста" },
  { semitones: 10, short: "м7", label: "Малая септима" },
  { semitones: 11, short: "б7", label: "Большая септима" },
  { semitones: 12, short: "ч8", label: "Чистая октава" },
];

const INTERVAL_BASE_MIN = 48; // C3
const INTERVAL_BASE_MAX = 79; // G5

export class BassClefTrainer {
  constructor(elements) {
    this.appEl = elements.appEl;
    this.noteViewEl = elements.noteViewEl;
    this.keyboardEl = elements.keyboardEl;
    this.keyboardWrapEl = elements.keyboardWrapEl;
    this.attemptsEl = elements.attemptsEl;
    this.correctEl = elements.correctEl;
    this.accuracyEl = elements.accuracyEl;
    this.messageEl = elements.messageEl;
    this.showLabelsToggleEl = elements.showLabelsToggleEl;
    this.accidentalsToggleEl =
      elements.accidentalsToggleEl || elements.difficultyModeEl || null;
    this.themeToggleEl = elements.themeToggleEl || null;
    this.octaveLabelsToggleEl = elements.octaveLabelsToggleEl || null;

    this.notesSectionEl = elements.notesSectionEl;
    this.intervalSectionEl = elements.intervalSectionEl;
    this.modeNotesBtnEl = elements.modeNotesBtnEl;
    this.modeIntervalsBtnEl = elements.modeIntervalsBtnEl;

    this.intervalMessageEl = elements.intervalMessageEl;
    this.replayIntervalBtnEl = elements.replayIntervalBtnEl;
    this.intervalButtonsEl = elements.intervalButtonsEl;

    this.practicePool = [];
    this.keysByMidi = new Map();
    this.intervalButtonsBySemitone = new Map();

    this.pianoAudio = new PianoAudio();
    this.pendingRoundTimer = null;
    this.intervalPlayToken = 0;

    this.state = {
      mode: "notes",
      showLabels: true,
      includeAccidentals: false,
      darkTheme: false,
      showOctaveLabels: true,

      note: {
        attempts: 0,
        correct: 0,
        targetMidi: null,
      },

      interval: {
        attempts: 0,
        correct: 0,
        targetSemitones: null,
        baseMidi: null,
      },
    };
  }

  init() {
    this.state.showLabels = this.showLabelsToggleEl
      ? this.showLabelsToggleEl.checked
      : true;
    this.state.includeAccidentals = this.readAccidentalsSetting();
    this.state.darkTheme = this.readThemeSetting();
    this.state.showOctaveLabels = this.readOctaveLabelsSetting();

    this.practicePool = buildPracticePoolByAccidentals(this.state.includeAccidentals);
    this.pianoAudio.preload();
    this.applyTheme();
    this.bindAudioUnlock();

    this.keysByMidi = createKeyboard({
      root: this.keyboardEl,
      startMidi: KEYBOARD_START_MIDI,
      endMidi: KEYBOARD_END_MIDI,
      onPress: (midi) => this.handleNoteGuess(midi),
    });
    this.applyKeyboardLabelVisibility();
    this.applyOctaveLabelVisibility();

    this.createIntervalButtons();

    if (this.showLabelsToggleEl) {
      this.showLabelsToggleEl.addEventListener("change", () => {
        this.state.showLabels = this.showLabelsToggleEl.checked;
        this.applyKeyboardLabelVisibility();
      });
    }

    if (this.accidentalsToggleEl) {
      this.accidentalsToggleEl.addEventListener("change", () => {
        this.state.includeAccidentals = this.readAccidentalsSetting();
        this.applyPracticeFilterImmediately();
      });
    }

    if (this.themeToggleEl) {
      this.themeToggleEl.checked = this.state.darkTheme;
      this.themeToggleEl.addEventListener("change", () => {
        this.state.darkTheme = Boolean(this.themeToggleEl.checked);
        this.applyTheme();
        this.drawTargetNote();
        this.persistTheme();
      });
    }

    if (this.octaveLabelsToggleEl) {
      this.octaveLabelsToggleEl.checked = !this.state.showOctaveLabels;
      this.octaveLabelsToggleEl.addEventListener("change", () => {
        this.state.showOctaveLabels = !Boolean(this.octaveLabelsToggleEl.checked);
        this.applyOctaveLabelVisibility();
        this.persistOctaveLabelsSetting();
      });
    }

    if (this.modeNotesBtnEl) {
      this.modeNotesBtnEl.addEventListener("click", () => this.setMode("notes"));
    }
    if (this.modeIntervalsBtnEl) {
      this.modeIntervalsBtnEl.addEventListener("click", () => this.setMode("intervals"));
    }

    if (this.replayIntervalBtnEl) {
      this.replayIntervalBtnEl.addEventListener("click", () => this.replayInterval());
    }

    window.addEventListener("resize", () => this.rebuildKeyboard());
    window.addEventListener("resize", () => this.updateFeedbackPosition());
    window.addEventListener("scroll", () => this.updateFeedbackPosition(), { passive: true });

    this.pickNextNote();
    this.pickNextInterval(false);
    this.setMode("notes");
    this.centerKeyboardViewport();
    this.updateFeedbackPosition();
  }

  bindAudioUnlock() {
    const unlock = () => {
      this.pianoAudio.unlock();
    };

    window.addEventListener("touchstart", unlock, { passive: true, once: true });
    window.addEventListener("pointerdown", unlock, { passive: true, once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  setMode(mode) {
    if (mode !== "notes" && mode !== "intervals") return;
    this.clearPendingRoundTransition();
    this.state.mode = mode;

    const notesMode = mode === "notes";
    this.notesSectionEl.classList.toggle("hidden", !notesMode);
    this.intervalSectionEl.classList.toggle("hidden", notesMode);
    this.modeNotesBtnEl.classList.toggle("active", notesMode);
    this.modeIntervalsBtnEl.classList.toggle("active", !notesMode);

    if (notesMode) {
      if (this.state.note.targetMidi == null) {
        this.pickNextNote();
      }
      this.setMessage("", "");
      this.centerKeyboardViewport();
    } else {
      if (this.state.interval.targetSemitones == null) {
        this.pickNextInterval(true);
      }
      this.setIntervalMessage("", "");
      this.replayInterval();
    }

    this.updateStats();
    this.updateFeedbackPosition();
  }

  rebuildKeyboard() {
    this.keysByMidi = createKeyboard({
      root: this.keyboardEl,
      startMidi: KEYBOARD_START_MIDI,
      endMidi: KEYBOARD_END_MIDI,
      onPress: (midi) => this.handleNoteGuess(midi),
    });
    this.applyKeyboardLabelVisibility();
    this.applyOctaveLabelVisibility();
    this.centerKeyboardViewport();
  }

  createIntervalButtons() {
    if (!this.intervalButtonsEl) return;
    this.intervalButtonsEl.innerHTML = "";
    this.intervalButtonsBySemitone.clear();

    const displayOrder = toColumnReadingOrder(INTERVAL_OPTIONS, 2);

    displayOrder.forEach((interval) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "interval-btn";
      button.dataset.semitones = String(interval.semitones);
      button.innerHTML = `<span class="interval-label">${interval.label}</span>`;
      button.addEventListener("click", () => this.handleIntervalGuess(interval.semitones));
      this.intervalButtonsEl.appendChild(button);
      this.intervalButtonsBySemitone.set(interval.semitones, button);
    });
  }

  applyKeyboardLabelVisibility() {
    this.keyboardEl.classList.toggle("hide-labels", !this.state.showLabels);
  }

  applyOctaveLabelVisibility() {
    this.keyboardEl.classList.toggle("hide-octave-markers", !this.state.showOctaveLabels);
  }

  readThemeSetting() {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "dark") return true;
      if (saved === "light") return false;
    } catch {}
    return true;
  }

  applyTheme() {
    document.body.classList.toggle("theme-dark", this.state.darkTheme);
  }

  persistTheme() {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, this.state.darkTheme ? "dark" : "light");
    } catch {}
  }

  readOctaveLabelsSetting() {
    try {
      const saved = localStorage.getItem(OCTAVE_LABELS_STORAGE_KEY);
      if (saved === "off") return false;
      if (saved === "on") return true;
    } catch {}
    return true;
  }

  persistOctaveLabelsSetting() {
    try {
      localStorage.setItem(OCTAVE_LABELS_STORAGE_KEY, this.state.showOctaveLabels ? "on" : "off");
    } catch {}
  }

  readAccidentalsSetting() {
    if (!this.accidentalsToggleEl) return false;
    if ("checked" in this.accidentalsToggleEl) {
      return Boolean(this.accidentalsToggleEl.checked);
    }
    if ("value" in this.accidentalsToggleEl) {
      return this.accidentalsToggleEl.value === "with-accidentals";
    }
    return false;
  }

  applyPracticeFilterImmediately() {
    this.clearPendingRoundTransition();
    this.practicePool = buildPracticePoolByAccidentals(this.state.includeAccidentals);

    if (this.state.mode === "notes") {
      this.pickNextNote();
      return;
    }
  }

  clearPendingRoundTransition() {
    if (this.pendingRoundTimer !== null) {
      window.clearTimeout(this.pendingRoundTimer);
      this.pendingRoundTimer = null;
    }
  }

  clearKeyMarks() {
    this.keysByMidi.forEach((el) => {
      el.classList.remove("correct", "wrong");
    });
  }

  clearIntervalButtonMarks() {
    this.intervalButtonsBySemitone.forEach((el) => {
      el.classList.remove("correct", "wrong");
    });
  }

  setMessage(text, kind = "", options = {}) {
    if (!this.messageEl) return;
    const { asHtml = false, layout = "" } = options;
    if (asHtml) {
      this.messageEl.innerHTML = text;
    } else {
      this.messageEl.textContent = text;
    }
    this.messageEl.classList.remove("ok", "bad");
    this.messageEl.classList.toggle("split-feedback", layout === "split");
    if (kind) this.messageEl.classList.add(kind);
    this.messageEl.classList.toggle("hidden", !text);
    this.updateFeedbackPosition();
  }

  setIntervalMessage(text, kind = "") {
    this.setMessage(text, kind);
  }

  updateFeedbackPosition() {
    if (!this.messageEl || !this.appEl) return;

    const appRect = this.appEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const availableSpace = viewportHeight - appRect.bottom;

    let top = viewportHeight * 0.86;
    if (availableSpace > 24) {
      top = appRect.bottom + availableSpace / 2;
    }

    const clampedTop = Math.max(16, Math.min(viewportHeight - 16, top));
    this.messageEl.style.top = `${clampedTop}px`;
  }

  centerKeyboardViewport() {
    if (!this.keyboardWrapEl || !this.keyboardEl) return;
    window.requestAnimationFrame(() => {
      const maxScroll = this.keyboardWrapEl.scrollWidth - this.keyboardWrapEl.clientWidth;
      if (maxScroll <= 0) {
        this.keyboardWrapEl.scrollLeft = 0;
        return;
      }
      this.keyboardWrapEl.scrollLeft = Math.round(maxScroll / 2);
    });
  }

  updateStats() {
    const stats = this.state.mode === "notes" ? this.state.note : this.state.interval;
    this.attemptsEl.textContent = String(stats.attempts);
    this.correctEl.textContent = String(stats.correct);
    const accuracy = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;
    this.accuracyEl.textContent = `${accuracy}%`;
  }

  drawTargetNote() {
    this.noteViewEl.innerHTML = renderBassNoteSvg(this.state.note.targetMidi);
    this.noteViewEl.setAttribute("aria-label", "На нотном стане показана нота в басовом ключе");
  }

  pickNextNote() {
    this.clearKeyMarks();
    const previous = this.state.note.targetMidi;
    this.state.note.targetMidi = pickRandomMidi(this.practicePool, previous);
    if (this.state.note.targetMidi == null) return;
    this.drawTargetNote();
  }

  handleNoteGuess(pressedMidi) {
    if (this.state.mode !== "notes") return;
    if (this.state.note.targetMidi == null) return;

    this.pianoAudio.playMidi(pressedMidi);

    this.state.note.attempts += 1;
    const isCorrect = pressedMidi === this.state.note.targetMidi;
    const targetName = midiToName(this.state.note.targetMidi);
    const pressedName = midiToName(pressedMidi);

    const pressedKey = this.keysByMidi.get(pressedMidi);
    if (pressedKey) {
      pressedKey.classList.add(isCorrect ? "correct" : "wrong");
    }

    if (isCorrect) {
      this.state.note.correct += 1;
      this.setMessage(targetName, "ok");
      this.updateStats();

      this.pendingRoundTimer = window.setTimeout(() => {
        this.pickNextNote();
        this.pendingRoundTimer = null;
      }, 480);
      return;
    }

    const targetKey = this.keysByMidi.get(this.state.note.targetMidi);
    if (targetKey) {
      targetKey.classList.add("correct");
    }

    this.setMessage(
      `<span class="feedback-wrong">${pressedName}</span><span class="feedback-correct">${targetName}</span>`,
      "bad",
      { asHtml: true, layout: "split" }
    );
    this.updateStats();

    this.pendingRoundTimer = window.setTimeout(() => {
      this.pickNextNote();
      this.pendingRoundTimer = null;
    }, 1111);
  }

  pickNextInterval(playAfterPick = true) {
    this.clearIntervalButtonMarks();

    const previous = this.state.interval.targetSemitones;
    const nextInterval = pickRandomInterval(previous);
    this.state.interval.targetSemitones = nextInterval.semitones;
    this.state.interval.baseMidi = randomInt(INTERVAL_BASE_MIN, INTERVAL_BASE_MAX);

    if (playAfterPick) {
      this.replayInterval();
    }
  }

  async replayInterval() {
    if (this.state.interval.targetSemitones == null || this.state.interval.baseMidi == null) {
      return;
    }

    const token = ++this.intervalPlayToken;
    const base = this.state.interval.baseMidi;
    const semitones = this.state.interval.targetSemitones;

    await this.pianoAudio.playInterval(base, semitones, { gapMs: 430 });

    if (token !== this.intervalPlayToken) return;
  }

  handleIntervalGuess(guessedSemitones) {
    if (this.state.mode !== "intervals") return;
    if (this.state.interval.targetSemitones == null) return;

    this.state.interval.attempts += 1;
    const isCorrect = guessedSemitones === this.state.interval.targetSemitones;

    const guessedButton = this.intervalButtonsBySemitone.get(guessedSemitones);
    if (guessedButton) {
      guessedButton.classList.add(isCorrect ? "correct" : "wrong");
    }

    if (isCorrect) {
      this.state.interval.correct += 1;
      const interval = intervalBySemitones(this.state.interval.targetSemitones);
      this.setMessage(interval.label, "ok");
      this.setIntervalMessage(interval.label, "ok");
      this.updateStats();

      this.pendingRoundTimer = window.setTimeout(() => {
        this.pickNextInterval(true);
        this.setIntervalMessage("", "");
        this.pendingRoundTimer = null;
      }, 560);
      return;
    }

    const targetButton = this.intervalButtonsBySemitone.get(this.state.interval.targetSemitones);
    if (targetButton) {
      targetButton.classList.add("correct");
    }

    const target = intervalBySemitones(this.state.interval.targetSemitones);
    this.setMessage(target.label, "bad");
    this.setIntervalMessage(target.label, "bad");
    this.updateStats();

    this.pendingRoundTimer = window.setTimeout(() => {
      this.pickNextInterval(true);
      this.setIntervalMessage("", "");
      this.pendingRoundTimer = null;
    }, 760);
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandomInterval(previousSemitones = null) {
  if (INTERVAL_OPTIONS.length === 1) {
    return INTERVAL_OPTIONS[0];
  }

  let candidate = INTERVAL_OPTIONS[Math.floor(Math.random() * INTERVAL_OPTIONS.length)];
  while (candidate.semitones === previousSemitones) {
    candidate = INTERVAL_OPTIONS[Math.floor(Math.random() * INTERVAL_OPTIONS.length)];
  }
  return candidate;
}

function intervalBySemitones(semitones) {
  return INTERVAL_OPTIONS.find((item) => item.semitones === semitones) || INTERVAL_OPTIONS[0];
}

function toColumnReadingOrder(items, columns) {
  if (columns <= 1 || items.length <= 1) return [...items];

  const rows = Math.ceil(items.length / columns);
  const chunks = [];

  for (let col = 0; col < columns; col += 1) {
    const start = col * rows;
    const end = start + rows;
    chunks.push(items.slice(start, end));
  }

  const result = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const value = chunks[col][row];
      if (value) result.push(value);
    }
  }

  return result;
}
