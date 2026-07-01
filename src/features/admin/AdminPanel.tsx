import { RotateCcw, Save, Settings } from "lucide-react";
import { AdminSettings, DEFAULT_ADMIN_SETTINGS, ToolKey, normalizeList } from "./adminSettings";

type AdminPanelProps = {
  settings: AdminSettings;
  onChange: (settings: AdminSettings) => void;
  onReset: () => void;
};

const TOOL_KEYS: ToolKey[] = ["keyword", "aliyan", "seo"];

export function AdminPanel({ settings, onChange, onReset }: AdminPanelProps) {
  function updateModule(tool: ToolKey, field: keyof AdminSettings["modules"][ToolKey], value: string | boolean) {
    onChange({
      ...settings,
      modules: {
        ...settings.modules,
        [tool]: { ...settings.modules[tool], [field]: value },
      },
    });
  }

  return (
    <main className="app-shell admin-module">
      <section className="header-band">
        <div>
          <p className="eyebrow">Admin Panel</p>
          <h1>Manage labels, visibility, defaults, SEO locations, and languages across all modules.</h1>
          <p className="admin-intro">Settings are stored in this browser and applied immediately. Reset restores the safe defaults.</p>
        </div>
        <button className="secondary-action inline-action" onClick={onReset}>
          <RotateCcw size={18} />
          Reset defaults
        </button>
      </section>

      <section className="workspace-grid">
        <div className="control-panel">
          <div className="section-title"><Settings size={18} /><h2>Module Controls</h2></div>
          <div className="admin-module-list">
            {TOOL_KEYS.map((tool) => (
              <div className="admin-module-card" key={tool}>
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={settings.modules[tool].enabled}
                    onChange={(event) => updateModule(tool, "enabled", event.target.checked)}
                  />
                  Show {settings.modules[tool].label}
                </label>
                <label className="field-label">
                  <span>Navigation label</span>
                  <input value={settings.modules[tool].label} onChange={(event) => updateModule(tool, "label", event.target.value)} />
                </label>
                <label className="field-label">
                  <span>Eyebrow / small heading</span>
                  <input value={settings.modules[tool].eyebrow} onChange={(event) => updateModule(tool, "eyebrow", event.target.value)} />
                </label>
                <label className="field-label">
                  <span>Main title</span>
                  <textarea rows={2} value={settings.modules[tool].title} onChange={(event) => updateModule(tool, "title", event.target.value)} />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="control-panel">
          <div className="section-title"><Save size={18} /><h2>Processing Defaults</h2></div>
          <div className="input-stack">
            <label className="field-label">
              <span>Keyword Mapping batch size</span>
              <input
                type="number"
                min={50}
                max={5000}
                value={settings.keywordMapping.batchSize}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    keywordMapping: { batchSize: Math.max(50, Number(event.target.value) || DEFAULT_ADMIN_SETTINGS.keywordMapping.batchSize) },
                  })
                }
              />
            </label>
            <label className="field-label">
              <span>Aliyan default proxy URL</span>
              <input
                value={settings.aliyan.defaultProxyUrl}
                onChange={(event) => onChange({ ...settings, aliyan: { defaultProxyUrl: event.target.value } })}
              />
            </label>
            <label className="field-label">
              <span>SEO default seed keywords</span>
              <textarea
                rows={3}
                value={settings.seo.defaultSeedKeywords}
                onChange={(event) => onChange({ ...settings, seo: { ...settings.seo, defaultSeedKeywords: event.target.value } })}
              />
            </label>
            <label className="field-label">
              <span>SEO legacy default language</span>
              <input
                value={settings.seo.defaultLanguage}
                onChange={(event) => onChange({ ...settings, seo: { ...settings.seo, defaultLanguage: event.target.value } })}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="control-panel admin-country-panel">
        <div className="section-title"><Settings size={18} /><h2>SEO Countries / Locations & Languages</h2></div>
        <p className="admin-intro">Latin America is included by default. Add or remove one country or language per line.</p>
        <div className="workspace-grid">
          <label className="field-label">
            <span>Available SEO locations</span>
            <textarea
              rows={16}
              value={settings.seo.availableLocations.join("\n")}
              onChange={(event) =>
                onChange({
                  ...settings,
                  seo: { ...settings.seo, availableLocations: normalizeList(event.target.value.split("\n")) },
                })
              }
            />
          </label>
          <label className="field-label">
            <span>Default selected SEO locations</span>
            <textarea
              rows={16}
              value={settings.seo.defaultSelectedLocations.join("\n")}
              onChange={(event) =>
                onChange({
                  ...settings,
                  seo: { ...settings.seo, defaultSelectedLocations: normalizeList(event.target.value.split("\n")) },
                })
              }
            />
          </label>
          <label className="field-label">
            <span>Available SEO languages</span>
            <textarea
              rows={16}
              value={settings.seo.availableLanguages.join("\n")}
              onChange={(event) =>
                onChange({
                  ...settings,
                  seo: { ...settings.seo, availableLanguages: normalizeList(event.target.value.split("\n")) },
                })
              }
            />
          </label>
          <label className="field-label">
            <span>Default selected SEO languages</span>
            <textarea
              rows={16}
              value={settings.seo.defaultSelectedLanguages.join("\n")}
              onChange={(event) =>
                onChange({
                  ...settings,
                  seo: { ...settings.seo, defaultSelectedLanguages: normalizeList(event.target.value.split("\n")) },
                })
              }
            />
          </label>
        </div>
      </section>
    </main>
  );
}
