require('dotenv').config()
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
// Railway (and most PaaS hosts) inject the port via the PORT env var; fall back
// to 3000 for local development.
const PORT = process.env.PORT || 3000;

app.use(cors());

// Railway sits behind a proxy — trust the first hop so req.ip is the real
// client IP (required for the per-IP rate limiting below to work correctly).
app.set('trust proxy', 1)

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy',
    'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=()')
  res.setHeader('Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' " +
        "https://unpkg.com " +
        "https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "img-src 'self' data:",
      "object-src 'none'",
      "frame-ancestors 'none'"
    ].join('; ')
  )
  next()
})

const rateLimit = require('express-rate-limit')

// Rate limit for AI analysis endpoint
// 20 requests per minute per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: {
    error: 'Too many analysis requests. ' +
      'Please wait a moment and try again.'
  },
  standardHeaders: true,
  legacyHeaders: false
})

// More generous limit for general app usage
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: { error: 'Too many requests.' },
  standardHeaders: true,
  legacyHeaders: false
})

// Apply rate limits
app.use('/api/analyze-clause', aiLimiter)
app.use('/api/', generalLimiter)

// Serve index.html and all static assets from the project root
app.use(express.static(__dirname));

// Serve the bundled sample agreement (.docx) files statically
app.use('/samples', express.static(path.join(__dirname, 'samples')));

// List the bundled sample .docx files so the app can offer a "try with sample"
// demo without the user uploading their own (privacy-sensitive) documents.
app.get('/api/sample-files', (req, res) => {
  const samplesDir = path.join(__dirname, 'samples');
  const files = fs.readdirSync(samplesDir)
    .filter(f => f.endsWith('.docx'))
    .sort();
  res.json({ files: files.map(f => '/samples/' + f) });
});

app.use(express.json({ limit: '50kb' }))

// POST /api/analyze-clause — Phase 2: strategic AI analysis of a single clause.
// The Anthropic API key stays server-side (process.env.ANTHROPIC_API_KEY); the
// browser never sees it. Uses the Messages API (verified against the Claude API
// reference: /v1/messages, x-api-key + anthropic-version 2023-06-01, model +
// max_tokens + system + messages; response text at data.content[0].text).
app.post('/api/analyze-clause', async (req, res) => {
  try {
    let { clauseText, negotiationSide,
            clauseHistory, totalVersions } = req.body

    if(!clauseText || clauseText.trim().length < 10){
      return res.status(400).json({
        error: 'Clause text too short to analyze'
      })
    }

    // Sanitize input
    clauseText = clauseText
      .replace(/<[^>]*>/g, '') // strip HTML tags
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // printable ASCII only
      .trim()
      .substring(0, 5000) // max 5000 chars

    if(clauseText.length < 10) {
      return res.status(400).json({
        error: 'Clause text too short to analyze'
      })
    }

    const sideLabel = negotiationSide === 'sellside'
      ? 'Sell-Side' : 'Buy-Side'

    // Fetch relevant precedents from library
    let precedentSection = ''
    try {
      const precedentsPath = path.join(
        __dirname, 'precedents', 'index.json')
      if(fs.existsSync(precedentsPath)) {
        const library = JSON.parse(
          fs.readFileSync(precedentsPath, 'utf8'))

        function detectClauseType(text) {
          let lower = text.toLowerCase()
          if(lower.includes('material adverse'))
            return 'MAE'
          if(lower.includes('indemnif') ||
             lower.includes('shall not exceed'))
            return 'indemnification'
          if(lower.includes('termination fee'))
            return 'termination_fee'
          if(lower.includes('working capital'))
            return 'purchase_price_adjustment'
          if(lower.includes('non-compet') ||
             lower.includes('restrictive'))
            return 'non_compete'
          return 'reps_warranties'
        }

        let clauseType = detectClauseType(clauseText)
        let precedents = []

        for(let deal of (library.deals || [])) {
          if(deal.clauses && deal.clauses[clauseType]) {
            precedents.push({
              company: deal.entity_name || deal.company,
              year: deal.year,
              industry: deal.industry,
              size_mm: deal.deal_size_mm,
              text: deal.clauses[clauseType]
                .substring(0, 600)
            })
          }
        }

        if(precedents.length > 0) {
          precedentSection = '\n\nPRECEDENT LIBRARY - ' +
            'Similar clauses from real negotiated transactions ' +
            'in the $250M-$750M range:\n'
          for(let p of precedents.slice(0, 3)) {
            precedentSection += '\n' + p.company +
              ' (' + p.industry + ', ' + p.year +
              ', $' + p.size_mm + 'M deal):\n"' +
              p.text + '"\n'
          }
        }
      }
    } catch(e) {
      console.error('Precedent fetch error:', e)
    }

    let historySection = ''
    if(clauseHistory && clauseHistory.length > 1){
      historySection = '\n\nNEGOTIATION HISTORY across all ' +
        totalVersions + ' versions:\n'
      for(let h of clauseHistory){
        historySection += '\n' + h.versionName + ':\n"' +
          h.text + '"\n'
      }
      if(clauseHistory.length >= 2){
        let first = clauseHistory[0]
        let last = clauseHistory[clauseHistory.length-1]
        historySection += '\nThis clause has evolved across ' +
          clauseHistory.length + ' versions, from "' +
          first.versionName + '" to "' +
          last.versionName + '".'
      }
    }

    const systemPrompt = `You are an expert attorney's
assistant specializing in contract negotiation across M&A
transactions, real estate deals, derivatives,
insurance agreements, and other complex multi-party
negotiations.

When negotiation history is provided, analyze the
TREND carefully:
- Which party has made more concessions
- Whether the current position is favorable or unfavorable
- What leverage exists based on the negotiation history
- What a realistic next position would be

Structure your response with EXACTLY these four headers:

**WHAT THIS CLAUSE MEANS**
[Plain explanation of what this clause does]

**NEGOTIATION ANALYSIS**
[If history provided: analyze the trend, concessions made,
current position vs market standard.
If no history: why this clause matters for this position]

**MARKET CONTEXT**
[What is typical in comparable negotiations]
When precedent clauses from real transactions are provided, reference them specifically by company name and year to ground your Market Context and Recommended Next Position in actual negotiated outcomes.

**RECOMMENDED NEXT POSITION**
[Actual contract language to propose next, no preamble,
no asterisks, just the language itself]

Be direct. You are advising a sophisticated attorney.
Under 500 words total.`

    const userPrompt = `I am representing the ${sideLabel}.

Current clause (${totalVersions > 1 ?
  'Version ' + totalVersions : 'current version'}):
"${clauseText.trim()}"
${historySection}
${precedentSection}

Analyze from my ${sideLabel} perspective.`

    const response = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      }
    )

    if(!response.ok){
      const errData = await response.json()
      console.error('Claude API error:',
        JSON.stringify(errData))
      return res.status(500).json({
        error: 'AI analysis failed. Please try again.'
      })
    }

    const data = await response.json()
    const analysisText = data.content[0].text

    res.json({
      analysis: analysisText,
      side: sideLabel,
      versionsAnalyzed: clauseHistory ?
        clauseHistory.length : 1
    })

  } catch(err) {
    console.error('Analyze clause error:', err)
    res.status(500).json({
      error: 'Something went wrong. Please try again.'
    })
  }
})

app.post('/api/search-precedents', (req, res) => {
  try {
    const { clauseText, industry } = req.body
    const precedentsPath = path.join(
      __dirname, 'precedents', 'index.json')

    if(!fs.existsSync(precedentsPath)) {
      return res.json({ precedents: [] })
    }

    const library = JSON.parse(
      fs.readFileSync(precedentsPath, 'utf8'))

    if(!library.deals || library.deals.length === 0) {
      return res.json({ precedents: [] })
    }

    // Detect clause type from clicked text
    function detectClauseType(text) {
      let lower = (text || '').toLowerCase()
      if(lower.includes('material adverse') ||
         lower.includes('mae')) return 'MAE'
      if(lower.includes('indemnif') ||
         lower.includes('liability') ||
         lower.includes('shall not exceed'))
        return 'indemnification'
      if(lower.includes('termination fee') ||
         lower.includes('break-up'))
        return 'termination_fee'
      if(lower.includes('closing') &&
         lower.includes('condition'))
        return 'closing_conditions'
      if(lower.includes('non-compet') ||
         lower.includes('noncompet') ||
         lower.includes('restrictive'))
        return 'non_compete'
      if(lower.includes('working capital') ||
         lower.includes('purchase price adjust'))
        return 'purchase_price_adjustment'
      if(lower.includes('represent') ||
         lower.includes('warrant'))
        return 'reps_warranties'
      return null
    }

    let clauseType = detectClauseType(clauseText)

    // Find deals with matching clause type
    let matches = []
    for(let deal of library.deals) {
      if(!deal.clauses) continue

      // If we detected a clause type, prefer matches
      let clauseText_found = null
      let matchedType = null
      if(clauseType && deal.clauses[clauseType]) {
        clauseText_found = deal.clauses[clauseType]
        matchedType = clauseType
      } else {
        // Return first available clause as context
        let firstKey = Object.keys(deal.clauses)[0]
        if(firstKey) {
          clauseText_found = deal.clauses[firstKey]
          matchedType = firstKey
        }
      }

      if(clauseText_found) {
        // --- reconstructed from here (original message was truncated) ---
        matches.push({
          company: deal.company,
          buyer: deal.buyer,
          industry: deal.industry,
          deal_size_mm: deal.deal_size_mm,
          year: deal.year,
          clause_type: matchedType,
          exact_match: matchedType === clauseType,
          clause_text: clauseText_found,
          source_url: deal.source_url
        })
      }
    }

    // Exact clause-type matches first, then same-industry, then the rest
    matches.sort((a, b) =>
      (b.exact_match - a.exact_match) ||
      ((industry && b.industry === industry ? 1 : 0) -
       (industry && a.industry === industry ? 1 : 0))
    )

    res.json({ clauseType: clauseType, precedents: matches })

  } catch(err) {
    console.error('Search precedents error:', err)
    res.json({ precedents: [] })
  }
})

app.listen(PORT, () => {
  console.log('ContractsCompare server running on port ' + PORT);
});
