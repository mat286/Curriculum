import provider from '../../ai/index.js';
import { LLMProviderInterface } from './LLMProviderInterface.js';

export class DefaultLLMProvider extends LLMProviderInterface {
    async generate(prompt, options = {}) {
        return provider.generate(prompt, options);
    }

    async generateStream(prompt, options = {}, onChunk) {
        return provider.generateStream(prompt, options, onChunk);
    }
}
