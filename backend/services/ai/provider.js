/**
 * AI provider abstraction (Phase 3A).
 *
 * Contract: classify({ message, history }) ->
 *   { intent, entities, confidence, provider }
 *
 * Supported providers:
 *  - local-deterministic: audited keyword + entity extractor (default)
 *  - openai: OpenAI Chat Completions API
 *  - anthropic: Anthropic Messages API
 *  - openai-compatible: Generic OpenAI-compatible endpoint
 *
 * Secrets live only in server-side env, never in logs or responses.
 */

import { classify, INTENTS, sanitizeEntities } from './intent.js';
import env from '../../config/env.js';

const VALID_INTENTS = new Set(Object.values(INTENTS));

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Strict schema check applied to EVERY provider output (local or remote). */
export const validateClassification = (value) => {
  if (!isPlainObject(value)) throw new Error('Invalid classifier output: not an object.');
  const { intent, entities, confidence } = value;
  if (!VALID_INTENTS.has(intent)) throw new Error('Invalid classifier output: unknown intent.');
  if (entities !== undefined && !isPlainObject(entities)) {
    throw new Error('Invalid classifier output: entities must be an object.');
  }
  if (confidence !== undefined && (typeof confidence !== 'number' || confidence < 0 || confidence > 1)) {
    throw new Error('Invalid classifier output: confidence must be 0..1.');
  }
  return { intent, entities: sanitizeEntities(entities), confidence: confidence ?? 1 };
};

const localProvider = {
  name: 'local-deterministic',
  aiGenerated: false,
  async classify({ message }) {
    return { ...validateClassification({ ...classify(message), confidence: 1 }), provider: this.name };
  },
};

const SYSTEM_PROMPT = `You are an intent classifier for JeevanDoot, a rural healthcare coordination platform.
Your task is to classify user messages into intents and extract structured entities.

Supported intents:
- UPCOMING_APPOINTMENTS: User wants to see their upcoming appointments
- BOOK_APPOINTMENT: User wants to book a new appointment
- RESCHEDULE_APPOINTMENT: User wants to reschedule an existing appointment
- CANCEL_APPOINTMENT: User wants to cancel an appointment
- DOCTOR_DIRECTORY: User wants to find available doctors
- REFERRALS: User wants to see pending referrals
- FOLLOW_UPS: User wants to see follow-up appointments
- CLINIC_INFORMATION: User asks about clinic services/timings
- UNKNOWN_OR_UNSUPPORTED: Anything else (clinical advice, jokes, unrelated)

Extract entities when present:
- date: YYYY-MM-DD (explicit dates, "tomorrow", "today", weekdays)
- startTime: HH:MM (24-hour format)
- dayPart: "morning" | "afternoon" | "evening"
- weekday: day name
- doctorName: doctor name hint (e.g., "dr sharma")
- confirmHint: true (when user confirms a booking)

Rules:
- Never invent dates/times/doctors - only extract what's explicitly stated
- For ambiguous requests, prefer clarification intent
- Medical advice questions -> UNKNOWN_OR_UNSUPPORTED
- Destructive commands (delete, drop, destroy) -> UNKNOWN_OR_UNSUPPORTED

Output ONLY valid JSON matching this schema:
{
  "intent": "UPCOMING_APPOINTMENTS" | "BOOK_APPOINTMENT" | "RESCHEDULE_APPOINTMENT" | "CANCEL_APPOINTMENT" | "DOCTOR_DIRECTORY" | "REFERRALS" | "FOLLOW_UPS" | "CLINIC_INFORMATION" | "UNKNOWN_OR_UNSUPPORTED",
  "entities": {
    "date?": "YYYY-MM-DD",
    "startTime?": "HH:MM",
    "dayPart?": "morning" | "afternoon" | "evening",
    "weekday?": "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
    "doctorName?": "string",
    "confirmHint?": true
  },
  "confidence": 0.0-1.0
}`;

const postWithTimeout = async (url, apiKey, model, payload, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, ...payload }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Provider request failed with status ${response.status}: ${errorText}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Build the messages array for the LLM call.
 */
const buildMessages = (message, history) => {
  const boundedHistory = (history || []).slice(-10).map((m) => ({
    role: m.from === 'assistant' ? 'assistant' : 'user',
    content: String(m.text || '').slice(0, 2000),
  }));
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...boundedHistory,
    { role: 'user', content: String(message).slice(0, 2000) },
  ];
};

/**
 * Parse OpenAI-compatible response.
 */
const parseOpenAIResponse = (raw) => {
  if (raw?.intent) return raw;
  try {
    return JSON.parse(raw?.choices?.[0]?.message?.content || 'null');
  } catch {
    return null;
  }
};

/**
 * Parse Anthropic response.
 */
const parseAnthropicResponse = (raw) => {
  if (raw?.intent) return raw;
  try {
    return JSON.parse(raw?.content?.[0]?.text || 'null');
  } catch {
    return null;
  }
};

/**
 * Provider factory for different LLM providers.
 */
const createHttpProvider = (type) => {
  const providerConfigs = {
    openai: {
      name: 'openai',
      buildPayload: (model, messages) => ({
        model,
        messages,
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
      parseResponse: parseOpenAIResponse,
      urlPath: '/v1/chat/completions',
    },
    anthropic: {
      name: 'anthropic',
      buildPayload: (model, messages) => {
        const system = messages.find((m) => m.role === 'system')?.content || '';
        const userMessages = messages.filter((m) => m.role !== 'system');
        return {
          model,
          system,
          messages: userMessages,
          temperature: 0,
          max_tokens: 200,
        };
      },
      parseResponse: parseAnthropicResponse,
      urlPath: '/v1/messages',
    },
    'openai-compatible': {
      name: 'openai-compatible',
      buildPayload: (model, messages) => ({
        model,
        messages,
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
      parseResponse: parseOpenAIResponse,
      urlPath: '/v1/chat/completions',
    },
  };

  const config = providerConfigs[type];
  if (!config) {
    throw new Error(`Unknown AI provider type: ${type}. Supported: openai, anthropic, openai-compatible`);
  }

  return {
    name: config.name,
    aiGenerated: true,
    async classify({ message, history }) {
      const {
        AI_PROVIDER_URL,
        AI_PROVIDER_API_KEY,
        AI_PROVIDER_MODEL,
        AI_PROVIDER_TIMEOUT_MS,
        AI_PROVIDER_TYPE = 'openai',
      } = env;

      if (!AI_PROVIDER_URL || !AI_PROVIDER_API_KEY) {
        throw new Error('External AI provider is not configured (AI_PROVIDER_URL / AI_PROVIDER_API_KEY).');
      }

      const messages = buildMessages(message, history);
      const payload = config.buildPayload(AI_PROVIDER_MODEL, messages);
      const url = `${AI_PROVIDER_URL.replace(/\/$/, '')}${config.urlPath}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AI_PROVIDER_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${AI_PROVIDER_API_KEY}`,
            ...(config.name === 'anthropic' ? { 'anthropic-version': '2023-06-01' } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new Error(`Provider request failed with status ${response.status}: ${errorText}`);
        }

        const raw = await response.json();
        const candidate = config.parseResponse(raw);
        const checked = validateClassification(candidate);
        return { ...checked, provider: config.name };
      } finally {
        clearTimeout(timer);
      }
    },
  };
};

export const getProvider = () => {
  const providerType = (env.AI_PROVIDER || 'local').toLowerCase();
  if (providerType === 'local' || providerType === 'local-deterministic') return localProvider;
  if (['openai', 'anthropic', 'openai-compatible', 'http'].includes(providerType)) {
    return createHttpProvider(providerType === 'http' ? 'openai-compatible' : providerType);
  }
  return localProvider;
};

export default { getProvider, validateClassification };