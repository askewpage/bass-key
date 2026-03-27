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

  const linesSvg = Array.from({ length: 5 }, (_, i) => {
    const ly = topLineY + i * lineGap;
    return `<line x1="${staffX1}" y1="${ly}" x2="${staffX2}" y2="${ly}" stroke="#111" stroke-width="1.5" />`;
  }).join("\n");

  const ledgerSvg = ledger
    .map(
      (ly) =>
        `<line x1="${noteX - 22}" y1="${ly}" x2="${noteX + 22}" y2="${ly}" stroke="#111" stroke-width="1.4" />`
    )
    .join("\n");

  return `
  <svg width="100%" viewBox="0 0 560 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="0" y="0" width="560" height="200" fill="#fff" />
    ${linesSvg}
    ${ledgerSvg}
    <text x="100" y="110" font-size="88" font-family="'Times New Roman', serif">𝄢</text>
    ${accidentalGlyph ? `<text x="248" y="${y + 9}" font-size="32" font-family="'Times New Roman', serif">${accidentalGlyph}</text>` : ""}
    <ellipse cx="${noteX}" cy="${y}" rx="14" ry="9.4" fill="#111" transform="rotate(-17 ${noteX} ${y})" />
  </svg>`;
}
