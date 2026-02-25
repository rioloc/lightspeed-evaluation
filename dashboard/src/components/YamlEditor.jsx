import { useRef, useCallback } from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { useTheme } from '../hooks/useTheme'

export function LineNumberedEditor({ value, onChange }) {
  const { theme } = useTheme()
  const textareaRef = useRef(null)
  const gutterRef = useRef(null)
  const highlightRef = useRef(null)
  const lineCount = value.split('\n').length

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop
      highlightRef.current.scrollLeft = ta.scrollLeft
    }
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      const start = ta.selectionStart
      const end = ta.selectionEnd
      onChange(value.substring(0, start) + '  ' + value.substring(end))
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }

  return (
    <div className="sc-editor-wrapper">
      <div className="sc-gutter" ref={gutterRef}>
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="sc-line-num">{i + 1}</div>
        ))}
      </div>
      <div className="sc-editor-area">
        <div className="sc-highlight-layer" ref={highlightRef}>
          <SyntaxHighlighter
            language="yaml"
            style={theme === 'dark' ? atomOneDark : atomOneLight}
            customStyle={{
              margin: 0,
              padding: '12px 16px',
              background: 'transparent',
              fontSize: '13px',
              lineHeight: '1.6',
              fontFamily: "'Menlo', 'Consolas', 'Courier New', monospace",
            }}
          >
            {value + '\n'}
          </SyntaxHighlighter>
        </div>
        <textarea
          ref={textareaRef}
          className="sc-textarea"
          value={value}
          onChange={e => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />
      </div>
    </div>
  )
}

export function DiffView({ diff }) {
  const lines = diff.split('\n')
  return (
    <pre className="sc-diff">
      {lines.map((line, i) => {
        let cls = 'sc-diff-line'
        if (line.startsWith('+') && !line.startsWith('+++')) cls += ' sc-diff-add'
        else if (line.startsWith('-') && !line.startsWith('---')) cls += ' sc-diff-del'
        else if (line.startsWith('@@')) cls += ' sc-diff-hunk'
        return <div key={i} className={cls}>{line}</div>
      })}
    </pre>
  )
}
