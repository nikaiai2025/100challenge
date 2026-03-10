import { useState, useEffect } from 'react';
import { PROVIDERS } from './api/providers';
import { runModel, ApiResult, getStoredModels } from './api/client';

type ProviderStatus = 'pending' | 'loading' | 'success' | 'error';

interface ProviderCardState {
  status: ProviderStatus;
  result?: ApiResult;
  error?: string;
}

function App() {
  const [prompt, setPrompt] = useState<string>(process.env.AI_API_POC_PROMPT || '簡単に自己紹介して。名前と所属と、あなたが嫌いなAIモデルを教えて');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardStates, setCardStates] = useState<Record<string, ProviderCardState>>({});
  const [isExecuting, setIsExecuting] = useState(false);

  // Initialize card states
  useEffect(() => {
    const initial: Record<string, ProviderCardState> = {};
    PROVIDERS.forEach(p => {
      initial[p.name] = { status: 'pending' };
    });
    setCardStates(initial);
  }, []);

  const handleExecute = async () => {
    if (!prompt.trim()) return;
    setIsExecuting(true);

    // Set all to loading
    const loadingStates: Record<string, ProviderCardState> = {};
    PROVIDERS.forEach(p => {
      loadingStates[p.name] = { status: 'loading' };
    });
    setCardStates(loadingStates);

    const promises = PROVIDERS.map(async (provider) => {
      try {
        // Resolve model to use
        const storedModels = getStoredModels(provider.name);
        const envModel = process.env[provider.model_env];
        const envModels = process.env[provider.models_env];
        let model = provider.default_model;

        if (storedModels.length > 0) {
          model = storedModels[0];
        } else if (envModels && envModels.trim()) {
          model = envModels.split(',')[0].trim();
        } else if (envModel && envModel.trim()) {
          model = envModel.trim();
        }

        const result = await runModel(provider, model, prompt);

        setCardStates(prev => ({
          ...prev,
          [provider.name]: {
            status: result.ok ? 'success' : 'error',
            result,
            error: result.ok ? undefined : result.error
          }
        }));
      } catch (err: any) {
        setCardStates(prev => ({
          ...prev,
          [provider.name]: {
            status: 'error',
            error: err.message || 'Unknown error occurred'
          }
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
          <button className="btn btn-outline" onClick={() => setIsModalOpen(true)}>
            Key Registration (BYOK)
          </button>
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
        {PROVIDERS.map((provider) => {
          const state = cardStates[provider.name] || { status: 'pending' };
          const result = state.result;
          const displayModel = result?.model || provider.default_model;

          return (
            <div key={provider.name} className={`provider-card status-${state.status}`}>
              <div className="card-header">
                {provider.iconUrl ? (
                  <img src={provider.iconUrl} alt={provider.name} className="icon" />
                ) : (
                  <div className="icon" />
                )}
                <div className="provider-info">
                  <h3>{provider.name.toUpperCase()}</h3>
                  <p>{displayModel}</p>
                </div>
                <span className={`badge badge-${state.status}`}>
                  {state.status.toUpperCase()}
                </span>
              </div>

              <div className="card-content">
                {state.status === 'pending' && <span style={{ color: 'var(--text-muted)' }}>Waiting for execution...</span>}
                {state.status === 'loading' && <span style={{ color: 'var(--primary-color)' }}>Running prompt...</span>}
                {state.status === 'success' && <div>{result?.output}</div>}
                {state.status === 'error' && (
                  <div className="error-text">
                    <strong>Error: </strong>{state.error || result?.error}
                    {result?.attempts && result.attempts.map((att, i) => (
                      <div key={i} style={{ marginTop: '0.5rem', opacity: 0.8 }}>
                        <small>Attempt {att.key_index}: {att.error || 'Failed'}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {isModalOpen && <ByokModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}

function ByokModal({ onClose }: { onClose: () => void }) {
  // Local state for all fields
  const [formData, setFormData] = useState<Record<string, { keys: string, models: string }>>({});

  useEffect(() => {
    const initial: Record<string, { keys: string, models: string }> = {};
    PROVIDERS.forEach(p => {
      initial[p.name] = {
        keys: localStorage.getItem(`keys_${p.name}`) || '',
        models: localStorage.getItem(`models_${p.name}`) || '',
      };
    });
    setFormData(initial);
  }, []);

  const handleChange = (providerName: string, field: 'keys' | 'models', value: string) => {
    setFormData(prev => ({
      ...prev,
      [providerName]: {
        ...prev[providerName],
        [field]: value
      }
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
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>API Keys Registration (BYOK)</h2>
          <button className="btn-outline" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.5rem', color: 'white' }} onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Keys and models entered here are saved locally in your browser's <code>localStorage</code>. They are not sent to any backend server. Comma-separated values are supported.
          </p>
          {PROVIDERS.map(provider => (
            <div key={provider.name} className="form-section">
              <div className="form-section-title">
                {provider.iconUrl && <img src={provider.iconUrl} alt={provider.name} style={{ width: 24, height: 24, borderRadius: 4, background: 'white' }} />}
                {provider.name.toUpperCase()}
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>API Key(s)</label>
                <input
                  type="password"
                  autoComplete="off"
                  value={formData[provider.name]?.keys || ''}
                  onChange={(e) => handleChange(provider.name, 'keys', e.target.value)}
                  placeholder={`Overrides process.env.${provider.key_env}`}
                />
              </div>
              <div className="form-group">
                <label>Model(s)</label>
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
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}

export default App;
