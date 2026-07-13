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
    const { clauseText, negotiationSide,
            clauseHistory, totalVersions } = req.body

    if(!clauseText || clauseText.trim().length < 10){
      return res.status(400).json({
        error: 'Clause text too short to analyze'
      })
    }

    const sideLabel = negotiationSide === 'sellside'
      ? 'Sell-Side' : 'Buy-Side'

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

app.listen(PORT, () => {
  console.log('ContractsCompare server running on port ' + PORT);
});
