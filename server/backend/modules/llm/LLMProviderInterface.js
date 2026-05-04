export class LLMProviderInterface {
    async generate(_prompt, _options = {}) {
        throw new Error('LLMProviderInterface.generate() no implementado');
    }

    async generateStream(_prompt, _options = {}, _onChunk) {
        throw new Error('LLMProviderInterface.generateStream() no implementado');
    }
}
