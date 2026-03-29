import { KEYBOARD_START_MIDI, KEYBOARD_END_MIDI } from "./constants.js?v=24";
import { buildPracticePoolByAccidentals, midiToName, pickRandomMidi } from "./music.js?v=24";
import { renderNoteSvg } from "./staffRenderer.js?v=25";
import { createKeyboard } from "./keyboard.js?v=24";
import { PianoAudio } from "./audio.js?v=25";

const THEME_STORAGE_KEY = "bass_clef_theme";
const OCTAVE_LABELS_STORAGE_KEY = "bass_clef_octave_labels";
const NOTE_CLEF_STORAGE_KEY = "note_mode_clef";

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

const RHYTHM_TOTAL_BEATS = 16;
const RHYTHM_DEFAULT_BPM = 92;
const RHYTHM_MIN_BPM = 40;
const RHYTHM_MAX_BPM = 220;
const RHYTHM_START_LEAD_IN_MS = 500;
const RHYTHM_HIT_TOLERANCE_MS = 130;

const RHYTHM_PATTERNS = [
  { id: "quarter", label: "Четверть", icon: "♩", offsets: [0] },
  { id: "eighths", label: "Восьмые", icon: "♫", offsets: [0, 0.5] },
  { id: "triplet", label: "Триоль", icon: "♪3", offsets: [0, 1 / 3, 2 / 3] },
  { id: "sixteenths", label: "Шестнадцатые", icon: "♬", offsets: [0, 0.25, 0.5, 0.75] },
];

const TREBLE_PRACTICE_MIN_MIDI = 55; // G3
const TREBLE_PRACTICE_MAX_MIDI = 88; // E6

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
    this.themeIconBtnEl = elements.themeIconBtnEl || null;
    this.octaveLabelsToggleEl = elements.octaveLabelsToggleEl || null;

    this.notesSectionEl = elements.notesSectionEl;
    this.intervalSectionEl = elements.intervalSectionEl;
    this.rhythmSectionEl = elements.rhythmSectionEl;
    this.notesSettingsEl = elements.notesSettingsEl || null;
    this.intervalSettingsEl = elements.intervalSettingsEl || null;
    this.rhythmSettingsEl = elements.rhythmSettingsEl || null;
    this.modeNotesBtnEl = elements.modeNotesBtnEl;
    this.modeIntervalsBtnEl = elements.modeIntervalsBtnEl;
    this.modeRhythmBtnEl = elements.modeRhythmBtnEl;

    this.intervalMessageEl = elements.intervalMessageEl;
    this.replayIntervalBtnEl = elements.replayIntervalBtnEl;
    this.intervalButtonsEl = elements.intervalButtonsEl;

    this.rhythmGridEl = elements.rhythmGridEl || null;
    this.rhythmStartBtnEl = elements.rhythmStartBtnEl || null;
    this.rhythmRegenerateBtnEl = elements.rhythmRegenerateBtnEl || null;
    this.rhythmBpmInputEl = elements.rhythmBpmInputEl || null;
    this.rhythmPatternToggleEls = Array.from(elements.rhythmPatternToggleEls || []);
    this.rhythmHintEl = elements.rhythmHintEl || null;
    this.noteClefBassBtnEl = elements.noteClefBassBtnEl || null;
    this.noteClefTrebleBtnEl = elements.noteClefTrebleBtnEl || null;

    this.practicePools = {
      bass: [],
      treble: [],
    };
    this.keysByMidi = new Map();
    this.intervalButtonsBySemitone = new Map();
    this.rhythmCells = [];

    this.pianoAudio = new PianoAudio();
    this.pendingRoundTimer = null;
    this.intervalPlayToken = 0;
    this.rhythmRafId = null;

    this.state = {
      mode: "notes",
      showLabels: true,
      includeAccidentals: false,
      darkTheme: false,
      showOctaveLabels: true,

      note: {
        attempts: 0,
        correct: 0,
        clef: "bass",
        targetMidi: null,
      },

      interval: {
        attempts: 0,
        correct: 0,
        targetSemitones: null,
        baseMidi: null,
      },

      rhythm: {
        attempts: 0,
        correct: 0,
        bpm: RHYTHM_DEFAULT_BPM,
        enabledPatternIds: ["quarter", "eighths", "sixteenths"],
        sequence: [],
        expectedHits: [],
        running: false,
        startTime: 0,
        currentBeat: -1,
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
    this.state.note.clef = this.readNoteClefSetting();

    this.practicePools = this.buildAllPracticePools(this.state.includeAccidentals);
    this.pianoAudio.preload();
    this.applyTheme();
    this.updateThemeIcon();
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
    this.createRhythmGrid();
    this.bindRhythmControls();
    this.updateClefButtons();

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

    if (this.themeIconBtnEl) {
      this.themeIconBtnEl.addEventListener("click", () => {
        this.state.darkTheme = !this.state.darkTheme;
        this.applyTheme();
        if (this.state.note.targetMidi != null) {
          this.drawTargetNote();
        }
        this.updateThemeIcon();
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
    if (this.modeRhythmBtnEl) {
      this.modeRhythmBtnEl.addEventListener("click", () => this.setMode("rhythm"));
    }
    if (this.noteClefBassBtnEl) {
      this.noteClefBassBtnEl.addEventListener("click", () => this.setNoteClef("bass"));
    }
    if (this.noteClefTrebleBtnEl) {
      this.noteClefTrebleBtnEl.addEventListener("click", () => this.setNoteClef("treble"));
    }

    if (this.replayIntervalBtnEl) {
      this.replayIntervalBtnEl.addEventListener("click", () => this.replayInterval());
    }

    window.addEventListener("keydown", (event) => this.handleRhythmKeydown(event));
    window.addEventListener("resize", () => this.rebuildKeyboard());
    window.addEventListener("resize", () => this.updateFeedbackPosition());
    window.addEventListener("scroll", () => this.updateFeedbackPosition(), { passive: true });

    this.pickNextNote();
    this.pickNextInterval(false);
    this.generateRhythmRound();
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

  bindRhythmControls() {
    if (this.rhythmBpmInputEl) {
      this.rhythmBpmInputEl.value = String(this.state.rhythm.bpm);
      this.rhythmBpmInputEl.addEventListener("change", () => {
        const next = clampNumber(this.rhythmBpmInputEl.value, RHYTHM_MIN_BPM, RHYTHM_MAX_BPM);
        this.state.rhythm.bpm = next;
        this.rhythmBpmInputEl.value = String(next);
        this.updateRhythmHint();
      });
    }

    if (this.rhythmStartBtnEl) {
      this.rhythmStartBtnEl.addEventListener("click", () => {
        this.startRhythmRound();
      });
    }

    if (this.rhythmRegenerateBtnEl) {
      this.rhythmRegenerateBtnEl.addEventListener("click", () => {
        this.generateRhythmRound();
      });
    }

    if (this.rhythmPatternToggleEls.length) {
      const selectedIds = new Set(this.state.rhythm.enabledPatternIds);
      this.rhythmPatternToggleEls.forEach((toggleEl) => {
        const patternId = toggleEl.dataset.patternId;
        if (!patternId) return;
        toggleEl.checked = selectedIds.has(patternId);
        toggleEl.addEventListener("change", () => {
          this.handleRhythmPatternToggle(toggleEl, patternId);
        });
      });
    }

    if (this.rhythmSectionEl) {
      this.rhythmSectionEl.addEventListener("pointerdown", (event) => {
        if (!(event.target instanceof HTMLElement)) return;
        const interactive = event.target.closest("button, input, label");
        if (interactive) return;
        this.handleRhythmInput();
      });
    }
  }

  handleRhythmPatternToggle(toggleEl, patternId) {
    const selected = new Set(this.state.rhythm.enabledPatternIds);
    if (toggleEl.checked) {
      selected.add(patternId);
    } else {
      selected.delete(patternId);
      if (selected.size === 0) {
        selected.add(patternId);
        toggleEl.checked = true;
      }
    }

    this.state.rhythm.enabledPatternIds = Array.from(selected);
    this.generateRhythmRound();
  }

  getEnabledRhythmPatterns() {
    const selectedIds = new Set(this.state.rhythm.enabledPatternIds);
    const enabled = RHYTHM_PATTERNS.filter((pattern) => selectedIds.has(pattern.id));
    return enabled.length ? enabled : [RHYTHM_PATTERNS[0]];
  }

  setMode(mode) {
    if (mode !== "notes" && mode !== "intervals" && mode !== "rhythm") return;

    const previousMode = this.state.mode;
    this.clearPendingRoundTransition();
    this.state.mode = mode;

    if (previousMode === "rhythm" && mode !== "rhythm") {
      this.stopRhythmRound();
    }

    const notesMode = mode === "notes";
    const intervalMode = mode === "intervals";
    const rhythmMode = mode === "rhythm";

    this.notesSectionEl.classList.toggle("hidden", !notesMode);
    this.intervalSectionEl.classList.toggle("hidden", !intervalMode);
    this.rhythmSectionEl.classList.toggle("hidden", !rhythmMode);
    this.updateSettingsPanelsVisibility();
    this.modeNotesBtnEl.classList.toggle("active", notesMode);
    this.modeIntervalsBtnEl.classList.toggle("active", intervalMode);
    this.modeRhythmBtnEl.classList.toggle("active", rhythmMode);
    this.updateClefButtons();

    if (notesMode) {
      if (this.state.note.targetMidi == null) {
        this.pickNextNote();
      }
      this.setMessage("", "");
      this.centerKeyboardViewport();
    } else if (intervalMode) {
      if (this.state.interval.targetSemitones == null) {
        this.pickNextInterval(true);
      }
      this.setIntervalMessage("", "");
      this.replayInterval();
    } else {
      if (!this.state.rhythm.sequence.length) {
        this.generateRhythmRound();
      }
      this.setMessage("", "");
      this.updateRhythmHint();
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

  createRhythmGrid() {
    if (!this.rhythmGridEl) return;

    this.rhythmGridEl.innerHTML = "";
    this.rhythmCells = [];

    for (let beat = 0; beat < RHYTHM_TOTAL_BEATS; beat += 1) {
      const cell = document.createElement("div");
      cell.className = "rhythm-cell";

      const bodyEl = document.createElement("div");
      bodyEl.className = "rhythm-cell-body";
      bodyEl.textContent = "♩";

      const hitsEl = document.createElement("div");
      hitsEl.className = "rhythm-cell-hits";

      cell.appendChild(bodyEl);
      cell.appendChild(hitsEl);
      this.rhythmGridEl.appendChild(cell);

      this.rhythmCells.push({
        root: cell,
        bodyEl,
        hitsEl,
        dots: [],
      });
    }
  }

  renderRhythmGrid() {
    this.state.rhythm.sequence.forEach((pattern, beatIndex) => {
      const cell = this.rhythmCells[beatIndex];
      if (!cell) return;

      cell.root.classList.remove("is-active", "is-good", "is-bad");
      cell.bodyEl.textContent = pattern.icon;
      cell.bodyEl.setAttribute("title", pattern.label);
      cell.hitsEl.innerHTML = "";
      cell.dots = [];

      pattern.offsets.forEach(() => {
        const dot = document.createElement("span");
        dot.className = "rhythm-hit-dot";
        cell.hitsEl.appendChild(dot);
        cell.dots.push(dot);
      });
    });
  }

  generateRhythmRound() {
    this.stopRhythmRound();
    const enabledPatterns = this.getEnabledRhythmPatterns();

    const sequence = [];
    let previous = null;

    for (let beat = 0; beat < RHYTHM_TOTAL_BEATS; beat += 1) {
      const pattern = pickRandomRhythmPattern(enabledPatterns, previous);
      sequence.push(pattern);
      previous = pattern.id;
    }

    this.state.rhythm.sequence = sequence;
    this.state.rhythm.expectedHits = sequence.flatMap((pattern, beatIndex) =>
      pattern.offsets.map((offset, hitIndex) => ({
        beatIndex,
        hitIndex,
        offset,
        time: 0,
        matched: false,
        missed: false,
      }))
    );

    this.renderRhythmGrid();
    this.updateRhythmHint();

    if (this.state.mode === "rhythm") {
      this.updateStats();
    }
  }

  startRhythmRound() {
    if (!this.state.rhythm.sequence.length) {
      this.generateRhythmRound();
    }

    this.stopRhythmRound();

    const beatMs = this.getBeatDurationMs();
    const startTime = performance.now() + RHYTHM_START_LEAD_IN_MS;

    this.state.rhythm.startTime = startTime;
    this.state.rhythm.currentBeat = -1;
    this.state.rhythm.running = true;

    this.state.rhythm.expectedHits.forEach((hit) => {
      hit.time = startTime + (hit.beatIndex + hit.offset) * beatMs;
      hit.matched = false;
      hit.missed = false;

      const dot = this.getRhythmDot(hit.beatIndex, hit.hitIndex);
      if (dot) {
        dot.classList.remove("is-hit", "is-miss");
      }
    });

    this.rhythmCells.forEach((cell) => {
      cell.root.classList.remove("is-active", "is-good", "is-bad", "is-off");
    });

    if (this.rhythmStartBtnEl) {
      this.rhythmStartBtnEl.textContent = "Идет...";
    }

    this.updateRhythmHint("Раунд запущен. Жми Space или кликай в такт.");
    this.updateStats();
    this.runRhythmFrame();
  }

  stopRhythmRound() {
    if (this.rhythmRafId !== null) {
      window.cancelAnimationFrame(this.rhythmRafId);
      this.rhythmRafId = null;
    }

    this.state.rhythm.running = false;
    this.state.rhythm.currentBeat = -1;

    this.rhythmCells.forEach((cell) => {
      cell.root.classList.remove("is-active");
    });

    if (this.rhythmStartBtnEl) {
      this.rhythmStartBtnEl.textContent = "Старт";
    }
  }

  runRhythmFrame() {
    if (!this.state.rhythm.running) return;

    const now = performance.now();
    const elapsed = now - this.state.rhythm.startTime;
    const beatMs = this.getBeatDurationMs();

    if (elapsed >= 0) {
      const beatIndex = Math.floor(elapsed / beatMs);
      if (beatIndex !== this.state.rhythm.currentBeat) {
        const previousBeat = this.state.rhythm.currentBeat;
        this.state.rhythm.currentBeat = beatIndex;

        if (beatIndex >= 0 && beatIndex < RHYTHM_TOTAL_BEATS) {
          this.rhythmCells.forEach((cell, index) => {
            cell.root.classList.toggle("is-active", index === beatIndex);
          });
        }

        for (let pulse = previousBeat + 1; pulse <= beatIndex; pulse += 1) {
          if (pulse >= 0 && pulse < RHYTHM_TOTAL_BEATS) {
            this.playRhythmPulse(pulse);
          }
        }
      }
    }

    this.markRhythmMisses(now);

    const finishedByBeats = elapsed >= beatMs * RHYTHM_TOTAL_BEATS;
    const finishedByEvents = this.state.rhythm.expectedHits.every((hit) => hit.matched || hit.missed);

    if (finishedByBeats && finishedByEvents) {
      this.finishRhythmRound();
      return;
    }

    this.rhythmRafId = window.requestAnimationFrame(() => this.runRhythmFrame());
  }

  finishRhythmRound() {
    this.stopRhythmRound();

    const totalExpected = this.state.rhythm.expectedHits.length;
    const matched = this.state.rhythm.expectedHits.filter((hit) => hit.matched).length;

    this.updateRhythmHint(`Готово: ${matched}/${totalExpected} попаданий. Можно повторить или сделать новый ритм.`);
    if (this.state.mode === "rhythm") {
      this.updateStats();
    }
  }

  handleRhythmKeydown(event) {
    if (this.state.mode !== "rhythm") return;
    if (event.code !== "Space") return;

    event.preventDefault();
    this.handleRhythmInput();
  }

  handleRhythmInput() {
    if (this.state.mode !== "rhythm") return;
    if (!this.state.rhythm.running) return;

    const now = performance.now();
    this.state.rhythm.attempts += 1;

    const nearest = this.findNearestExpectedHit(now);
    if (!nearest) {
      const activeBeat = this.state.rhythm.currentBeat;
      if (activeBeat >= 0 && activeBeat < RHYTHM_TOTAL_BEATS) {
        const cell = this.rhythmCells[activeBeat];
        if (cell) {
          cell.root.classList.add("is-off");
          window.setTimeout(() => {
            cell.root.classList.remove("is-off");
          }, 140);
        }
      }

      this.updateStats();
      return;
    }

    nearest.matched = true;
    this.state.rhythm.correct += 1;

    const dot = this.getRhythmDot(nearest.beatIndex, nearest.hitIndex);
    if (dot) {
      dot.classList.add("is-hit");
    }

    this.refreshRhythmCellResult(nearest.beatIndex);
    this.updateStats();
  }

  findNearestExpectedHit(now) {
    let nearest = null;
    let nearestDistance = Infinity;

    this.state.rhythm.expectedHits.forEach((hit) => {
      if (hit.matched || hit.missed) return;
      const distance = Math.abs(now - hit.time);
      if (distance > RHYTHM_HIT_TOLERANCE_MS) return;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = hit;
      }
    });

    return nearest;
  }

  markRhythmMisses(now) {
    this.state.rhythm.expectedHits.forEach((hit) => {
      if (hit.matched || hit.missed) return;
      if (now <= hit.time + RHYTHM_HIT_TOLERANCE_MS) return;

      hit.missed = true;
      this.state.rhythm.attempts += 1;

      const dot = this.getRhythmDot(hit.beatIndex, hit.hitIndex);
      if (dot) {
        dot.classList.add("is-miss");
      }

      this.refreshRhythmCellResult(hit.beatIndex);
    });

    if (this.state.mode === "rhythm") {
      this.updateStats();
    }
  }

  refreshRhythmCellResult(beatIndex) {
    const cell = this.rhythmCells[beatIndex];
    if (!cell) return;

    const total = cell.dots.length;
    const hitCount = cell.dots.filter((dot) => dot.classList.contains("is-hit")).length;
    const missCount = cell.dots.filter((dot) => dot.classList.contains("is-miss")).length;

    const resolved = hitCount + missCount;
    if (resolved < total) return;

    cell.root.classList.remove("is-good", "is-bad");
    cell.root.classList.add(missCount === 0 ? "is-good" : "is-bad");
  }

  getRhythmDot(beatIndex, hitIndex) {
    const cell = this.rhythmCells[beatIndex];
    if (!cell) return null;
    return cell.dots[hitIndex] || null;
  }

  playRhythmPulse(beatIndex) {
    this.pianoAudio.playMetronomeTick({ accent: beatIndex % 4 === 0 });
  }

  getBeatDurationMs() {
    return 60000 / this.state.rhythm.bpm;
  }

  updateRhythmHint(message = "") {
    if (!this.rhythmHintEl) return;

    if (message) {
      this.rhythmHintEl.textContent = message;
      return;
    }

    const enabled = this.getEnabledRhythmPatterns()
      .map((pattern) => pattern.icon)
      .join(" ");
    this.rhythmHintEl.textContent = `BPM: ${this.state.rhythm.bpm}. Длительности: ${enabled}.`;
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

  updateThemeIcon() {
    if (!this.themeIconBtnEl) return;
    this.themeIconBtnEl.textContent = this.state.darkTheme ? "☀" : "🌙";
    this.themeIconBtnEl.setAttribute(
      "aria-label",
      this.state.darkTheme ? "Переключить на светлую тему" : "Переключить на темную тему"
    );
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

  readNoteClefSetting() {
    try {
      const saved = localStorage.getItem(NOTE_CLEF_STORAGE_KEY);
      if (saved === "treble") return "treble";
    } catch {}
    return "bass";
  }

  persistNoteClefSetting() {
    try {
      localStorage.setItem(NOTE_CLEF_STORAGE_KEY, this.state.note.clef);
    } catch {}
  }

  setNoteClef(clef) {
    if (clef !== "bass" && clef !== "treble") return;
    if (this.state.note.clef === clef) return;
    this.state.note.clef = clef;
    this.persistNoteClefSetting();
    this.updateClefButtons();

    if (this.state.mode === "notes") {
      this.pickNextNote();
    }
  }

  updateClefButtons() {
    if (this.noteClefBassBtnEl) {
      this.noteClefBassBtnEl.classList.toggle("active", this.state.note.clef === "bass");
    }
    if (this.noteClefTrebleBtnEl) {
      this.noteClefTrebleBtnEl.classList.toggle("active", this.state.note.clef === "treble");
    }
  }

  updateSettingsPanelsVisibility() {
    const mode = this.state.mode;
    if (this.notesSettingsEl) this.notesSettingsEl.classList.toggle("hidden", mode !== "notes");
    if (this.intervalSettingsEl) this.intervalSettingsEl.classList.toggle("hidden", mode !== "intervals");
    if (this.rhythmSettingsEl) this.rhythmSettingsEl.classList.toggle("hidden", mode !== "rhythm");
  }

  buildAllPracticePools(includeAccidentals) {
    return {
      bass: buildPracticePoolByAccidentals(includeAccidentals),
      treble: buildTreblePracticePool(includeAccidentals),
    };
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
    this.practicePools = this.buildAllPracticePools(this.state.includeAccidentals);

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
    let stats = this.state.note;
    if (this.state.mode === "intervals") stats = this.state.interval;
    if (this.state.mode === "rhythm") stats = this.state.rhythm;

    this.attemptsEl.textContent = String(stats.attempts);
    this.correctEl.textContent = String(stats.correct);
    const accuracy = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;
    this.accuracyEl.textContent = `${accuracy}%`;
  }

  drawTargetNote() {
    this.noteViewEl.innerHTML = renderNoteSvg(this.state.note.targetMidi, this.state.note.clef);
    const clefLabel = this.state.note.clef === "treble" ? "скрипичном" : "басовом";
    this.noteViewEl.setAttribute("aria-label", `На нотном стане показана нота в ${clefLabel} ключе`);
  }

  pickNextNote() {
    this.clearKeyMarks();
    const previous = this.state.note.targetMidi;
    const currentPool = this.practicePools[this.state.note.clef] || [];
    this.state.note.targetMidi = pickRandomMidi(currentPool, previous);
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

function buildTreblePracticePool(includeAccidentals) {
  const result = [];
  for (let midi = TREBLE_PRACTICE_MIN_MIDI; midi <= TREBLE_PRACTICE_MAX_MIDI; midi += 1) {
    if (!includeAccidentals && isAccidentalMidi(midi)) continue;
    result.push(midi);
  }
  return result;
}

function isAccidentalMidi(midi) {
  const semitone = midi % 12;
  return [1, 3, 6, 8, 10].includes(semitone);
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

function pickRandomRhythmPattern(patterns, previousPatternId = null) {
  if (patterns.length === 1) {
    return patterns[0];
  }

  let candidate = patterns[Math.floor(Math.random() * patterns.length)];
  while (candidate.id === previousPatternId) {
    candidate = patterns[Math.floor(Math.random() * patterns.length)];
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

function clampNumber(value, min, max) {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num)) return min;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}
