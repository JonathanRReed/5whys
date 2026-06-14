import JSZip from 'jszip';

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (ext === 'txt' || ext === 'md' || ext === 'markdown' || ext === 'text') {
    return file.text();
  }

  if (ext === 'docx') {
    return extractDocx(file);
  }

  if (ext === 'pdf') {
    return extractPdf(file);
  }

  // Fallback: try as plain text
  return file.text();
}

async function extractDocx(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const xml = await zip.file('word/document.xml')?.async('text');
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

    if (text.length < 20) {
      throw new Error(
        'DOCX extracted very little text. Try: (1) Re-save in Word, (2) Use .txt format, or (3) Copy-paste text directly.'
      );
    }

    return text;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.startsWith('This DOCX') || err.message.startsWith('DOCX extracted'))
    ) {
      throw err;
    }
    throw new Error('Could not extract text from DOCX. Try pasting the text manually.', {
      cause: err,
    });
  }
}

async function extractPdf(file: File): Promise<string> {
  try {
    const text = await file.text();

    // Try to extract readable text from PDF raw bytes
    // PDF text streams contain text between BT (Begin Text) and ET (End Text)
    // or between stream and endstream markers
    let extracted = '';

    // Look for text in stream blocks
    const streamMatches = text.match(/stream\s*([\s\S]*?)\s*endstream/g);
    if (streamMatches) {
      for (const match of streamMatches) {
        const content = match
          .replace(/stream|endstream/g, '')
          .replace(/\([^)]*\)/g, (m) => m.slice(1, -1)) // (text) format
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '')
          .replace(/\\t/g, ' ')
          .replace(/\\[0-7]{3}/g, ' ')
          .replace(/[^\x20-\x7E\n]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (content.length > 5 && /[a-zA-Z]{3,}/.test(content)) {
          extracted += content + '\n';
        }
      }
    }

    // Also try direct text extraction from the raw content
    if (!extracted.trim()) {
      extracted = text
        .replace(/\([^)]{2,}\)/g, (m) => m.slice(1, -1))
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, ' ')
        .replace(/\\[0-7]{3}/g, ' ')
        .replace(/[^\x20-\x7E\n]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (extracted.length < 50) {
      throw new Error(
        'PDF appears to be image-based or encrypted. Try: (1) Copy-paste text directly, (2) Use a .docx file, or (3) Export PDF as text first.'
      );
    }

    if (extracted.length < 200) {
      console.warn('[Resume Game] PDF extraction returned minimal text. Quality may be poor.');
    }

    return extracted;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('PDF appears')) {
      throw err;
    }
    throw new Error(
      'Could not extract text from PDF. Try pasting the text manually or use a .txt file.',
      { cause: err }
    );
  }
}
