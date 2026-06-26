export class LLMProviderInterface {
    async generate(_prompt, _options = {}, _systemInstruction = null) {
        throw new Error('LLMProviderInterface.generate() no implementado');
    }

    async generateStream(_prompt, _options = {}, _onChunk, _systemInstruction = null) {
        throw new Error('LLMProviderInterface.generateStream() no implementado');
    }
}
