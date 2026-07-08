require('dotenv').config()
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
// Railway (and most PaaS hosts) inject the port via the PORT env var; fall back
// to 3000 for local development.
const PORT = process.env.PORT || 3000;

// Ensure the uploads/ folder exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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

// Configure multer to store uploaded files in uploads/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Preserve the original name, prefixed to avoid collisions
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Only accept .docx files
    if (path.extname(file.originalname).toLowerCase() === '.docx') {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are allowed'));
    }
  },
});

// POST /api/compare — accept multiple .docx uploads under field name "documents"
app.post('/api/compare', upload.array('documents'), (req, res) => {
  const files = (req.files || []).map((file) => file.path);
  res.json({ success: true, files });
});

// POST /api/cleanup — delete all files in the uploads/ folder
app.post('/api/cleanup', (req, res) => {
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    let deleted = 0;
    for (const file of files) {
      try {
        fs.unlinkSync(path.join(UPLOADS_DIR, file));
        deleted += 1;
      } catch (unlinkErr) {
        // Continue deleting the rest even if one fails
      }
    }

    res.json({ success: true, deleted });
  });
});

app.use(express.json({ limit: '50kb' }))

// POST /api/analyze-clause — Phase 2: strategic AI analysis of a single clause.
// The Anthropic API key stays server-side (process.env.ANTHROPIC_API_KEY); the
// browser never sees it. Uses the Messages API (verified against the Claude API
// reference: /v1/messages, x-api-key + anthropic-version 2023-06-01, model +
// max_tokens + system + messages; response text at data.content[0].text).
app.post('/api/analyze-clause', async (req, res) => {
  try {
    // TEMP debug logging — remove after diagnosing the 500
    console.log('API key present:', !!process.env.ANTHROPIC_API_KEY)
    console.log('API key prefix:',
      process.env.ANTHROPIC_API_KEY
        ? process.env.ANTHROPIC_API_KEY.substring(0,10)
        : 'MISSING')

    const { clauseText, negotiationSide, context } = req.body

    if(!clauseText || clauseText.trim().length < 10){
      return res.status(400).json({
        error: 'Clause text too short to analyze'
      })
    }

    const sideLabel = negotiationSide === 'sellside'
      ? 'Sell-Side' : 'Buy-Side'

    const systemPrompt = `You are an expert M&A attorney's
assistant specializing in contract negotiation across all
types of complex commercial agreements including M&A
transactions, real estate deals, derivatives contracts,
insurance agreements, and other multi-party negotiations.

You analyze contract clauses and provide strategic guidance
based on the negotiating position provided. You have deep
knowledge of market standard agreement language and common
negotiating positions.

Always structure your response using EXACTLY these four
headers in this order, with nothing before the first header:

**WHAT THIS CLAUSE MEANS**
[Plain explanation of what this clause does and its legal effect]

**WHY IT MATTERS**
[The risk, implication, or strategic importance for the
specified negotiating position]

**MARKET CONTEXT**
[What is typical/standard in comparable negotiations.
What sophisticated parties typically accept or push back on]

**SUGGESTED LANGUAGE**
[Actual replacement or modified clause language that
strengthens the position. Format as a direct quote
the attorney can use or adapt]

Be direct and practical. You are advising a sophisticated
attorney, not a layperson. Keep total response under 400 words.`

    const userPrompt = `I am representing the ${sideLabel}
in this negotiation.

The current clause reads:
"${clauseText.trim()}"

${context ? 'Additional context: ' + context : ''}

Please analyze this clause from my ${sideLabel} perspective
and suggest stronger language for my position.`

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
          messages: [
            { role: 'user', content: userPrompt }
          ]
        })
      }
    )

    if(!response.ok){
      const errData = await response.json()
      console.error('Claude API error status:', response.status)
      console.error('Claude API error body:',
        JSON.stringify(errData))
      return res.status(500).json({
        error: 'AI analysis failed. Please try again.'
      })
    }

    const data = await response.json()
    const analysisText = data.content[0].text

    res.json({
      analysis: analysisText,
      side: sideLabel
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
