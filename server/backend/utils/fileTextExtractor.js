import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { ValidationError } from '../middlewares/errorHandler.js';

const MAX_EXTRACTED_CHARS = 15000;

const PDF_MIME = 'application/pdf';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TXT_MIME = 'text/plain';

async function extractFromPdf(buffer) {
    const parser = new PDFParse({ data: buffer });
    try {
        const result = await parser.getText();
        return result.text;
    } finally {
        await parser.destroy();
    }
}

async function extractFromDocx(buffer) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
}

/**
 * Extrae texto plano de un archivo subido (PDF, DOCX o TXT), acotado a
 * MAX_EXTRACTED_CHARS para no disparar el tamaño del prompt hacia el LLM.
 */
export async function extractTextFromUpload(buffer, mimetype, originalname = '') {
    let text;

    if (mimetype === PDF_MIME) {
        text = await extractFromPdf(buffer);
    } else if (mimetype === DOCX_MIME) {
        text = await extractFromDocx(buffer);
    } else if (mimetype === TXT_MIME) {
        text = buffer.toString('utf8');
    } else {
        throw new ValidationError(
            `Formato no soportado: ${originalname || mimetype}. Subí un PDF, Word (.docx) o texto plano.`,
        );
    }

    const trimmed = (text || '').trim();
    if (!trimmed) {
        throw new ValidationError('No se pudo extraer texto del archivo. ¿Está vacío o es una imagen escaneada?');
    }

    return trimmed.slice(0, MAX_EXTRACTED_CHARS);
}

export const SUPPORTED_CV_MIME_TYPES = [PDF_MIME, DOCX_MIME, TXT_MIME];
