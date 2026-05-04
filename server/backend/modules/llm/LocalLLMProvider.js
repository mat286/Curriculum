import { LLMProviderInterface } from './LLMProviderInterface.js';

export class LocalLLMProvider extends LLMProviderInterface {
    async generate(_prompt, _options = {}) {
        throw new Error('LocalLLMProvider aún no implementado');
    }

    async generateStream(_prompt, _options = {}, _onChunk) {
        throw new Error('LocalLLMProvider aún no implementado');
    }
}
