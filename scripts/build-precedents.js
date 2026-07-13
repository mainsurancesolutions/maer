// ContractsCompare Precedent Library Builder — CURATED approach.
// Deal sizes are provided manually (verified); the script's job is to locate
// each target's merger-agreement exhibit on EDGAR and extract clause text.
const https = require('https')
const fs = require('fs')
const path = require('path')

const CURATED_DEALS = [
  // Healthcare
  {company: "Checkmate Pharmaceuticals", cik: "1651431", year: 2022, size_mm: 250, buyer: "Regeneron", industry: "Healthcare"},
  {company: "Turning Point Therapeutics", cik: "1679363", year: 2022, size_mm: 4100, buyer: "Bristol Myers Squibb", industry: "Healthcare"},
  {company: "Invacare Corporation", cik: "742112", year: 2023, size_mm: 265, buyer: "Investor Group", industry: "Healthcare"},

  // Financial Services
  {company: "Home Point Capital", cik: "1830197", year: 2023, size_mm: 324, buyer: "Mr. Cooper Group", industry: "Financial Services"},
  {company: "Investors Bancorp", cik: "1281761", year: 2022, size_mm: 1400, buyer: "Citizens Financial", industry: "Financial Services"},

  // Technology
  {company: "Veoneer", cik: "1733186", year: 2022, size_mm: 3800, buyer: "Qualcomm", industry: "Technology"},
  {company: "Cvent Holding", cik: "1539830", year: 2023, size_mm: 4600, buyer: "Blackstone", industry: "Technology"},

  // Energy
  {company: "Roan Resources", cik: "1326428", year: 2019, size_mm: 508, buyer: "Citizen Energy", industry: "Energy"},
  {company: "Bonanza Creek Energy", cik: "1408675", year: 2021, size_mm: 375, buyer: "Civitas Resources", industry: "Energy"},

  // Real Estate
  {company: "Cole Credit Property Trust III", cik: "1498547", year: 2021, size_mm: 270, buyer: "CIM Real Estate", industry: "Real Estate"},

  // Manufacturing
  {company: "Thermon Group Holdings", cik: "1472501", year: 2022, size_mm: 280, buyer: "Investor Group", industry: "Manufacturing"},

  // Consumer
  {company: "Primo Water Corporation", cik: "1286043", year: 2021, size_mm: 350, buyer: "BlueTriton", industry: "Consumer"},

  // Media/Telecom
  {company: "Vonage Holdings", cik: "1282266", year: 2022, size_mm: 6200, buyer: "Ericsson", industry: "Media/Telecom"},

  // Additional deals verified in-range from filing evidence (SC TO-T candidates)
  {company: "Stemline Therapeutics", cik: "1264587", year: 2020, size_mm: 677, buyer: "Menarini Group", industry: "Healthcare"},
  {company: "Ruth's Hospitality Group", cik: "1324272", year: 2023, size_mm: 715, buyer: "Darden Restaurants", industry: "Consumer"},
]

const CLAUSE_PATTERNS = {
  // Regex tolerates the quote style (straight/smart), spaces the HTML introduces
  // around the quoted term, and "means"/"shall mean"; targets the (Company)
  // definition and excludes "Parent Material Adverse Effect".
  MAE: [
    /["“]\s*(?:Company )?Material Adverse Effect\s*["”]\s+(?:means|shall mean)/i,
    /(?:Company )?Material Adverse Effect\s+(?:means|shall mean)\s+any/i
  ],
  indemnification: [
    'shall not exceed',
    'Indemnification Cap',
    'maximum aggregate liability',
    'aggregate liability of the Seller',
    'liability of Seller shall not exceed'
  ],
  termination_fee: [
    'Company Termination Fee" means',
    'Parent Termination Fee" means',
    'Termination Fee" means',
    'termination fee equal to',
    'termination fee of $'
  ],
  closing_conditions: [
    'Conditions to the Obligations of Each Party',
    'Conditions to the Obligation of Parent',
    'Conditions to Closing',
    'Additional Conditions to the Obligations'
  ],
  non_compete: [
    'shall not, directly or indirectly, engage',
    'non-competition covenant',
    'Restricted Period',
    'Noncompetition; Nonsolicitation'
  ],
  purchase_price_adjustment: [
    'Closing Working Capital',
    'Working Capital Target',
    'Working Capital Adjustment',
    'Post-Closing Adjustment'
  ],
  reps_warranties: [
    'REPRESENTATIONS AND WARRANTIES OF THE COMPANY',
    'Representations and Warranties of the Company',
    'Company represents and warrants to Parent'
  ]
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function decodeHtmlEntities(text) {
  return text
    .replace(/&#8220;|&#147;|&ldquo;/g, '"')
    .replace(/&#8221;|&#148;|&rdquo;/g, '"')
    .replace(/&#8216;|&lsquo;/g, "'")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&[a-z]+;/g, ' ')
}

// Find where the operative agreement starts (skip cover page + table of contents).
function findBodyStart(text) {
  let markers = [
    'NOW, THEREFORE, in consideration of',
    'NOW THEREFORE, in consideration of',
    'WITNESSETH:',
    'W I T N E S S E T H',
    'RECITALS',
    'The parties agree as follows',
    'ARTICLE I\nDEFINITIONS',
    'ARTICLE I\r\nDEFINITIONS',
    'Section 1.1'
  ]
  let searchFrom = Math.floor(text.length * 0.05)
  let bestIdx = Math.floor(text.length * 0.4)
  for(let marker of markers) {
    let idx = text.indexOf(marker, searchFrom)
    if(idx !== -1 && idx < bestIdx) bestIdx = idx
  }
  return bestIdx
}

function extractClause(text, patterns, windowSize = 2000) {
  let clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  let body = clean.substring(findBodyStart(clean))
  for(let pattern of patterns) {
    let idx
    if(pattern instanceof RegExp) {
      let m = pattern.exec(body)
      idx = m ? m.index : -1
    } else {
      idx = body.toLowerCase().indexOf(pattern.toLowerCase())
    }
    if(idx === -1) continue
    let start = Math.max(0, idx - 50)
    let end = Math.min(body.length, idx + windowSize)
    let excerpt = body.substring(start, end).trim()
    let lastPeriod = excerpt.lastIndexOf('. ')
    if(lastPeriod > windowSize / 2) excerpt = excerpt.substring(0, lastPeriod + 1)
    // TOC/index guard: real operative language is long-form
    if(excerpt.length < 200) continue
    return excerpt.substring(0, 1500)
  }
  return null
}

function rawFetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'ContractsCompare Research kirk@contractscompare.com',
        'Accept': '*/*'
      },
      timeout: 25000
    }, (res) => {
      if(res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return rawFetch(res.headers.location).then(resolve).catch(reject)
      }
      if(res.statusCode !== 200) { res.resume(); return resolve({ __status: res.statusCode }) }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch(e) { resolve(data) } })
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')) })
  })
}

// Polite fetch: global ~300ms spacing between SEC requests + retry on 503.
let _lastReq = 0
async function fetchUrl(url) {
  for(let attempt = 0; attempt < 3; attempt++) {
    let wait = Math.max(0, _lastReq + 300 - Date.now())
    if(wait) await sleep(wait)
    _lastReq = Date.now()
    let r
    try { r = await rawFetch(url) }
    catch(e) { if(attempt < 2) { await sleep(1000); continue } throw e }
    if(r && r.__status === 503) { await sleep(1500 * (attempt + 1)); continue }
    return r
  }
  return { __status: 503 }
}

// Normalize a company name for loose matching (drops "(CIK ...)", punctuation, case).
function normName(s) {
  return (s || '').toLowerCase().replace(/\(cik[^)]*\)/i, '').replace(/[^a-z0-9]/g, '')
}

// Look up the correct CIK for a company by name via EDGAR full-text search.
// Returns { cik, name } from the first filing whose filer name matches, else null.
async function lookupCIK(companyName) {
  let q = encodeURIComponent('"' + companyName + '"')
  let url = `https://efts.sec.gov/LATEST/search-index?q=${q}&forms=SC+TO-T,DEFM14A,8-K`
  let r
  try { r = await fetchUrl(url) } catch(e) { return null }
  let hits = (r && r.hits && r.hits.hits) || []
  let target = normName(companyName)
  let key = target.slice(0, 12)
  for(let h of hits) {
    let names = h._source.display_names || []
    let ciks = h._source.ciks || []
    for(let i = 0; i < names.length; i++) {
      let nm = normName(names[i])
      if(nm.startsWith(key) || nm.includes(key)) {
        return { cik: ciks[i], name: names[i].replace(/\s*\(cik[^)]*\)/i, '').trim() }
      }
    }
  }
  return null
}

// Locate the merger-agreement exhibit via ONE full-text-search query scoped to
// the target's CIK. Returns the EX-2.x document URL, or null (e.g. tender offers,
// where the agreement is filed under the acquirer's CIK instead).
async function findAgreement(cik10, dealYear) {
  let url = `https://efts.sec.gov/LATEST/search-index?q=%22Agreement+and+Plan+of+Merger%22&ciks=${cik10}&forms=8-K,DEFM14A,SC+TO-T`
  let r
  try { r = await fetchUrl(url) } catch(e) { return null }
  let hits = (r && r.hits && r.hits.hits) || []
  let exRe = /ex[-_]?0?2[._d-]?\d*\.htm$/i
  let best = null, bestScore = -1
  for(let h of hits) {
    let fn = (h._id.split(':')[1] || '')
    let ft = (h._source.file_type || '')
    let isEx2 = /^EX-2/i.test(ft) || exRe.test(fn)
    if(!isEx2) continue
    // year-constrained: only agreements filed within ±1 year of the deal
    if(dealYear) {
      let fy = parseInt((h._source.file_date || '').slice(0, 4))
      if(fy && Math.abs(fy - dealYear) > 1) continue
    }
    // prefer EX-2.1 exactly, then larger file
    let score = (/^EX-2\.1$/i.test(ft) || /ex[-_]?0?2[._d-]?0?1\.htm$/i.test(fn) ? 1e12 : 0) + (parseInt(h._source.size) || 0)
    if(score > bestScore) { bestScore = score; best = h }
  }
  if(!best) return null
  let adsh = best._id.split(':')[0].replace(/-/g, '')
  let fn = best._id.split(':')[1]
  let cikNum = parseInt(cik10).toString()
  return {
    url: `https://www.sec.gov/Archives/edgar/data/${cikNum}/${adsh}/${fn}`,
    form: best._source.form
  }
}

async function processDeal(deal) {
  let log = { company: deal.company, providedCik: deal.cik, cikUsed: deal.cik,
    cikCorrected: null, cikVerified: false, entityName: null,
    filingFound: false, form: null, clauseCount: 0, errors: [] }

  // 0. Look up the correct CIK by company name; override the provided one on match.
  let looked = null
  try { looked = await lookupCIK(deal.company) } catch(e) {}
  let cik = deal.cik
  let nameMatchedViaLookup = false
  if(looked && looked.cik) {
    cik = looked.cik
    nameMatchedViaLookup = true
    if(looked.cik.replace(/^0+/, '') !== deal.cik.replace(/^0+/, '')) {
      log.cikCorrected = `${deal.cik} -> ${looked.cik}`
    }
  } else {
    log.errors.push('name lookup found no match; using provided CIK ' + deal.cik)
  }
  log.cikUsed = cik
  let cik10 = cik.padStart(10, '0')

  // 1. Verify CIK via submissions API
  let sub
  try { sub = await fetchUrl(`https://data.sec.gov/submissions/CIK${cik10}.json`) }
  catch(e) { log.errors.push('submissions fetch failed: ' + e.message); return { log, deal: null } }
  if(!sub || !sub.filings || !sub.filings.recent) {
    log.errors.push('no submissions data (CIK may be wrong)')
    return { log, deal: null }
  }
  log.cikVerified = true
  log.entityName = sub.name

  // Name-match guard. lookupCIK already matched the filing-time name (handles
  // post-acquisition renames like Veoneer->Arriver). Only guard on the current
  // entity name when we fell back to the provided CIK.
  if(!nameMatchedViaLookup) {
    let a = normName(deal.company), b = normName(sub.name)
    if(!(b.includes(a.slice(0, 10)) || a.includes(b.slice(0, 10)))) {
      log.errors.push(`name mismatch: expected "${deal.company}" but CIK ${cik} is "${sub.name}" — skipping`)
      return { log, deal: null }
    }
  }

  // 2. Locate the merger-agreement EX-2.x exhibit via one CIK-scoped FTS query
  let found
  try { found = await findAgreement(cik10, deal.year) } catch(e) { log.errors.push('agreement search failed: ' + e.message); return { log, deal: null } }
  if(!found) {
    log.errors.push('no EX-2.x agreement filed under this CIK (e.g. tender offer / non-merger)')
    return { log, deal: null }
  }
  log.filingFound = true
  log.form = found.form
  let exhibitUrl = found.url
  let usedForm = found.form

  // 3. Fetch the exhibit and extract clauses
  let doc
  try { doc = await fetchUrl(exhibitUrl) } catch(e) { log.errors.push('exhibit fetch failed: ' + e.message); return { log, deal: null } }
  if(typeof doc !== 'string' || doc.length < 5000) {
    log.errors.push('exhibit too short or missing')
    return { log, deal: null }
  }

  let decoded = decodeHtmlEntities(doc)
  let clauses = {}
  for(let [clauseType, patterns] of Object.entries(CLAUSE_PATTERNS)) {
    let extracted = extractClause(decoded, patterns)
    if(extracted) clauses[clauseType] = extracted
  }
  log.clauseCount = Object.keys(clauses).length

  let record = {
    company: deal.company,
    buyer: deal.buyer,
    cik: cik,
    entity_name: sub.name,
    year: deal.year,
    industry: deal.industry,
    deal_size_mm: deal.size_mm,
    form: usedForm,
    source_url: exhibitUrl,
    clauses: clauses
  }
  return { log, deal: record }
}

async function main() {
  console.log('ContractsCompare Precedent Library Builder (curated)')
  console.log('====================================================')
  let test = process.argv.includes('--test')
  let list = test ? CURATED_DEALS.slice(0, 3) : CURATED_DEALS
  console.log(`Processing ${list.length} deal(s)${test ? ' [--test]' : ''}\n`)

  let deals = []
  for(let d of list) {
    console.log(`=== ${d.company} (CIK ${d.cik}, ${d.year}, $${d.size_mm}M, ${d.industry}) ===`)
    let out
    try { out = await processDeal(d) }
    catch(e) { console.log('  FATAL: ' + e.message + '\n'); continue }
    let L = out.log
    console.log(`  CIK lookup: used ${L.cikUsed}${L.cikCorrected ? ' [corrected ' + L.cikCorrected + ']' : (L.cikUsed === L.providedCik ? ' (matches provided)' : '')}`)
    console.log(`  CIK verified on EDGAR: ${L.cikVerified ? 'yes (' + (L.entityName || '') + ')' : 'NO'}`)
    console.log(`  Filing found: ${L.filingFound ? 'yes — ' + L.form : 'no'}`)
    console.log(`  Clauses extracted: ${L.clauseCount}${L.clauseCount ? ' [' + Object.keys(out.deal.clauses).join(', ') + ']' : ''}`)
    if(L.errors.length) console.log('  Errors: ' + L.errors.join('; '))
    if(out.deal) deals.push(out.deal)
    console.log('')
    await sleep(300)
  }

  let output = {
    version: '1.0',
    last_updated: new Date().toISOString().slice(0, 10),
    source: 'curated',
    deal_count: deals.length,
    deals: deals
  }
  let outPath = path.join(__dirname, '..', 'precedents', 'index.json')
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log('====================================================')
  console.log(`Completed: ${deals.length}/${list.length} deals produced clause data`)
  console.log(`Saved to ${outPath}`)
}

main().catch(console.error)
