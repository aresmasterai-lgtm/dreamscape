const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  text: '#E8EAF0', muted: '#6B7494',
}

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 36 }}>
    <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>{title}</h2>
    <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.9 }}>{children}</div>
  </div>
)

export default function Privacy() {
  return (
    <div style={{ padding: '60px 20px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Legal</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, color: C.text, marginBottom: 12 }}>Privacy Policy</h1>
        <p style={{ color: C.muted, fontSize: 14 }}>Last updated: March 2026</p>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.accent}33`, borderRadius: 14, padding: '18px 24px', marginBottom: 40, fontSize: 14, color: C.text, lineHeight: 1.7 }}>
        Dreamscape ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information about you when you use our platform at trydreamscape.com and the Dreamscape mobile app.
      </div>

      <Section title="1. Information We Collect">
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Account Information:</strong> When you create an account, we collect your email address and any profile information you choose to provide, including your username, display name, bio, location, website, profile picture, and banner image.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Content You Create:</strong> We store artwork you generate using Dream AI, products you list in the marketplace, and posts you make in Channels.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Purchase Information:</strong> When you make a purchase, your payment is processed by Stripe. We store order details including product name, quantity, shipping address, and order status. We do not store your full card number.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Usage Data:</strong> We collect information about how you use Dreamscape, including pages visited, features used, and interactions with content. This is collected via Google Analytics 4.</p>
        <p><strong style={{ color: C.text }}>Reference Images:</strong> When you upload reference images to Dream AI, they are used solely to generate your requested artwork and are not stored permanently on our servers.</p>
      </Section>

      <Section title="2. How We Use Your Information">
        <p style={{ marginBottom: 8 }}>We use the information we collect to:</p>
        <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Provide, maintain, and improve the Dreamscape platform</li>
          <li>Process your orders and payments through Stripe and Printful</li>
          <li>Send order confirmations and shipping updates</li>
          <li>Calculate and process creator earnings and payouts</li>
          <li>Personalize your experience and show relevant content</li>
          <li>Detect and prevent fraud and abuse</li>
          <li>Comply with legal obligations</li>
          <li>Communicate with you about your account or our services</li>
        </ul>
      </Section>

      <Section title="3. Information We Share">
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Printful:</strong> When you purchase a product, we share your shipping name and address with Printful to fulfill your order.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Stripe:</strong> Payment processing is handled by Stripe. Your payment information is subject to Stripe's Privacy Policy.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Supabase:</strong> We use Supabase to store your account data and content securely.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Google Analytics:</strong> We use Google Analytics 4 to understand how users interact with Dreamscape. This data is anonymized and aggregated.</p>
        <p>We do not sell your personal information to third parties.</p>
      </Section>

      <Section title="4. Your Artist Profile">
        <p>Your username, display name, bio, profile picture, banner image, artist statement, style tags, and publicly posted artwork are visible to all Dreamscape users and the general public at your profile URL (trydreamscape.com/u/username). You can update or remove this information at any time from your profile settings.</p>
      </Section>

      <Section title="5. Data Retention">
        <p>We retain your account information for as long as your account is active. You may delete your account at any time by contacting us at privacy@trydreamscape.com. Upon deletion, your personal information will be removed within 30 days, except where we are required to retain it for legal or financial compliance purposes.</p>
      </Section>

      <Section title="6. Security">
        <p>We use industry-standard security measures to protect your information, including encrypted connections (HTTPS), secure authentication via Supabase, and row-level security on our database. However, no method of transmission over the internet is 100% secure.</p>
      </Section>

      <Section title="7. Children's Privacy">
        <p>Dreamscape is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately.</p>
      </Section>

      <Section title="8. Your Rights">
        <p style={{ marginBottom: 8 }}>Depending on your location, you may have the right to:</p>
        <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Access the personal information we hold about you</li>
          <li>Correct inaccurate information</li>
          <li>Request deletion of your information</li>
          <li>Object to or restrict processing of your information</li>
          <li>Data portability</li>
        </ul>
        <p style={{ marginTop: 12 }}>To exercise these rights, contact us at privacy@trydreamscape.com.</p>
      </Section>

      <Section title="9. Cookies">
        <p>Dreamscape uses cookies and similar technologies to maintain your session, remember your preferences, and analyze usage through Google Analytics. You can control cookies through your browser settings.</p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on Dreamscape or sending you an email. Your continued use of Dreamscape after changes take effect constitutes your acceptance of the updated policy.</p>
      </Section>

      <Section title="11. Contact Us">
        <p>If you have questions about this Privacy Policy or how we handle your information, please contact us at:</p>
        <div style={{ marginTop: 16, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', fontSize: 14 }}>
          <div style={{ color: C.text, fontWeight: 600, marginBottom: 4 }}>Dreamscape</div>
          <div><a href="mailto:privacy@trydreamscape.com" style={{ color: C.accent, textDecoration: 'none' }}>privacy@trydreamscape.com</a></div>
          <div style={{ marginTop: 4 }}>Bothell, WA, United States</div>
          <div style={{ marginTop: 4 }}><a href="https://trydreamscape.com" style={{ color: C.accent, textDecoration: 'none' }}>trydreamscape.com</a></div>
        </div>
      </Section>
    </div>
  )
}
