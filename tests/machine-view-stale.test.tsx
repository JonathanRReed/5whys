import { File as NodeFile } from 'node:buffer';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import MachineView from '../src/components/resume-game/MachineView';
import type { ResumeDoc } from '../src/lib/resume-doc';
import { extractDocx, toEditorText } from '../src/lib/resume-doc';
import { docxBytes, xmlParagraph } from './fixtures/resume-doc';

beforeAll(() => {
  vi.stubGlobal('File', NodeFile);
});
afterAll(() => {
  vi.unstubAllGlobals();
});
afterEach(cleanup);

async function jordan(): Promise<ResumeDoc> {
  const doc = await extractDocx(
    await docxBytes(
      [
        'Jordan Lee',
        'jordan@example.edu',
        'EXPERIENCE',
        'Developer, Acme | Jan 2024 - Dec 2025',
        '• Built forms for 10 campus clubs.',
      ]
        .map((line) => xmlParagraph(line))
        .join(''),
      {}
    ),
    'header-footer.docx'
  );
  return { ...doc, sourceText: toEditorText(doc) };
}

const avery =
  'Avery Chen\navery@example.edu\nEXPERIENCE\n• Rebuilt the campus library sign-up form, so more students could reserve rooms.';

it('holds back the clean copy when the paste field no longer holds the uploaded resume', async () => {
  const doc = await jordan();
  const onChange = vi.fn();
  render(<MachineView doc={doc} onChange={onChange} text={avery} />);
  expect(screen.getByTestId('clean-copy-stale')).toHaveTextContent(
    'The text above has changed since header-footer.docx was read.'
  );
  expect(screen.getByRole('button', { name: 'Download clean .docx' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Print or save as PDF' })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Build the clean copy from the text above' }));
  expect(onChange).toHaveBeenCalledOnce();
  const rebuilt: ResumeDoc = onChange.mock.calls[0][0];
  expect(rebuilt.plainText).toContain('Avery Chen');
  expect(rebuilt.plainText).not.toContain('Jordan');
  expect(rebuilt.sourceText).toBe(avery);
});

it('offers the clean copy while the paste field still holds what was read', async () => {
  const doc = await jordan();
  render(<MachineView doc={doc} onChange={vi.fn()} text={doc.sourceText} />);
  expect(screen.queryByTestId('clean-copy-stale')).toBeNull();
  expect(screen.getByRole('button', { name: 'Download clean .docx' })).toBeEnabled();
});
