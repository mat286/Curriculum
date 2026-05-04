import { CandidateAggregateService } from '../candidate/CandidateAggregateService.js';
import { CandidateContextSnapshotService } from '../candidate/CandidateContextSnapshotService.js';
import { ConversationMemoryService } from '../memory/ConversationMemoryService.js';
import { MultiLevelCacheService } from '../cache/MultiLevelCacheService.js';
import { TargetedSemanticRetriever } from '../semantic/TargetedSemanticRetriever.js';
import { PromptAssembler } from '../prompt/PromptAssembler.js';
import { DefaultLLMProvider } from '../llm/DefaultLLMProvider.js';
import { ResilientLLMProvider } from '../llm/ResilientLLMProvider.js';
import { ChatTelemetry } from '../telemetry/ChatTelemetry.js';
import { NormalizeQuestionService } from './NormalizeQuestionService.js';
import { IntentClassifierService } from './IntentClassifierService.js';
import { ContextSelectorService } from './ContextSelectorService.js';
import { FAQSemanticRetriever } from '../faq/FAQSemanticRetriever.js';

const DEFAULT_OPTIONS = {
    model: process.env.OLLAMA_MODEL || 'mistral:7b',
    keepAlive: process.env.OLLAMA_KEEP_ALIVE || '30m',
    temperature: 0.2,
    numPredict: 220,
    numCtx: 2048,
    timeout: parseInt(process.env.OLLAMA_TIMEOUT || '60000', 10),
};

export class ChatOrchestrator {
    constructor() {
        this.aggregateService = new CandidateAggregateService();
        this.snapshotService = new CandidateContextSnapshotService();
        this.cache = new MultiLevelCacheService();
        this.semantic = new TargetedSemanticRetriever();
        this.memory = new ConversationMemoryService();
        this.promptAssembler = new PromptAssembler();
        this.normalizeService = new NormalizeQuestionService();
        this.intentClassifier = new IntentClassifierService();
        this.contextSelector = new ContextSelectorService();
        this.faqRetriever = new FAQSemanticRetriever();
        this.llm = new ResilientLLMProvider(new DefaultLLMProvider(), {
            maxRetries: 1,
            circuitThreshold: 4,
            circuitCooldownMs: 30000,
        });
    }

    getSessionKey({ requesterId, candidateId }) {
        return `session:${requesterId || 'anon'}:candidate:${candidateId}`;
    }

    async prepareContext({ candidateId, message, requesterId }) {
        const telemetry = new ChatTelemetry('candidate-chat', { candidateId, requesterId });
        const normalizedQuestion = this.normalizeService.normalize(message);
        telemetry.mark('normalize');

        const intentResult = this.intentClassifier.classify(normalizedQuestion);
        telemetry.mark('intent', { intent: intentResult.intent, confidence: intentResult.confidence });

        const aggregate = await this.aggregateService.getPublicCandidateAggregate(candidateId);
        if (!aggregate.snapshot?.json) {
            const built = await this.snapshotService.upsertSnapshot(candidateId, aggregate.profile);
            aggregate.snapshot = {
                json: built.snapshot,
                context: built.compiledContext,
                updatedAt: new Date().toISOString(),
            };
        }
        telemetry.mark('aggregate');

        const greeting = this.cache.getGreeting(message, aggregate.candidateName);
        if (greeting) {
            telemetry.flush({ route: 'l1-greeting' });
            return { route: 'l1-greeting', aggregate, greeting, telemetry };
        }

        const faqHit = await this.faqRetriever.findBestMatch({ candidateId, question: normalizedQuestion });
        telemetry.mark('faq', { hit: faqHit.hit, similarity: faqHit.similarity || 0 });

        if (faqHit.hit && faqHit.faq?.answer) {
            telemetry.flush({ route: 'faq-direct', intent: intentResult.intent, faqSimilarity: faqHit.similarity || 0 });
            return {
                route: 'faq-direct',
                aggregate,
                faqHit,
                telemetry,
            };
        }

        const cacheKey = this.cache.buildKey(candidateId, message);
        const cachedResponse = this.cache.getResponse(cacheKey);
        if (cachedResponse) {
            telemetry.flush({ route: 'l3-response-cache' });
            return { route: 'l3-response-cache', aggregate, cachedResponse, cacheKey, telemetry };
        }

        const sessionKey = this.getSessionKey({ requesterId, candidateId });
        const memory = await this.memory.get(sessionKey);
        telemetry.mark('memory');

        const selected = this.contextSelector.select(intentResult.intent, intentResult.confidence);
        telemetry.mark('selector', { include: selected.include.join(',') });

        const semantic = await this.semantic.retrieve({
            candidateId,
            query: normalizedQuestion,
            includeSections: selected.include,
            topK: 3,
            timeoutMs: 500,
            minSimilarity: parseFloat(process.env.SEMANTIC_MIN_SIMILARITY || '0.68'),
        });
        telemetry.mark('semantic', { reason: semantic.reason, semanticMs: semantic.durationMs, chunkCount: semantic.chunks.length });

        const profileContextRaw = aggregate.snapshot?.json || aggregate.profile;
        const profileContext = this.contextSelector.pickFromProfile(profileContextRaw, selected.include);
        const prompt = this.promptAssembler.build({
            candidateName: aggregate.candidateName,
            profileContext,
            semanticContext: semantic.chunks,
            conversationMemory: memory,
            faqHit,
            selectedSections: selected.include,
            question: message,
        });
        telemetry.mark('prompt', { promptChars: prompt.length, tokenEstimate: Math.ceil(prompt.length / 4) });

        return {
            route: 'llm',
            aggregate,
            cacheKey,
            sessionKey,
            prompt,
            intentResult,
            selectedSections: selected.include,
            faqHit,
            telemetry,
        };
    }

    async ask({ candidateId, message, requesterId }) {
        const prep = await this.prepareContext({ candidateId, message, requesterId });

        if (prep.route === 'l1-greeting') {
            return { answer: prep.greeting, routed: 'fast-direct', candidateId };
        }

        if (prep.route === 'faq-direct') {
            return {
                answer: prep.faqHit.faq.answer,
                routed: 'faq-direct',
                candidateId,
                faqHit: true,
                faqSimilarity: prep.faqHit.similarity,
            };
        }

        if (prep.route === 'l3-response-cache') {
            return { ...prep.cachedResponse, cached: true };
        }

        const answer = await this.llm.generate(prep.prompt, { ...DEFAULT_OPTIONS, numPredict: 300 });
        prep.telemetry.mark('llm');

        await this.memory.addTurn({ sessionKey: prep.sessionKey, candidateId, requesterId, role: 'user', content: message });
        await this.memory.addTurn({ sessionKey: prep.sessionKey, candidateId, requesterId, role: 'assistant', content: answer });

        const payload = { answer, candidateId, routed: 'with_data' };
        this.cache.setResponse(prep.cacheKey, payload);
        prep.telemetry.flush({
            cacheHit: false,
            intent: prep.intentResult.intent,
            sections: prep.selectedSections,
            faqHit: prep.faqHit?.hit || false,
            faqSimilarity: prep.faqHit?.similarity || 0,
        });

        return payload;
    }

    async askStream({ candidateId, message, requesterId, onToken }) {
        const prep = await this.prepareContext({ candidateId, message, requesterId });

        if (prep.route === 'l1-greeting') {
            onToken(prep.greeting);
            return { routed: 'fast-direct', candidateId, done: true };
        }

        if (prep.route === 'faq-direct') {
            onToken(prep.faqHit.faq.answer);
            return {
                routed: 'faq-direct',
                candidateId,
                done: true,
                faqHit: true,
                faqSimilarity: prep.faqHit.similarity,
            };
        }

        if (prep.route === 'l3-response-cache') {
            const text = prep.cachedResponse.answer || '';
            const chunks = text.match(/\S+\s*/g) || [];
            for (let i = 0; i < chunks.length; i += 3) {
                onToken(chunks.slice(i, i + 3).join(''));
            }
            return { routed: prep.cachedResponse.routed || 'with_data', candidateId, done: true, cached: true };
        }

        let fullResponse = '';
        let firstToken = true;
        const llmStart = Date.now();

        await this.llm.generateStream(prep.prompt, DEFAULT_OPTIONS, (token) => {
            if (firstToken) {
                prep.telemetry.mark('ttfb', { ttfbMs: Date.now() - llmStart });
                firstToken = false;
            }
            fullResponse += token;
            onToken(token);
        });

        prep.telemetry.mark('llm');

        await this.memory.addTurn({ sessionKey: prep.sessionKey, candidateId, requesterId, role: 'user', content: message });
        await this.memory.addTurn({ sessionKey: prep.sessionKey, candidateId, requesterId, role: 'assistant', content: fullResponse });

        const payload = { answer: fullResponse, candidateId, routed: 'with_data' };
        this.cache.setResponse(prep.cacheKey, payload);
        prep.telemetry.flush({
            cacheHit: false,
            tokenChars: fullResponse.length,
            intent: prep.intentResult.intent,
            sections: prep.selectedSections,
            faqHit: prep.faqHit?.hit || false,
            faqSimilarity: prep.faqHit?.similarity || 0,
        });

        return { routed: 'with_data', candidateId, done: true };
    }
}

export const chatOrchestrator = new ChatOrchestrator();
