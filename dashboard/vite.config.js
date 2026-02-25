import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync, spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const evalOutputDir = path.resolve(__dirname, './results')
const scenariosDir = path.resolve(__dirname, './scenarios')

function evalDataPlugin() {
  const activeRuns = new Map()
  let runIdCounter = 0

  return {
    name: 'eval-data',
    configureServer(server) {
      server.middlewares.use('/results', (req, res, next) => {
        const filePath = path.join(evalOutputDir, decodeURIComponent(req.url))
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath)
          const types = { '.csv': 'text/csv', '.yaml': 'text/yaml', '.yml': 'text/yaml', '.png': 'image/png' }
          res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
          fs.createReadStream(filePath).pipe(res)
        } else {
          next()
        }
      })

      server.middlewares.use('/api/manifest', (_req, res) => {
        const files = fs.readdirSync(evalOutputDir)
          .filter(f => /^evaluation_\d{8}_\d{6}_detailed\.csv$/.test(f))
          .sort()
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(files))
      })

      server.middlewares.use('/api/amended-files', (_req, res) => {
        const files = fs.readdirSync(evalOutputDir)
          .filter(f => /_amended_\d{8}_\d{6}\.yaml$/.test(f))
          .sort()
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(files))
      })

      server.middlewares.use('/api/eval-graphs', (_req, res) => {
        const graphsDir = path.join(evalOutputDir, 'graphs')
        const map = {}
        try {
          for (const f of fs.readdirSync(graphsDir)) {
            const m = f.match(/^evaluation_(\d{8}_\d{6})_.+\.png$/)
            if (m) {
              if (!map[m[1]]) map[m[1]] = []
              map[m[1]].push(f)
            }
          }
        } catch { /* ignore if dir doesn't exist */ }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(map))
      })

      server.middlewares.use('/api/run-config', (_req, res) => {
        const systemConfig = process.env.LS_EVAL_SYSTEM_CFG_PATH || ''
        const apiKey = process.env.API_KEY || ''
        let scenarios = []
        try {
          for (const scenarioDir of fs.readdirSync(scenariosDir, { withFileTypes: true })) {
            if (!scenarioDir.isDirectory()) continue
            const subdir = path.join(scenariosDir, scenarioDir.name)
            for (const file of fs.readdirSync(subdir, { withFileTypes: true })) {
              if (!file.isFile()) continue
              if (/\.ya?ml$/.test(file.name)) {
                scenarios.push(`${scenarioDir.name}/${file.name}`)
              }
            }
          }
        } catch { /* ignore */ }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ systemConfig, apiKey: !!apiKey, scenarios: scenarios.sort() }))
      })

      server.middlewares.use('/api/run-eval', (req, res, next) => {
        if (req.method !== 'POST') return next()
        let body = ''
        req.on('data', c => { body += c })
        req.on('end', () => {
          let parsed
          try {
            parsed = JSON.parse(body)
          } catch {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid JSON' }))
            return
          }
          const { systemConfig, scenario } = parsed
          if (!systemConfig || !scenario) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing parameters' }))
            return
          }

          const id = String(++runIdCounter)
          const cwd = __dirname
          const evalDataPath = path.join(scenariosDir, scenario)
          const outputPath = evalOutputDir

          const child = spawn('lightspeed-eval', [
            '--system-config', systemConfig,
            '--eval-data', evalDataPath,
            '--output-dir', outputPath,
          ], {
            cwd,
            env: { ...process.env, PYTHONUNBUFFERED: '1' },
          })

          const run = {
            id, pid: child.pid, scenario, systemConfig,
            startTime: Date.now(), output: '', exitCode: null,
            status: 'running', listeners: new Set(), child,
          }
          activeRuns.set(id, run)

          child.stdout.on('data', (d) => {
            const text = d.toString()
            run.output += text
            for (const fn of run.listeners) fn('output', text)
          })
          child.stderr.on('data', (d) => {
            const text = d.toString()
            run.output += text
            for (const fn of run.listeners) fn('output', text)
          })
          child.on('close', (code) => {
            run.exitCode = code ?? 1
            run.status = 'done'
            for (const fn of run.listeners) fn('exit', run.exitCode)
            run.listeners.clear()
          })
          child.on('error', (err) => {
            const text = `Error: ${err.message}\n`
            run.output += text
            for (const fn of run.listeners) fn('output', text)
            run.exitCode = 1
            run.status = 'done'
            for (const fn of run.listeners) fn('exit', 1)
            run.listeners.clear()
          })

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ id, pid: child.pid }))
        })
      })

      server.middlewares.use('/api/running-evals', (_req, res) => {
        const runs = []
        for (const [, run] of activeRuns) {
          runs.push({
            id: run.id, pid: run.pid, scenario: run.scenario,
            startTime: run.startTime, status: run.status,
            exitCode: run.exitCode, source: 'web',
          })
        }
        try {
          const out = execSync('pgrep -af "[l]ightspeed-eval" 2>/dev/null || true').toString().trim()
          if (out) {
            const knownPids = new Set([...activeRuns.values()].map(r => r.pid))
            for (const line of out.split('\n')) {
              const match = line.match(/^(\d+)\s+(.+)/)
              if (!match) continue
              const pid = parseInt(match[1])
              const cmd = match[2]
              if (knownPids.has(pid)) continue
              if (/pgrep|\/bin\/sh/.test(cmd)) continue
              runs.push({
                id: `ext-${pid}`, pid, scenario: cmd,
                startTime: null, status: 'running',
                exitCode: null, source: 'external',
              })
            }
          }
        } catch { /* ignore */ }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(runs))
      })

      server.middlewares.use('/api/eval-stream', (req, res) => {
        const id = decodeURIComponent(req.url.slice(1))
        const run = activeRuns.get(id)
        if (!run) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Run not found' }))
          return
        }
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.setHeader('Connection', 'keep-alive')
        res.setHeader('X-Accel-Buffering', 'no')
        res.flushHeaders()

        const send = (event, data) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        }

        if (run.output) {
          send('output', { text: run.output })
        }

        if (run.status === 'done') {
          send('exit', { code: run.exitCode })
          res.end()
          return
        }

        const listener = (type, data) => {
          if (type === 'output') send('output', { text: data })
          else if (type === 'exit') { send('exit', { code: data }); res.end() }
        }
        run.listeners.add(listener)

        res.on('close', () => {
          run.listeners.delete(listener)
        })
      })

      server.middlewares.use('/api/stop-eval', (req, res, next) => {
        if (req.method !== 'POST') return next()
        const id = decodeURIComponent(req.url.slice(1))
        const run = activeRuns.get(id)
        if (!run || run.status !== 'running') {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Run not found or already done' }))
          return
        }
        run.child.kill()
        run.output += '\n--- Stopped by user ---\n'
        for (const fn of run.listeners) fn('output', '\n--- Stopped by user ---\n')
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      })

      server.middlewares.use('/api/system-config', (req, res) => {
        const cfgPath = process.env.LS_EVAL_SYSTEM_CFG_PATH || ''
        const resolved = cfgPath
          ? path.isAbsolute(cfgPath)
            ? cfgPath
            : path.resolve(__dirname, cfgPath)
          : ''

        if (req.method === 'POST') {
          let body = ''
          req.on('data', c => { body += c })
          req.on('end', () => {
            try {
              const { content } = JSON.parse(body)
              if (!resolved) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'LS_EVAL_SYSTEM_CFG_PATH not set' }))
                return
              }
              fs.writeFileSync(resolved, content, 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, content }))
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message }))
            }
          })
          return
        }

        let content = ''
        if (resolved) {
          try {
            content = fs.readFileSync(resolved, 'utf-8')
          } catch { /* ignore */ }
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ set: !!cfgPath, path: cfgPath, content }))
      })

      server.middlewares.use('/api/system-config-diff', (_req, res) => {
        const cfgPath = process.env.LS_EVAL_SYSTEM_CFG_PATH || ''
        if (!cfgPath) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ hasChanges: false, diff: '' }))
          return
        }
        const cwd = __dirname
        const resolved = path.isAbsolute(cfgPath) ? cfgPath : path.resolve(__dirname, cfgPath)
        let diff = ''
        let hasChanges = false
        try {
          const relPath = path.relative(cwd, resolved)
          diff = execSync(`git diff -- "${relPath}"`, { cwd }).toString()
          if (!diff) {
            diff = execSync(`git diff --staged -- "${relPath}"`, { cwd }).toString()
          }
          hasChanges = diff.length > 0
        } catch { /* ignore */ }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ hasChanges, diff }))
      })

      server.middlewares.use('/api/scenarios', (_req, res) => {
        const results = []
        try {
          for (const scenarioDir of fs.readdirSync(scenariosDir, { withFileTypes: true })) {
            if (!scenarioDir.isDirectory()) continue
            const subdir = path.join(scenariosDir, scenarioDir.name)
            for (const file of fs.readdirSync(subdir, { withFileTypes: true })) {
              if (!file.isFile()) continue
              if (/\.ya?ml$/.test(file.name) && !file.name.startsWith('.')) {
                results.push(`${scenarioDir.name}/${file.name}`)
              }
            }
          }
        } catch { /* ignore */ }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(results.sort()))
      })

      server.middlewares.use('/api/scenario-content', (req, res) => {
        const relPath = decodeURIComponent(req.url.slice(1))
        if (!relPath) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Missing path' }))
          return
        }
        const filePath = path.join(scenariosDir, relPath)
        if (!filePath.startsWith(scenariosDir)) {
          res.statusCode = 403
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Forbidden' }))
          return
        }
        if (req.method === 'POST') {
          let body = ''
          req.on('data', c => { body += c })
          req.on('end', () => {
            try {
              const { content } = JSON.parse(body)
              fs.writeFileSync(filePath, content, 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, content }))
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message }))
            }
          })
          return
        }
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ path: relPath, content }))
        } catch (err) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })

      server.middlewares.use('/api/scenario-diff', (req, res) => {
        const relPath = decodeURIComponent(req.url.slice(1))
        if (!relPath) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ hasChanges: false, diff: '' }))
          return
        }
        const filePath = path.join(scenariosDir, relPath)
        if (!filePath.startsWith(scenariosDir)) {
          res.statusCode = 403
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Forbidden' }))
          return
        }
        const cwd = __dirname
        let diff = ''
        let hasChanges = false
        try {
          const gitRelPath = path.relative(cwd, filePath)
          diff = execSync(`git diff -- "${gitRelPath}"`, { cwd }).toString()
          if (!diff) {
            diff = execSync(`git diff --staged -- "${gitRelPath}"`, { cwd }).toString()
          }
          hasChanges = diff.length > 0
        } catch { /* ignore */ }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ hasChanges, diff }))
      })

      server.middlewares.use('/api/delete-evaluation', (req, res, next) => {
        if (req.method !== 'POST') return next()
        let body = ''
        req.on('data', c => { body += c })
        req.on('end', () => {
          try {
            const { filename } = JSON.parse(body)
            if (!filename || !/^evaluation_\d{8}_\d{6}_detailed\.csv$/.test(filename)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Invalid filename' }))
              return
            }
            const tsMatch = filename.match(/(\d{8}_\d{6})/)
            const ts = tsMatch ? tsMatch[1] : null
            const deleted = []

            const csvPath = path.join(evalOutputDir, filename)
            if (fs.existsSync(csvPath)) {
              fs.unlinkSync(csvPath)
              deleted.push(filename)
            }

            if (ts) {
              for (const f of fs.readdirSync(evalOutputDir)) {
                if (f.includes(ts) && /\.ya?ml$/.test(f)) {
                  fs.unlinkSync(path.join(evalOutputDir, f))
                  deleted.push(f)
                }
              }
              const graphsDir = path.join(evalOutputDir, 'graphs')
              try {
                for (const f of fs.readdirSync(graphsDir)) {
                  if (f.includes(ts)) {
                    fs.unlinkSync(path.join(graphsDir, f))
                    deleted.push(`graphs/${f}`)
                  }
                }
              } catch { /* graphs dir may not exist */ }
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, deleted }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
        })
      })

      server.middlewares.use('/api/git-info', (_req, res) => {
        const cwd = __dirname
        let branch = '', repo = ''
        try {
          branch = execSync('git symbolic-ref --short HEAD 2>/dev/null', { cwd }).toString().trim()
          const remoteUrl = execSync('git remote get-url origin', { cwd }).toString().trim()
          repo = remoteUrl.replace(/.*[/:]([^/]+\/[^/]+?)(?:\.git)?$/, '$1').split('/').pop()
        } catch { /* ignore */ }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ branch, repo }))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), evalDataPlugin()],
  server: {
    fs: { allow: ['.', evalOutputDir] },
  },
})
