import { BassClefTrainer } from "./game.js";

const settingsDockEl = document.getElementById("settingsDock");
const settingsGearBtnEl = document.getElementById("settingsGearBtn");

const setSettingsOpen = (isOpen) => {
  if (!settingsDockEl || !settingsGearBtnEl) return;
  settingsDockEl.classList.toggle("is-open", isOpen);
  settingsGearBtnEl.setAttribute("aria-expanded", String(isOpen));
};

const setupSettingsMenu = () => {
  if (!settingsDockEl || !settingsGearBtnEl) return;

  settingsGearBtnEl.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = settingsDockEl.classList.contains("is-open");
    setSettingsOpen(!isOpen);
  });

  settingsDockEl.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Node)) return;
    if (!settingsDockEl.contains(event.target)) {
      setSettingsOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSettingsOpen(false);
    }
  });
};

const trainer = new BassClefTrainer({
  appEl: document.querySelector(".app"),
  noteViewEl: document.getElementById("noteView"),
  keyboardEl: document.getElementById("keyboard"),
  keyboardWrapEl: document.getElementById("keyboardWrap"),
  notesSectionEl: document.getElementById("notesSection"),
  intervalSectionEl: document.getElementById("intervalSection"),
  modeNotesBtnEl: document.getElementById("modeNotesBtn"),
  modeIntervalsBtnEl: document.getElementById("modeIntervalsBtn"),
  attemptsEl: document.getElementById("attempts"),
  correctEl: document.getElementById("correct"),
  accuracyEl: document.getElementById("accuracy"),
  messageEl: document.getElementById("floatingFeedback"),
  intervalMessageEl: document.getElementById("floatingFeedback"),
  replayIntervalBtnEl: document.getElementById("replayIntervalBtn"),
  intervalButtonsEl: document.getElementById("intervalButtons"),
  showLabelsToggleEl: document.getElementById("showLabelsToggle"),
  accidentalsToggleEl: document.getElementById("accidentalsToggle"),
  themeToggleEl: document.getElementById("themeToggle"),
});

setupSettingsMenu();
trainer.init();
