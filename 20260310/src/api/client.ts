import { ProviderConfig } from './providers';

export interface ApiCallContext {
    prompt: string;
}

export interface ApiAttempt {
    key_index: number;
    ok: boolean;
    output: string;
    error: string;
}

export interface ApiResult {
    provider: string;
    model: string;
    ok: boolean;
    output: string;
    error: string;
    attempts: ApiAttempt[];
}

// Helpers to get configs
export const getStoredKeys = (provider: string): string[] => {
    const stored = localStorage.getItem(`keys_${provider}`);
    if (stored) {
        const keys = stored.split(',').map(s => s.trim()).filter(Boolean);
        if (keys.length > 0) return keys;
    }
    return [];
};

export const getStoredModels = (provider: string): string[] => {
    const stored = localStorage.getItem(`models_${provider}`);
    if (stored) {
        const models = stored.split(',').map(s => s.trim()).filter(Boolean);
        if (models.length > 0) return models;
    }
    return [];
};

export const getApiKeys = (config: ProviderConfig): string[] => {
    // 1. Local storage overrides
    const stored = getStoredKeys(config.name);
    if (stored.length > 0) return stored;

    // 2. Process.env
    const rawKeys = process.env[config.keys_env] || '';
    if (rawKeys.trim()) {
        const keys = rawKeys.split(',').map(item => item.trim()).filter(Boolean);
        if (keys.length > 0) return keys;
    }

    const singleKey = process.env[config.key_env] || '';
    if (singleKey.trim() !== '') return [singleKey.trim()];

    return [];
};

export const getModels = (config: ProviderConfig): string[] => {
    const stored = getStoredModels(config.name);
    if (stored.length > 0) return stored;

    const rawModels = process.env[config.models_env] || '';
    if (rawModels.trim()) {
        const models = rawModels.split(',').map(item => item.trim()).filter(Boolean);
        if (models.length > 0) return models;
    }

    const singleModel = process.env[config.model_env] || '';
    if (singleModel.trim() !== '') return [singleModel.trim()];

    return [config.default_model];
};

const firstText = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
        for (const item of value) {
            const text = firstText(item);
            if (text) return text;
        }
        return '';
    }
    if (typeof value === 'object') {
        for (const key of ['text', 'content', 'output_text']) {
            const text = firstText(value[key]);
            if (text) return text;
        }
        return '';
    }
    return String(value).trim();
};

const classifyError = (statusCode: number | null, detail: string): string => {
    const detailLc = detail.toLowerCase();
    if (statusCode === 401 || statusCode === 403 || detailLc.includes('auth') || detailLc.includes('api key')) return 'auth';
    if (statusCode === 429 || detailLc.includes('quota') || detailLc.includes('rate limit')) return 'quota';
    if (statusCode === 404 || detailLc.includes('model')) return 'model';
    if (statusCode === null) return 'network_or_cors';
    return 'other';
};

const parseOpenAICompatible = (payload: any): string => {
    const choices = payload.choices || [];
    for (const choice of choices) {
        let text = firstText(choice?.message?.content);
        if (text) return text;
        text = firstText(choice?.text);
        if (text) return text;
    }
    return '';
};

const parseGemini = (payload: any): string => {
    const candidates = payload.candidates || [];
    for (const candidate of candidates) {
        const parts = candidate?.content?.parts || [{}];
        const text = firstText(parts[0]?.text);
        if (text) return text;
    }
    return '';
};

const parseCohere = (payload: any): string => {
    const content = payload?.message?.content || [];
    let text = firstText(content);
    if (text) return text;
    return firstText(payload?.text);
};

const httpPostJson = async (url: string, payload: any, headers: Record<string, string>): Promise<{ statusCode: number | null, payload?: any, error?: string }> => {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        const raw = await response.text();
        let data = {};
        try {
            if (raw) data = JSON.parse(raw);
        } catch {
            // ignore JSON parse error
        }

        if (!response.ok) {
            return {
                statusCode: response.status,
                error: raw || `HTTP Error ${response.status}`,
            }
        }

        return {
            statusCode: response.status,
            payload: data,
        };
    } catch (err: any) {
        return {
            statusCode: null,
            error: err.message || String(err),
        };
    }
};

const buildOpenaiHeaders = (config: ProviderConfig, apiKey: string): Record<string, string> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };
    const extraHeaders = config.extra_headers || {};
    for (const [headerName, envName] of Object.entries(extraHeaders)) {
        const envVal = process.env[envName];
        if (envVal) {
            headers[headerName] = envVal;
        }
    }
    return headers;
};

const callOpenAICompatible = async (config: ProviderConfig, apiKey: string, model: string, prompt: string) => {
    const endpoint = process.env[config.endpoint_env] || config.default_endpoint;
    const payload = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
    };
    const result = await httpPostJson(endpoint, payload, buildOpenaiHeaders(config, apiKey));
    if (result.error) return result;
    return { ...result, output: parseOpenAICompatible(result.payload) };
};

const callGemini = async (config: ProviderConfig, apiKey: string, model: string, prompt: string) => {
    let endpoint = process.env[config.endpoint_env];
    if (!endpoint) {
        endpoint = config.default_endpoint.replace('{model}', model).replace('{api_key}', encodeURIComponent(apiKey));
    }
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
    };
    const headers = { 'Content-Type': 'application/json' };
    const result = await httpPostJson(endpoint, payload, headers);
    if (result.error) return result;
    return { ...result, output: parseGemini(result.payload) };
};

const callCohere = async (config: ProviderConfig, apiKey: string, model: string, prompt: string) => {
    const endpoint = process.env[config.endpoint_env] || config.default_endpoint;
    const payload = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
    };
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };
    const result = await httpPostJson(endpoint, payload, headers);
    if (result.error) return result;
    return { ...result, output: parseCohere(result.payload) };
};

export const runModelOnce = async (config: ProviderConfig, model: string, apiKey: string, prompt: string): Promise<Pick<ApiResult, 'provider' | 'model' | 'ok' | 'output' | 'error'>> => {
    const baseResult = {
        provider: config.name,
        model: model,
        ok: false,
        output: '',
        error: '',
    };

    let result: any;
    if (config.kind === 'gemini') {
        result = await callGemini(config, apiKey, model, prompt);
    } else if (config.kind === 'cohere') {
        result = await callCohere(config, apiKey, model, prompt);
    } else {
        result = await callOpenAICompatible(config, apiKey, model, prompt);
    }

    if (result.error) {
        baseResult.error = `${classifyError(result.statusCode, result.error)}:${result.error}`;
        return baseResult;
    }

    const output = firstText(result.output);
    baseResult.output = output;
    baseResult.ok = !!output;
    if (!baseResult.ok) {
        baseResult.error = 'empty_response';
    }
    return baseResult;
};

export const runModel = async (config: ProviderConfig, model: string, prompt: string): Promise<ApiResult> => {
    const apiKeys = getApiKeys(config);
    const baseResult: ApiResult = {
        provider: config.name,
        model: model,
        ok: false,
        output: '',
        error: '',
        attempts: [],
    };

    if (!apiKeys.length) {
        baseResult.error = `missing_env: ${config.key_env} or ${config.keys_env} or localStorage entries.`;
        return baseResult;
    }

    for (let index = 0; index < apiKeys.length; index++) {
        const apiKey = apiKeys[index];
        const result = await runModelOnce(config, model, apiKey, prompt);
        const attempt: ApiAttempt = {
            key_index: index + 1,
            ok: result.ok,
            output: result.output,
            error: result.error,
        };
        baseResult.attempts.push(attempt);
        if (result.ok) {
            baseResult.ok = true;
            baseResult.output = result.output;
            baseResult.error = '';
            return baseResult;
        }

        if (index < apiKeys.length - 1) {
            continue;
        }

        baseResult.error = result.error;
        if (result.output) {
            baseResult.output = result.output;
        }
    }

    return baseResult;
};
