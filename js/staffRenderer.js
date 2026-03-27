import { midiToDisplaySpelling, staffYForNote } from "./music.js";

function buildLedgerLines(y, firstLineY, fifthLineY, lineGap) {
  const lines = [];

  if (y < firstLineY) {
    for (let ly = firstLineY - lineGap; ly >= y; ly -= lineGap) {
      lines.push(ly);
    }
  }

  if (y > fifthLineY) {
    for (let ly = fifthLineY + lineGap; ly <= y; ly += lineGap) {
      lines.push(ly);
    }
  }

  return lines;
}

export function renderBassNoteSvg(targetMidi) {
  const note = midiToDisplaySpelling(targetMidi);
  const y = staffYForNote(note.letter, note.octave);

  const topLineY = 72;
  const lineGap = 16;
  const firstLineY = topLineY;
  const fifthLineY = topLineY + lineGap * 4;
  const noteX = 300;
  const staffX1 = 74;
  const staffX2 = 470;

  const ledger = buildLedgerLines(y, firstLineY, fifthLineY, lineGap);
  const accidentalGlyph = note.accidental === "#" ? "♯" : note.accidental === "b" ? "♭" : "";
  const bassFLineY = topLineY + lineGap;

  const linesSvg = Array.from({ length: 5 }, (_, i) => {
    const ly = topLineY + i * lineGap;
    return `<line x1="${staffX1}" y1="${ly}" x2="${staffX2}" y2="${ly}" stroke="currentColor" stroke-width="1.5" />`;
  }).join("\n");

  const ledgerSvg = ledger
    .map(
      (ly) =>
        `<line x1="${noteX - 22}" y1="${ly}" x2="${noteX + 22}" y2="${ly}" stroke="currentColor" stroke-width="1.4" />`
    )
    .join("\n");

  return `
  <svg width="100%" viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="color: var(--ink);">
    ${linesSvg}
    ${ledgerSvg}
    <path
      d="M132 ${bassFLineY - 40}
         C101 ${bassFLineY - 40}, 93 ${bassFLineY + 10}, 124 ${bassFLineY + 10}
         C142 ${bassFLineY + 10}, 147 ${bassFLineY - 7}, 136 ${bassFLineY - 14}
         C121 ${bassFLineY - 23}, 108 ${bassFLineY - 10}, 108 ${bassFLineY + 8}
         C108 ${bassFLineY + 30}, 123 ${bassFLineY + 44}, 142 ${bassFLineY + 44}"
      fill="none"
      stroke="currentColor"
      stroke-width="5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle cx="138" cy="${bassFLineY + 4}" r="4.8" fill="currentColor" />
    <circle cx="165" cy="${bassFLineY - 6}" r="3.2" fill="currentColor" />
    <circle cx="165" cy="${bassFLineY + 6}" r="3.2" fill="currentColor" />
    ${accidentalGlyph ? `<text x="248" y="${y + 9}" font-size="32" font-family="'Times New Roman', serif" fill="currentColor">${accidentalGlyph}</text>` : ""}
    <ellipse cx="${noteX}" cy="${y}" rx="14" ry="9.4" fill="currentColor" transform="rotate(-17 ${noteX} ${y})" />
  </svg>`;
}
