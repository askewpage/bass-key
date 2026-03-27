import { BassClefTrainer } from "./game.js";

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

trainer.init();
