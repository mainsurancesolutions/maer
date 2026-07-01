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

app.listen(PORT, () => {
  console.log('ContractsCompare server running on port ' + PORT);
});
