import { LLMProviderInterface } from './LLMProviderInterface.js';

export class OpenAIProvider extends LLMProviderInterface {
    async generate(_prompt, _options = {}) {
        throw new Error('OpenAIProvider aún no implementado');
    }

    async generateStream(_prompt, _options = {}, _onChunk) {
        throw new Error('OpenAIProvider aún no implementado');
    }
}
