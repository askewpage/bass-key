const STORAGE_KEY = "bass_clef_trainer_stats_v1";

export class StatsStore {
  constructor() {
    this.data = this.#load();
    this.saveTimer = null;
  }

  recordAttempt({ targetMidi, targetName, pressedMidi, pressedName, includeAccidentals, isCorrect }) {
    this.data.meta.totalAttempts += 1;
    if (isCorrect) {
      this.data.meta.totalCorrect += 1;
    }
    this.data.meta.updatedAt = new Date().toISOString();

    const modeKey = includeAccidentals ? "withAccidentals" : "withoutAccidentals";
    this.data.byMode[modeKey].attempts += 1;
    if (isCorrect) {
      this.data.byMode[modeKey].correct += 1;
    } else {
      this.data.byMode[modeKey].errors += 1;
    }

    const noteStats = this.#ensureNote(targetMidi, targetName);
    noteStats.attempts += 1;
    if (isCorrect) {
      noteStats.correct += 1;
      noteStats.streakGood += 1;
      noteStats.streakBad = 0;
    } else {
      noteStats.errors += 1;
      noteStats.streakBad += 1;
      noteStats.streakGood = 0;
    }

    if (!isCorrect) {
      const pairKey = `${targetName}=>${pressedName}`;
      this.data.mistakePairs[pairKey] = (this.data.mistakePairs[pairKey] || 0) + 1;
    }

    this.#scheduleSave();
  }

  exportToFile() {
    const report = this.buildReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `bass-clef-stats-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  reset() {
    this.data = createEmptyData();
    this.#saveNow();
  }

  buildReport() {
    const notes = Object.values(this.data.byNote).map((item) => ({
      ...item,
      errorRate: toPercent(item.errors, item.attempts),
      accuracy: toPercent(item.correct, item.attempts),
    }));

    const topProblemNotes = [...notes]
      .filter((n) => n.attempts >= 3)
      .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors)
      .slice(0, 10);

    const topIdealNotes = [...notes]
      .filter((n) => n.attempts >= 3)
      .sort((a, b) => b.accuracy - a.accuracy || b.correct - a.correct)
      .slice(0, 10);

    const topMistakePairs = Object.entries(this.data.mistakePairs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([pair, count]) => ({ pair, count }));

    const byMode = {
      withAccidentals: withRates(this.data.byMode.withAccidentals),
      withoutAccidentals: withRates(this.data.byMode.withoutAccidentals),
    };

    return {
      ...this.data,
      summary: {
        generatedAt: new Date().toISOString(),
        totalAccuracy: toPercent(this.data.meta.totalCorrect, this.data.meta.totalAttempts),
        byMode,
        topProblemNotes,
        topIdealNotes,
        topMistakePairs,
      },
    };
  }

  #ensureNote(midi, name) {
    const key = String(midi);
    if (!this.data.byNote[key]) {
      this.data.byNote[key] = {
        midi,
        name,
        attempts: 0,
        correct: 0,
        errors: 0,
        streakGood: 0,
        streakBad: 0,
      };
    }
    return this.data.byNote[key];
  }

  #scheduleSave() {
    if (this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.#saveNow();
      this.saveTimer = null;
    }, 250);
  }

  #saveNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.warn("Stats save failed:", error);
    }
  }

  #load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createEmptyData();
      const parsed = JSON.parse(raw);
      return mergeWithDefaults(parsed);
    } catch {
      return createEmptyData();
    }
  }
}

function createEmptyData() {
  return {
    version: 1,
    meta: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalAttempts: 0,
      totalCorrect: 0,
    },
    byMode: {
      withAccidentals: { attempts: 0, correct: 0, errors: 0 },
      withoutAccidentals: { attempts: 0, correct: 0, errors: 0 },
    },
    byNote: {},
    mistakePairs: {},
  };
}

function mergeWithDefaults(parsed) {
  const defaults = createEmptyData();
  return {
    ...defaults,
    ...parsed,
    meta: { ...defaults.meta, ...(parsed.meta || {}) },
    byMode: {
      withAccidentals: {
        ...defaults.byMode.withAccidentals,
        ...(parsed.byMode?.withAccidentals || {}),
      },
      withoutAccidentals: {
        ...defaults.byMode.withoutAccidentals,
        ...(parsed.byMode?.withoutAccidentals || {}),
      },
    },
    byNote: parsed.byNote || {},
    mistakePairs: parsed.mistakePairs || {},
  };
}

function toPercent(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

function withRates(modeStats) {
  return {
    ...modeStats,
    accuracy: toPercent(modeStats.correct, modeStats.attempts),
    errorRate: toPercent(modeStats.errors, modeStats.attempts),
  };
}
