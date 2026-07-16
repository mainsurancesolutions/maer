const express = require('express')
const { Resend } = require('resend')
const path = require('path')
const app = express()
const PORT = process.env.PORT || 4000

// Railway runs behind a proxy — needed for correct req.ip in the
// contact-form rate limiter (otherwise every visitor shares one bucket)
app.set('trust proxy', 1)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Simple in-memory rate limiter for the contact form (no extra package)
const contactSubmissions = new Map()

function isRateLimited(ip) {
  let now = Date.now()
  let submissions = contactSubmissions.get(ip) || []
  // Remove submissions older than 1 hour
  submissions = submissions.filter(
    t => now - t < 60 * 60 * 1000)
  if(submissions.length >= 3) return true
  submissions.push(now)
  contactSubmissions.set(ip, submissions)
  return false
}

app.use(express.static(path.join(__dirname)))

async function verifyRecaptcha(token) {
  try {
    let response = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded'
        },
        body: 'secret=' +
          process.env.RECAPTCHA_SECRET_KEY +
          '&response=' + token
      }
    )
    let data = await response.json()
    console.log('reCAPTCHA score:', data.score)
    // Score 0.5+ is likely human, below is likely bot
    return data.success && data.score >= 0.5
  } catch(e) {
    console.error('reCAPTCHA error:', e)
    return true // fail open so real users aren't blocked
  }
}

app.post('/contact', async (req, res) => {
  try {
    // Rate limit: max 3 submissions per IP per hour
    let ip = req.ip || req.connection.remoteAddress
    if(isRateLimited(ip)) {
      return res.redirect('/?error=ratelimit')
    }

    const { name, email, organization,
            interest, message } = req.body

    // Basic validation
    if(!name || !email || !message) {
      return res.redirect('/?error=missing')
    }

    // Basic email format check
    if(!email.includes('@') || !email.includes('.')) {
      return res.redirect('/?error=invalid')
    }

    // Honeypot spam check - if this hidden field
    // is filled, it's a bot
    if(req.body.website) {
      return res.redirect('/?submitted=true')
    }

    // Verify reCAPTCHA
    let recaptchaToken = req.body['g-recaptcha-response']
    if(recaptchaToken) {
      let isHuman = await verifyRecaptcha(recaptchaToken)
      if(!isHuman) {
        console.log('reCAPTCHA failed - likely bot')
        return res.redirect('/?submitted=true')
        // Redirect as if success so bots don't know they failed
      }
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    const result = await resend.emails.send({
      from: 'ContractsCompare <info@contractscompare.com>',
      to: ['info@contractscompare.com'],
      replyTo: email,
      subject: 'New inquiry: ' + (interest || 'General'),
      text: `
New inquiry from ContractsCompare website

Name: ${name}
Email: ${email}
Organization: ${organization || 'Not provided'}
Interest: ${interest || 'Not specified'}

Message:
${message}

Time: ${new Date().toISOString()}
      `
    })

    if(result.error) {
      console.error('Resend error:', result.error)
      return res.redirect('/?error=true')
    }

    res.redirect('/?submitted=true')

  } catch(err) {
    console.error('Contact form error:', err.message)
    console.error('Error code:', err.code)
    console.error('Error response:', err.response)
    res.redirect('/?error=true')
  }
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})
app.listen(PORT, () => {
  console.log('ContractsCompare website running on port ' + PORT)
})
