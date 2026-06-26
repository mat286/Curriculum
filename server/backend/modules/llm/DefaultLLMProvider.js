import provider from '../../ai/index.js';
import { LLMProviderInterface } from './LLMProviderInterface.js';

export class DefaultLLMProvider extends LLMProviderInterface {
    async generate(prompt, options = {}, systemInstruction = null) {
        return provider.generate(prompt, options, systemInstruction);
    }

    async generateStream(prompt, options = {}, onChunk, systemInstruction = null) {
        return provider.generateStream(prompt, options, onChunk, systemInstruction);
    }
}
