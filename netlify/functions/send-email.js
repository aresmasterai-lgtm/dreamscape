// ── Shared email sender using Resend ─────────────────────────
// Add RESEND_API_KEY to Netlify env vars
// Get one free at resend.com — 3,000 emails/month free

const FROM = 'Dreamscape <noreply@trydreamscape.com>'

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — email skipped:', subject)
    return null
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
    const data = await res.json()
    if (!res.ok) console.error('Resend error:', data)
    return data
  } catch (err) {
    console.error('Email send failed:', err.message)
    return null
  }
}

// ── Email templates ───────────────────────────────────────────
const BASE = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #080B14; font-family: 'DM Sans', Arial, sans-serif; color: #E8EAF0; }
    .wrap { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .logo { font-size: 22px; font-weight: 900; color: #E8EAF0; margin-bottom: 32px; }
    .logo span { color: #00D4AA; }
    .card { background: #131826; border: 1px solid #1E2A40; border-radius: 16px; padding: 28px 32px; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #E8EAF0; margin: 0 0 12px; line-height: 1.3; }
    p { font-size: 14px; color: #6B7494; line-height: 1.7; margin: 0 0 16px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #7C5CFC, #4B2FD0); border-radius: 10px; padding: 12px 28px; color: #fff !important; font-size: 14px; font-weight: 700; text-decoration: none; margin: 8px 0; }
    .stat { display: inline-block; background: #0E1220; border: 1px solid #1E2A40; border-radius: 10px; padding: 12px 20px; margin: 4px; text-align: center; }
    .stat-val { font-size: 22px; font-weight: 900; color: #00D4AA; }
    .stat-lbl { font-size: 11px; color: #6B7494; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
    .footer { font-size: 11px; color: #6B7494; text-align: center; margin-top: 32px; line-height: 1.6; }
    a { color: #7C5CFC; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="logo">Dream<span>scape</span> ✦</div>
    ${content}
    <div class="footer">
      You're receiving this because you have a Dreamscape account.<br>
      <a href="https://trydreamscape.com/profile">Manage notifications</a> · 
      <a href="https://trydreamscape.com">trydreamscape.com</a>
    </div>
  </div>
</body>
</html>`

export const templates = {
  sale: ({ productName, earnings, buyerLocation, orderId }) => ({
    subject: `💸 You made a sale! — ${productName}`,
    html: BASE(`
      <div class="card">
        <h1>🎉 Someone bought your product!</h1>
        <p>Great news — your listing just sold. Your earnings have been added to your pending balance.</p>
        <div style="margin: 20px 0;">
          <div class="stat"><div class="stat-val">$${parseFloat(earnings || 0).toFixed(2)}</div><div class="stat-lbl">Your earnings</div></div>
        </div>
        <p style="margin-top: 12px;"><strong style="color: #E8EAF0;">${productName}</strong>${buyerLocation ? ` — shipped to ${buyerLocation}` : ''}</p>
        <a href="https://trydreamscape.com/profile?tab=analytics" class="btn">View Earnings Dashboard →</a>
      </div>
    `),
  }),

  payout: ({ amount, orderCount }) => ({
    subject: `✅ Your payout of $${parseFloat(amount).toFixed(2)} is on its way`,
    html: BASE(`
      <div class="card">
        <h1>💸 Payout processed!</h1>
        <p>Your earnings have been transferred to your connected bank account.</p>
        <div style="margin: 20px 0;">
          <div class="stat"><div class="stat-val">$${parseFloat(amount).toFixed(2)}</div><div class="stat-lbl">Amount transferred</div></div>
          <div class="stat"><div class="stat-val">${orderCount}</div><div class="stat-lbl">Orders paid out</div></div>
        </div>
        <p>Funds typically arrive in 2-7 business days depending on your bank.</p>
        <a href="https://trydreamscape.com/profile?tab=analytics" class="btn">View Payout History →</a>
      </div>
    `),
  }),

  newFollower: ({ followerUsername, followerDisplayName }) => ({
    subject: `✦ @${followerUsername} started following you on Dreamscape`,
    html: BASE(`
      <div class="card">
        <h1>You have a new follower!</h1>
        <p><strong style="color: #E8EAF0;">${followerDisplayName || '@' + followerUsername}</strong> is now following your artwork and products.</p>
        <a href="https://trydreamscape.com/u/${followerUsername}" class="btn">View their profile →</a>
        <p style="margin-top: 16px;">Keep creating — more followers means more potential customers for your products.</p>
      </div>
    `),
  }),

  wishlistSale: ({ productName, price }) => ({
    subject: `⭐ A product on your wishlist is available — ${productName}`,
    html: BASE(`
      <div class="card">
        <h1>Something you saved is ready!</h1>
        <p>You added <strong style="color: #E8EAF0;">${productName}</strong> to your wishlist. It's still available at <strong style="color: #00D4AA;">$${parseFloat(price).toFixed(2)}</strong>.</p>
        <a href="https://trydreamscape.com/marketplace" class="btn">Shop Now →</a>
      </div>
    `),
  }),
}
