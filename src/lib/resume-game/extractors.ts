import { loadFeature } from '../lazy-feature';
import { MAX_RESUME_TEXT, ResumeLimitError } from '../resume-doc/limits';

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large. Maximum size is 5MB.');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'txt' || ext === 'md' || ext === 'markdown' || ext === 'text') {
    const text = await file.text();
    if (text.length > MAX_RESUME_TEXT) {
      throw new ResumeLimitError(
        'This file contains too much text. Upload only your resume or paste the text.'
      );
    }
    return text;
  }

  if (ext === 'docx') {
    return extractDocx(file);
  }

  if (ext === 'pdf') {
    return extractPdf(file);
  }

  throw new Error('Unsupported file type. Use PDF, DOCX, TXT, or Markdown.');
}

async function extractDocx(file: File): Promise<string> {
  try {
    // The same ZIP, expansion, and text limits as the structured reader: a
    // file that reader refused for its size is refused here too.
    const { readDocxDocumentXml } = await loadFeature(import('../resume-doc/docx'));
    const xml = await readDocxDocumentXml(new Uint8Array(await file.arrayBuffer()));
    if (!xml) {
      throw new Error(
        'This DOCX file appears corrupted or empty. Try: (1) Re-save in Word, (2) Use .txt format, or (3) Copy-paste text directly.'
      );
    }

    // Strip XML tags and normalize whitespace
    const text = xml
      .replace(/<w:p>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\s+/g, ' ')
      .replace(/\n /g, '\n')
      .replace(/ \n/g, '\n')
      .trim();

    if (text.length > MAX_RESUME_TEXT) {
      throw new ResumeLimitError('This DOCX contains too much text.');
    }

    if (text.length < 20) {
      throw new Error(
        'DOCX extracted very little text. Try: (1) Re-save in Word, (2) Use .txt format, or (3) Copy-paste text directly.'
      );
    }

    return text;
  } catch (err) {
    if (
      err instanceof ResumeLimitError ||
      (err instanceof Error &&
        (err.message.startsWith('This DOCX') || err.message.startsWith('DOCX extracted')))
    ) {
      throw err;
    }
    throw new Error('Could not extract text from DOCX. Try pasting the text manually.', {
      cause: err,
    });
  }
}

async function extractPdf(file: File): Promise<string> {
  const { readPdfText } = await loadFeature(import('./pdf-extractor'));
  return readPdfText(file);
}
