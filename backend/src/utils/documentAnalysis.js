const fs = require('fs');
const path = require('path');

const SINHALA_PATTERN = /[඀-෿]/;
const MIN_WORD_COUNT = 300;
const MAX_WORD_COUNT = 28000;

function countWords(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

async function extractText(absolutePath, originalFileName) {
  const ext = path.extname(originalFileName).toLowerCase();
  try {
    if (ext === '.txt') {
      return await fs.promises.readFile(absolutePath, 'utf8');
    }
    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = await fs.promises.readFile(absolutePath);
      const result = await pdfParse(buffer);
      return result.text;
    }
    if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: absolutePath });
      return result.value;
    }
  } catch (error) {
    console.warn(`Could not extract text from ${originalFileName}: ${error.message}`);
    return null;
  }
  return null;
}

// Soft, non-blocking analysis: callers always still accept the upload and only
// surface the result as a warning. .doc (legacy binary) and .zip are skipped -
// word_count stays null for those, which the UI treats as "not checkable".
async function analyzeStoredFile(absolutePath, originalFileName) {
  const text = await extractText(absolutePath, originalFileName);
  if (text === null) {
    return { word_count: null, language_warning: false, word_count_warning: false };
  }

  const wordCount = countWords(text);
  return {
    word_count: wordCount,
    language_warning: SINHALA_PATTERN.test(text),
    word_count_warning: wordCount > 0 && (wordCount < MIN_WORD_COUNT || wordCount > MAX_WORD_COUNT)
  };
}

module.exports = {
  MIN_WORD_COUNT,
  MAX_WORD_COUNT,
  analyzeStoredFile
};
