import { describe, expect, it } from 'vitest';
import { fromText, toPrintModel } from '../src/lib/resume-doc';

const RESUME = `Maya Torres
maya@example.edu

Experience
Campus Radio, Social Media Lead
- Posted three times a week
- Grew the Instagram account from 400 to 2,100 followers

Education
State University, B.A. Communication`;

describe('bullets added to a tailored copy', () => {
  const doc = fromText(RESUME);
  const bullets = toPrintModel(doc).paragraphs.filter((p) => p.kind === 'bullet');

  it('places an added bullet after the chosen line', () => {
    const model = toPrintModel(doc, {
      addedBullets: [{ afterLineId: bullets[0].lineId, text: '- Scheduled 30 volunteers a week' }],
    });
    const texts = model.paragraphs.map((p) => p.text);
    const at = texts.indexOf('Posted three times a week');
    expect(texts[at + 1]).toBe('Scheduled 30 volunteers a week');
    expect(model.paragraphs[at + 1].kind).toBe('bullet');
    expect(texts[at + 2]).toContain('Grew the Instagram');
  });

  it('keeps two additions after the same line in the order given', () => {
    const model = toPrintModel(doc, {
      addedBullets: [
        { afterLineId: bullets[1].lineId, text: 'First added' },
        { afterLineId: bullets[1].lineId, text: 'Second added' },
      ],
    });
    const texts = model.paragraphs.map((p) => p.text);
    expect(texts.indexOf('Second added')).toBe(texts.indexOf('First added') + 1);
    expect(texts.indexOf('First added')).toBe(
      texts.findIndex((t) => t.includes('Grew the Instagram')) + 1
    );
  });

  it('puts a bullet whose line was left out after the last bullet, never at the top', () => {
    const model = toPrintModel(doc, {
      bulletLineIds: new Set([bullets[1].lineId]),
      addedBullets: [{ afterLineId: bullets[0].lineId, text: 'Added anyway' }],
    });
    const texts = model.paragraphs.map((p) => p.text);
    expect(texts.indexOf('Added anyway')).toBe(
      texts.findIndex((t) => t.includes('Grew the Instagram')) + 1
    );
  });

  it('ignores an empty addition and leaves the resume as it was with none', () => {
    expect(
      toPrintModel(doc, { addedBullets: [{ afterLineId: bullets[0].lineId, text: '  ' }] })
    ).toEqual(toPrintModel(doc));
  });
});
