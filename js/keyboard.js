import { isBlackKey, midiToName } from "./music.js";

function getKeyboardGeometry() {
  const compact = window.innerWidth <= 720;
  return {
    whiteWidth: compact ? 34 : 40,
    blackWidth: compact ? 22 : 25,
  };
}

export function createKeyboard({ root, startMidi, endMidi, onPress }) {
  root.innerHTML = "";

  const { whiteWidth, blackWidth } = getKeyboardGeometry();
  const keysByMidi = new Map();
  const whiteLeftByMidi = new Map();
  let whiteIndex = 0;

  for (let midi = startMidi; midi <= endMidi; midi += 1) {
    const semitone = midi % 12;
    const black = isBlackKey(semitone);

    const key = document.createElement("button");
    key.type = "button";
    key.className = `key ${black ? "black" : "white"}`;
    key.dataset.midi = String(midi);
    key.setAttribute("aria-label", `Клавиша ${midiToName(midi)}`);

    const label = document.createElement("span");
    label.className = "key-label";
    label.textContent = midiToName(midi);
    key.appendChild(label);

    if (black) {
      key.style.left = `${whiteIndex * whiteWidth - Math.round(blackWidth / 2)}px`;
    } else {
      const left = whiteIndex * whiteWidth;
      key.style.left = `${left}px`;
      whiteLeftByMidi.set(midi, left);
      whiteIndex += 1;
    }

    key.addEventListener("click", () => onPress(midi));

    root.appendChild(key);
    keysByMidi.set(midi, key);
  }

  root.style.width = `${whiteIndex * whiteWidth}px`;
  appendOctaveMarkers({ root, startMidi, endMidi, whiteWidth, whiteLeftByMidi });
  return keysByMidi;
}

function appendOctaveMarkers({ root, startMidi, endMidi, whiteWidth, whiteLeftByMidi }) {
  const startOctave = Math.floor(startMidi / 12) - 1;
  const endOctave = Math.floor(endMidi / 12) - 1;

  for (let octave = startOctave; octave <= endOctave; octave += 1) {
    const octaveStartMidi = Math.max(startMidi, (octave + 1) * 12);
    const octaveEndMidi = Math.min(endMidi, (octave + 2) * 12 - 1);

    const firstWhiteMidi = findFirstWhiteMidi(octaveStartMidi, octaveEndMidi);
    const lastWhiteMidi = findLastWhiteMidi(octaveEndMidi, octaveStartMidi);
    if (firstWhiteMidi == null || lastWhiteMidi == null) continue;

    const left = whiteLeftByMidi.get(firstWhiteMidi);
    const rightStart = whiteLeftByMidi.get(lastWhiteMidi);
    if (left == null || rightStart == null) continue;

    const marker = document.createElement("div");
    marker.className = "octave-marker";
    marker.style.left = `${left}px`;
    marker.style.width = `${rightStart + whiteWidth - left}px`;
    marker.innerHTML = `
      <span class="octave-brace" aria-hidden="true"></span>
      <span class="octave-label">${getOctaveName(octave)}</span>
    `;
    root.appendChild(marker);
  }
}

function findFirstWhiteMidi(startMidi, endMidi) {
  for (let midi = startMidi; midi <= endMidi; midi += 1) {
    if (!isBlackKey(midi % 12)) return midi;
  }
  return null;
}

function findLastWhiteMidi(startMidi, endMidi) {
  for (let midi = startMidi; midi >= endMidi; midi -= 1) {
    if (!isBlackKey(midi % 12)) return midi;
  }
  return null;
}

function getOctaveName(octave) {
  if (octave === 1) return "Контроктава";
  if (octave === 2) return "Большая";
  if (octave === 3) return "Малая";
  if (octave === 4) return "Первая";
  if (octave === 5) return "Вторая";
  if (octave === 6) return "Третья";
  if (octave === 7) return "Четвертая";
  return `${octave}-я`;
}
