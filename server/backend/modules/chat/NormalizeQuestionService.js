export class NormalizeQuestionService {
    normalize(question) {
        const raw = typeof question === 'string' ? question : '';
        return raw
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }
}
