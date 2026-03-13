import { useState, useEffect } from 'react';
import { PROVIDERS } from './api/providers';
import { runModel, ApiResult, getModels } from './api/client';

type CardStatus = 'pending' | 'loading' | 'success' | 'error';

interface CardState {
  providerName: string;
  model: string;
  status: CardStatus;
  result?: ApiResult;
  error?: string;
}

// Build the flat list of (provider, model) pairs from current config
const buildCardList = (): { providerName: string; model: string }[] => {
  const list: { providerName: string; model: string }[] = [];
  for (const provider of PROVIDERS) {
    const models = getModels(provider);
    for (const model of models) {
      list.push({ providerName: provider.name, model });
    }
  }
  return list;
};

const cardKey = (providerName: string, model: string) =>
  `${providerName}:${model}`;

const REPO_URL = 'https://github.com/nikaiai2025/100challenge';

const resolveProjectSlug = (): string => {
  if (typeof window === 'undefined') return '';
  const parts = window.location.pathname.split('/').filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (/^\d{8}$/.test(parts[i])) return parts[i];
  }
  return '';
};

function App() {
  const projectSlug = resolveProjectSlug();
  const sourceUrl = projectSlug ? `${REPO_URL}/tree/main/${projectSlug}` : REPO_URL;
  const [prompt, setPrompt] = useState<string>(
    process.env.AI_API_POC_PROMPT ||
    '簡単に自己紹介して。名前と所属と、あなたが嫌いなAIモデルを教えて'
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [cardList, setCardList] = useState<{ providerName: string; model: string }[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const refreshCardList = () => {
    const list = buildCardList();
    setCardList(list);
    const initial: Record<string, CardState> = {};
    list.forEach(({ providerName, model }) => {
      const k = cardKey(providerName, model);
      initial[k] = { providerName, model, status: 'pending' };
    });
    setCardStates(initial);
  };

  // Initialize on mount
  useEffect(() => {
    refreshCardList();
  }, []);

  const handleExecute = async () => {
    if (!prompt.trim()) return;
    setIsExecuting(true);

    // Rebuild list fresh in case BYOK changed models
    const currentList = buildCardList();
    setCardList(currentList);

    // Set all to loading
    const loadingStates: Record<string, CardState> = {};
    currentList.forEach(({ providerName, model }) => {
      loadingStates[cardKey(providerName, model)] = {
        providerName,
        model,
        status: 'loading',
      };
    });
    setCardStates(loadingStates);

    // Fire all (provider × model) in parallel
    const promises = currentList.map(async ({ providerName, model }) => {
      const provider = PROVIDERS.find((p) => p.name === providerName)!;
      const k = cardKey(providerName, model);
      try {
        const result = await runModel(provider, model, prompt);
        setCardStates((prev) => ({
          ...prev,
          [k]: {
            providerName,
            model,
            status: result.ok ? 'success' : 'error',
            result,
            error: result.ok ? undefined : result.error,
          },
        }));
      } catch (err: any) {
        setCardStates((prev) => ({
          ...prev,
          [k]: {
            providerName,
            model,
            status: 'error',
            error: err.message || 'Unknown error occurred',
          },
        }));
      }
    });

    await Promise.all(promises);
    setIsExecuting(false);
  };

  return (
    <div className="app-container">
      <header>
        <div className="header-top">
          <h1>Multi-Provider AI Explorer</h1>
          <div className="header-actions">
            <a
              className="btn btn-outline link-button"
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              ソースコード
            </a>
            <button className="btn btn-outline" onClick={() => setIsModalOpen(true)}>
              Key Registration (BYOK)
            </button>
          </div>
        </div>

        <div className="prompt-area">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
          />
          <button
            className="btn"
            onClick={handleExecute}
            disabled={isExecuting || !prompt.trim()}
          >
            {isExecuting ? 'Executing...' : 'Execute Prompt'}
          </button>
        </div>
      </header>

      <main className="grid-container">
        {cardList.map(({ providerName, model }) => {
          const k = cardKey(providerName, model);
          const state = cardStates[k] || { providerName, model, status: 'pending' };
          const provider = PROVIDERS.find((p) => p.name === providerName);

          return (
            <div key={k} className={`provider-card status-${state.status}`}>
              <div className="card-header">
                {provider?.iconUrl ? (
                  <img src={provider.iconUrl} alt={providerName} className="icon" />
                ) : (
                  <div className="icon" />
                )}
                <div className="provider-info">
                  <h3>{providerName.toUpperCase()}</h3>
                  <p>{model}</p>
                </div>
                <span className={`badge badge-${state.status}`}>
                  {state.status.toUpperCase()}
                </span>
              </div>

              <div className="card-content">
                {state.status === 'pending' && (
                  <span style={{ color: 'var(--text-muted)' }}>Waiting for execution...</span>
                )}
                {state.status === 'loading' && (
                  <span style={{ color: 'var(--primary-color)' }}>Running prompt...</span>
                )}
                {state.status === 'success' && <div>{state.result?.output}</div>}
                {state.status === 'error' && (
                  <div className="error-text">
                    <strong>Error: </strong>
                    {state.error || state.result?.error}
                    {state.result?.attempts &&
                      state.result.attempts.map((att, i) => (
                        <div key={i} style={{ marginTop: '0.5rem', opacity: 0.8 }}>
                          <small>
                            Attempt {att.key_index}: {att.error || 'Failed'}
                          </small>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {isModalOpen && (
        <ByokModal
          onClose={() => setIsModalOpen(false)}
          onSave={() => {
            setIsModalOpen(false);
            refreshCardList(); // refresh card list only after saving changes
          }}
        />
      )}
    </div>
  );
}

function ByokModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState<
    Record<string, { keys: string; models: string }>
  >({});

  useEffect(() => {
    const initial: Record<string, { keys: string; models: string }> = {};
    PROVIDERS.forEach((p) => {
      initial[p.name] = {
        keys: localStorage.getItem(`keys_${p.name}`) || '',
        models: localStorage.getItem(`models_${p.name}`) || '',
      };
    });
    setFormData(initial);
  }, []);

  const handleChange = (
    providerName: string,
    field: 'keys' | 'models',
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [providerName]: {
        ...prev[providerName],
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    Object.entries(formData).forEach(([providerName, data]) => {
      if (data.keys.trim()) {
        localStorage.setItem(`keys_${providerName}`, data.keys.trim());
      } else {
        localStorage.removeItem(`keys_${providerName}`);
      }

      if (data.models.trim()) {
        localStorage.setItem(`models_${providerName}`, data.models.trim());
      } else {
        localStorage.removeItem(`models_${providerName}`);
      }
    });
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>API Keys Registration (BYOK)</h2>
          <button
            className="btn-outline"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '1.5rem',
              color: 'var(--text-main)',
            }}
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Keys and models entered here are saved locally in your browser&apos;s{' '}
            <code>localStorage</code>. They are not sent to any backend server.
            Comma-separated values are supported for both keys and models.
          </p>
          {PROVIDERS.map((provider) => (
            <div key={provider.name} className="form-section">
              <div className="form-section-title">
                {provider.iconUrl && (
                  <img
                    src={provider.iconUrl}
                    alt={provider.name}
                    style={{ width: 24, height: 24, borderRadius: 4, background: 'white' }}
                  />
                )}
                {provider.name.toUpperCase()}
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>API Key(s) — comma-separated</label>
                <input
                  type="password"
                  autoComplete="off"
                  value={formData[provider.name]?.keys || ''}
                  onChange={(e) => handleChange(provider.name, 'keys', e.target.value)}
                  placeholder={`Overrides process.env.${provider.key_env}`}
                />
              </div>
              <div className="form-group">
                <label>Model(s) — comma-separated</label>
                <input
                  type="text"
                  value={formData[provider.name]?.models || ''}
                  onChange={(e) => handleChange(provider.name, 'models', e.target.value)}
                  placeholder={`Default: ${provider.default_model}`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={handleSave}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;

