const C = {
  bg: '#080B14', panel: '#0E1220', card: '#131826',
  border: '#1E2A40', accent: '#7C5CFC', teal: '#00D4AA',
  gold: '#F5C842', text: '#E8EAF0', muted: '#6B7494',
}

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 36 }}>
    <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: C.text, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>{title}</h2>
    <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.9 }}>{children}</div>
  </div>
)

export default function Terms() {
  return (
    <div style={{ padding: '60px 20px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 12, color: C.accent, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Legal</div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, color: C.text, marginBottom: 12 }}>Terms of Service</h1>
        <p style={{ color: C.muted, fontSize: 14 }}>Last updated: March 2026</p>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.accent}33`, borderRadius: 14, padding: '18px 24px', marginBottom: 40, fontSize: 14, color: C.text, lineHeight: 1.7 }}>
        Welcome to Dreamscape. By accessing or using our platform at trydreamscape.com or the Dreamscape mobile app, you agree to be bound by these Terms of Service. Please read them carefully before using our services.
      </div>

      <Section title="1. Acceptance of Terms">
        <p style={{ marginBottom: 12 }}>By creating an account, using Dream AI, purchasing products, or otherwise accessing Dreamscape, you agree to these Terms of Service and our Privacy Policy. If you do not agree, you may not use Dreamscape.</p>
        <p>We may update these terms at any time. Continued use of Dreamscape after changes constitutes acceptance of the updated terms. We will notify users of significant changes via email or in-app notice.</p>
      </Section>

      <Section title="2. Your Account">
        <p style={{ marginBottom: 12 }}>You must be at least 13 years old to use Dreamscape. If you are under 18, you must have parental or guardian consent.</p>
        <p style={{ marginBottom: 12 }}>You are responsible for maintaining the security of your account credentials and for all activity that occurs under your account. Notify us immediately at <a href="mailto:support@trydreamscape.com" style={{ color: C.accent }}>support@trydreamscape.com</a> if you suspect unauthorized access.</p>
        <p>You may not use a username that impersonates another person, is offensive, or violates any third-party rights.</p>
      </Section>

      <Section title="3. Dream AI and Content Generation">
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Your prompts and generated artwork:</strong> You retain ownership of the creative prompts you write. AI-generated artwork created on Dreamscape using your prompts is yours to use, sell, and distribute subject to these terms.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Prohibited content:</strong> You may not use Dream AI to generate content that is illegal, sexually explicit, hateful, violent, or that infringes on the rights of others. We reserve the right to remove any content that violates these guidelines and to suspend accounts that repeatedly do so.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Reference images:</strong> When uploading reference images, you confirm you have the right to use those images. Do not upload copyrighted images without permission from the rights holder.</p>
        <p><strong style={{ color: C.text }}>Generation limits:</strong> Monthly AI generation limits apply based on your subscription tier. Unused generations do not roll over.</p>
      </Section>

      <Section title="4. Selling on Dreamscape">
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Eligibility:</strong> You must have an active paid subscription (Starter, Pro, or Studio) to list products for sale on the Dreamscape Marketplace.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Commission:</strong> Dreamscape takes a commission on each sale based on your subscription tier: 30% on Free (if applicable), 25% on Starter, 20% on Pro, and 15% on Studio. Commission rates are subject to change with 30 days notice.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Payouts:</strong> Creator earnings are processed via Stripe Connect. You must complete Stripe's identity verification to receive payouts. Dreamscape is not responsible for delays caused by Stripe's verification process.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Fulfillment:</strong> All physical products are fulfilled by Printful. Production and shipping times are estimates and not guaranteed. Dreamscape is not liable for delays caused by Printful, shipping carriers, or circumstances beyond our control.</p>
        <p><strong style={{ color: C.text }}>Product listings:</strong> You are responsible for the accuracy of your product titles, descriptions, and images. Misleading listings may be removed and your account may be suspended.</p>
      </Section>

      <Section title="5. Purchases and Refunds">
        <p style={{ marginBottom: 12 }}>All purchases are processed securely by Stripe. By making a purchase you agree to Stripe's terms of service.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Print-on-demand products:</strong> Because all merchandise is custom-made on demand, we do not accept returns or offer refunds for buyer's remorse or incorrect sizing. Please review size charts carefully before purchasing.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Defective or damaged items:</strong> If your order arrives damaged or defective, contact us at <a href="mailto:support@trydreamscape.com" style={{ color: C.accent }}>support@trydreamscape.com</a> within 14 days of delivery with photos and we will arrange a replacement or refund.</p>
        <p><strong style={{ color: C.text }}>Lost orders:</strong> If your order is lost in transit, contact us within 30 days of the estimated delivery date and we will investigate with Printful and the carrier.</p>
      </Section>

      <Section title="6. Subscriptions">
        <p style={{ marginBottom: 12 }}>Paid subscriptions (Starter, Pro, Studio) are billed monthly and renew automatically until cancelled. You can manage or cancel your subscription at any time from your Profile page.</p>
        <p style={{ marginBottom: 12 }}>Cancellation takes effect at the end of your current billing period. You will retain access to your paid tier features until then. We do not offer prorated refunds for unused subscription time.</p>
        <p>We reserve the right to change subscription pricing with 30 days notice to existing subscribers.</p>
      </Section>

      <Section title="7. Intellectual Property">
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Dreamscape IP:</strong> The Dreamscape name, logo, platform design, and all original content created by Dreamscape are owned by Dreamscape and protected by copyright and trademark law.</p>
        <p style={{ marginBottom: 12 }}><strong style={{ color: C.text }}>Your content:</strong> You retain ownership of original content you create and upload to Dreamscape. By posting content on Dreamscape, you grant us a non-exclusive, worldwide, royalty-free license to display, distribute, and promote your content on the platform.</p>
        <p>You may not copy, reproduce, or distribute any part of the Dreamscape platform without our written permission.</p>
      </Section>

      <Section title="8. Prohibited Conduct">
        <p style={{ marginBottom: 8 }}>You agree not to:</p>
        <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          <li>Use Dreamscape for any illegal purpose or in violation of any laws</li>
          <li>Harass, abuse, or harm other users</li>
          <li>Attempt to gain unauthorized access to any part of the platform</li>
          <li>Use automated tools to scrape, crawl, or extract data from Dreamscape</li>
          <li>Manipulate reviews, ratings, or metrics</li>
          <li>Sell or transfer your account to another person</li>
          <li>Use Dreamscape to distribute spam or malicious content</li>
          <li>Circumvent any security or access control features</li>
        </ul>
        <p>Violation of these rules may result in immediate account suspension or termination without refund.</p>
      </Section>

      <Section title="9. Disclaimers and Limitation of Liability">
        <p style={{ marginBottom: 12 }}>Dreamscape is provided "as is" without warranties of any kind. We do not guarantee that the platform will be error-free, uninterrupted, or that AI-generated content will meet your expectations.</p>
        <p style={{ marginBottom: 12 }}>To the fullest extent permitted by law, Dreamscape shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the platform, including but not limited to lost profits, data loss, or business interruption.</p>
        <p>Our total liability to you for any claim arising from your use of Dreamscape shall not exceed the amount you paid to Dreamscape in the 12 months preceding the claim.</p>
      </Section>

      <Section title="10. Termination">
        <p style={{ marginBottom: 12 }}>We reserve the right to suspend or terminate your account at any time for violation of these terms, fraudulent activity, or any conduct we determine to be harmful to the platform or its users.</p>
        <p>You may delete your account at any time by contacting <a href="mailto:support@trydreamscape.com" style={{ color: C.accent }}>support@trydreamscape.com</a>. Upon deletion, your content will be removed from the platform within 30 days, except where we are required to retain it for legal or compliance purposes.</p>
      </Section>

      <Section title="11. Governing Law">
        <p>These Terms of Service are governed by the laws of the State of Washington, United States, without regard to its conflict of law provisions. Any disputes arising under these terms shall be resolved in the courts of King County, Washington.</p>
      </Section>

      <Section title="12. Contact">
        <p>If you have any questions about these Terms of Service, please contact us at <a href="mailto:support@trydreamscape.com" style={{ color: C.accent }}>support@trydreamscape.com</a> or write to us at Dreamscape, Bothell, WA, United States.</p>
      </Section>

      {/* Footer links */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
        <a href="/privacy" style={{ color: C.accent, textDecoration: 'none' }}>Privacy Policy</a>
        <a href="/contact" style={{ color: C.muted, textDecoration: 'none' }}>Contact Us</a>
        <a href="/blog" style={{ color: C.muted, textDecoration: 'none' }}>Blog</a>
        <a href="/sitemap" style={{ color: C.muted, textDecoration: 'none' }}>Sitemap</a>
      </div>
    </div>
  )
}
