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
      key.style.left = `${whiteIndex * whiteWidth}px`;
      whiteIndex += 1;
    }

    key.addEventListener("click", () => onPress(midi));

    root.appendChild(key);
    keysByMidi.set(midi, key);
  }

  root.style.width = `${whiteIndex * whiteWidth}px`;
  return keysByMidi;
}
