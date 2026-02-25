import { useState, useEffect } from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import yamlLang from 'react-syntax-highlighter/dist/esm/languages/hljs/yaml'
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import './components/ChartSetup'
import { useEvalData } from './hooks/useEvalData'
import { useFilters } from './hooks/useFilters'
import { useTheme } from './hooks/useTheme'
import { LineNumberedEditor, DiffView } from './components/YamlEditor'
import FilterBar from './components/FilterBar'
import StatsCards from './components/StatsCards'
import ResultsPieChart from './components/ResultsPieChart'
import MetricBarChart from './components/MetricBarChart'
import StackedBarChart from './components/StackedBarChart'
import ScoreTrendChart from './components/ScoreTrendChart'
import AvgScoreTrendChart from './components/AvgScoreTrendChart'
import ExecTimeTrendChart from './components/ExecTimeTrendChart'
import CollapsiblePanel from './components/CollapsiblePanel'
import DetailModal from './components/DetailModal'
import ResultsTable from './components/ResultsTable'
import Explorer from './components/Explorer'
import RunPage from './components/RunPage'
import './App.css'

SyntaxHighlighter.registerLanguage('yaml', yamlLang)

const TAB_ICONS = {
  overview: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  evaluations: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  scenarios: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>,
  trends: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  details: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
}

const TAB_GROUPS = [
  [
    { id: 'trends', label: 'Overview' },
    { id: 'overview', label: 'Insights' },
  ],
  [
    { id: 'evaluations', label: 'Evaluations' },
    { id: 'scenarios', label: 'Scenarios' },
  ],
]

function SystemConfigModal({ config, onClose, onSave }) {
  const { theme } = useTheme()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(config.content)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [diffInfo, setDiffInfo] = useState({ hasChanges: false, diff: '' })
  const [showDiff, setShowDiff] = useState(false)

  useEffect(() => {
    fetch('/api/system-config-diff').then(r => r.json())
      .then(data => setDiffInfo(data))
      .catch(() => {})
  }, [])

  const refreshDiff = () => {
    fetch('/api/system-config-diff').then(r => r.json())
      .then(data => { setDiffInfo(data); setShowDiff(true) })
      .catch(() => {})
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/system-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      onSave(data.content)
      setEditing(false)
      fetch('/api/system-config-diff').then(r => r.json())
        .then(d => setDiffInfo(d))
        .catch(() => {})
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setDraft(config.content)
    setSaveError('')
    setEditing(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content amended-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>System Configuration</h2>
            <div className="modal-subtitle">{config.path}</div>
          </div>
          <div className="system-config-header-actions">
            {!editing && !showDiff && (
              <>
                <button className="sc-btn sc-btn-edit" onClick={() => { setDraft(config.content); setEditing(true) }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
                <button
                  className={`sc-btn ${diffInfo.hasChanges ? 'sc-btn-diff' : 'sc-btn-diff-none'}`}
                  onClick={() => diffInfo.hasChanges && refreshDiff()}
                  disabled={!diffInfo.hasChanges}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 3h5v5" /><path d="M8 3H3v5" />
                    <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
                    <path d="m15 9 6-6" />
                  </svg>
                  {diffInfo.hasChanges ? 'Diff' : 'No changes'}
                </button>
              </>
            )}
            <button className="modal-close" onClick={onClose} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        {saveError && (
          <div className="sc-error">{saveError}</div>
        )}
        <div className="modal-body">
          {showDiff && diffInfo.hasChanges ? (
            <>
              <div className="sc-diff-header">
                <span>Changes in {config.path}</span>
                <button className="sc-btn sc-btn-ghost" onClick={() => setShowDiff(false)}>Back</button>
              </div>
              <DiffView diff={diffInfo.diff} />
            </>
          ) : editing ? (
            <LineNumberedEditor value={draft} onChange={setDraft} />
          ) : (
            <SyntaxHighlighter
              language="yaml"
              style={theme === 'dark' ? atomOneDark : atomOneLight}
              customStyle={{
                margin: 0,
                borderRadius: '6px',
                fontSize: '13px',
                lineHeight: '1.6',
              }}
              showLineNumbers
            >
              {config.content}
            </SyntaxHighlighter>
          )}
        </div>
        {editing && (
          <div className="sc-footer">
            <button className="sc-btn sc-btn-ghost" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
            <button className="sc-btn sc-btn-save" onClick={handleSave} disabled={saving}>
              {saving && <span className="spinner-sm" />}
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}

export default function App() {
  const { entries, loading, refreshing, error, metadata, refresh } = useEvalData()
  const { filters, setters, filtered, reset, ALL } = useFilters(entries)
  const [activeTab, setActiveTab] = useState('trends')
  const [detailView, setDetailView] = useState(null)
  const [gitInfo, setGitInfo] = useState({ repo: '', branch: '' })
  const [systemConfig, setSystemConfig] = useState({ set: false, path: '', content: '' })
  const [showSystemConfig, setShowSystemConfig] = useState(false)

  useEffect(() => {
    fetch('/api/git-info').then(r => r.json())
      .then(data => setGitInfo({ repo: data.repo || '', branch: data.branch || '' }))
      .catch(() => {})
    fetch('/api/system-config').then(r => r.json())
      .then(data => setSystemConfig(data))
      .catch(() => {})
  }, [])



  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>Loading evaluation data...</p>
      </div>
    )
  }

  if (error) {
    return <div className="error-msg">Failed to load data: {error}</div>
  }

  return (
    <div className="app-wrapper">
      <header>
        <h1 onClick={() => setActiveTab('trends')} style={{ cursor: 'pointer' }}>
          <svg className="nav-logo" width="28" height="22" viewBox="0 0 192 146">
            <path d="m 128,84 c 12.5,0 30.6,-2.6 30.6,-17.5 a 19.53,19.53 0 0 0 -0.3,-3.4 L 150.9,30.7 C 149.2,23.6 147.7,20.3 135.2,14.1 125.5,9.1 104.4,1 98.1,1 92.2,1 90.5,8.5 83.6,8.5 76.9,8.5 72,2.9 65.7,2.9 c -6,0 -9.9,4.1 -12.9,12.5 0,0 -8.4,23.7 -9.5,27.2 a 6.15,6.15 0 0 0 -0.2,1.9 C 43,53.7 79.3,83.9 128,84 m 32.5,-11.4 c 1.7,8.2 1.7,9.1 1.7,10.1 0,14 -15.7,21.8 -36.4,21.8 C 79,104.5 38.1,77.1 38.1,59 a 18.35,18.35 0 0 1 1.5,-7.3 C 22.8,52.5 1,55.5 1,74.7 1,106.2 75.6,145 134.6,145 c 45.3,0 56.7,-20.5 56.7,-36.7 0,-12.7 -11,-27.1 -30.8,-35.7" fill="#ee0000"/>
            <path d="m 160.5,72.6 c 1.7,8.2 1.7,9.1 1.7,10.1 0,14 -15.7,21.8 -36.4,21.8 C 79,104.5 38.1,77.1 38.1,59 a 18.35,18.35 0 0 1 1.5,-7.3 l 3.7,-9.1 a 6.15,6.15 0 0 0 -0.2,1.9 c 0,9.2 36.3,39.4 84.9,39.4 12.5,0 30.6,-2.6 30.6,-17.5 A 19.53,19.53 0 0 0 158.3,63 Z" fill="#a00"/>
          </svg>
          Lightspeed Evaluation Dashboard
        </h1>
        <span className="subtitle" />
        {gitInfo.branch && (
          <span className="git-branch">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            {gitInfo.repo ? `${gitInfo.repo}/${gitInfo.branch}` : gitInfo.branch}
          </span>
        )}
        <button
          className={`system-config-btn${systemConfig.set ? '' : ' disabled'}`}
          onClick={() => systemConfig.set && setShowSystemConfig(true)}
          disabled={!systemConfig.set}
          title={systemConfig.set ? systemConfig.path : 'LS_EVAL_SYSTEM_CFG_PATH not set'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          {systemConfig.set ? 'System Config' : 'No System Config'}
        </button>
        <ThemeToggle />
      </header>

      <div className="container">
        <div className="tabs">
          {TAB_GROUPS.map((group, gi) => (
            <div key={gi} className="tab-group">
              {gi > 0 && <div className="tab-divider" />}
              {group.map(t => (
                <div
                  key={t.id}
                  className={`tab ${activeTab === t.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {TAB_ICONS[t.id]}{t.label}
                </div>
              ))}
            </div>
          ))}
          <div className="tab-spacer" />
          <button
            className={`refresh-btn${refreshing ? ' spinning' : ''}`}
            onClick={refresh}
            disabled={refreshing}
            title="Refresh data"
            aria-label="Refresh data"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh
          </button>
          <button
            className={`run-btn${activeTab === 'run' ? ' active' : ''}`}
            onClick={() => setActiveTab('run')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run
          </button>
        </div>

        <div className="tab-content">
          {!['evaluations', 'scenarios', 'run'].includes(activeTab) && (
            <FilterBar
              metadata={metadata}
              filters={filters}
              setters={setters}
              reset={reset}
              ALL={ALL}
            />
          )}

          {activeTab === 'overview' && (
            <>
              <StatsCards entries={filtered} />
              <div className="charts two-col">
                <ResultsPieChart entries={filtered} />
                <MetricBarChart entries={filtered} />
              </div>
              <div className="charts">
                <StackedBarChart entries={filtered} />
              </div>
            </>
          )}

          {activeTab === 'evaluations' && (
            <Explorer systemConfigPath={systemConfig.set ? systemConfig.path : null} view="evaluations" />
          )}

          {activeTab === 'scenarios' && (
            <Explorer systemConfigPath={systemConfig.set ? systemConfig.path : null} view="scenarios" />
          )}

          {activeTab === 'trends' && (
            <div className="charts">
              <CollapsiblePanel title="Average Score Over Time" tooltip="Click on a datapoint to view full evaluation details">
                <AvgScoreTrendChart entries={filtered} onDataClick={setDetailView} />
              </CollapsiblePanel>
              <CollapsiblePanel title="Score Trends Over Time (by Metric)" tooltip="Click on a datapoint to view full evaluation details">
                <ScoreTrendChart entries={filtered} onDataClick={setDetailView} />
              </CollapsiblePanel>
              <CollapsiblePanel title="Execution Time Trends">
                <ExecTimeTrendChart entries={filtered} />
              </CollapsiblePanel>
            </div>
          )}

          {activeTab === 'details' && (
            <ResultsTable entries={filtered} />
          )}

          {activeTab === 'run' && (
            <RunPage />
          )}
        </div>
      </div>

      {detailView && (
        <DetailModal
          date={detailView.date}
          metric={detailView.metric}
          entries={filtered}
          onClose={() => setDetailView(null)}
        />
      )}

      {showSystemConfig && systemConfig.set && (
        <SystemConfigModal
          config={systemConfig}
          onClose={() => setShowSystemConfig(false)}
          onSave={(content) => setSystemConfig(prev => ({ ...prev, content }))}
        />
      )}

    </div>
  )
}
