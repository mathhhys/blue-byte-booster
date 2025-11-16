import { Link } from 'react-router-dom';

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link
            to="/"
            className="text-foreground hover:text-primary transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
        <article className="prose prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
          <p className="text-muted-foreground mb-4">
            <strong>Privacy Policy — Softcodes</strong>
          </p>
          <p className="text-muted-foreground mb-6">
            Last updated: November 16, 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="mb-4">
              Softcodes (“we”, “our”, “us”) is committed to protecting your privacy and ensuring the security of your personal data.
              This Privacy Policy explains how we collect, use, store, and protect your information when you use our AI coding copilot platform, website, and related services.
            </p>
            <p className="mb-4">
              Softcodes is operated by:
              <br />
              Softcodes — 17 rue Castanary, 75015 Paris, France
              <br />
              Contact: mathys@softcodes.io
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Data We Collect</h2>
            <p className="mb-4">
              We collect only the data necessary to provide and improve our services.
            </p>

            <h3 className="text-xl font-semibold mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Account information (name, email, password)</li>
              <li>Billing information (only through trusted payment providers)</li>
              <li>Code snippets, prompts, or files you submit for analysis</li>
              <li>Communication and support requests</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">2.2 Automatically Collected Data</h3>
            <p className="mb-4">
              To ensure performance, security, and analytics:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>IP address</li>
              <li>Device type & browser</li>
              <li>Usage logs (API calls, IDE extension activity)</li>
              <li>Performance metrics and error logs</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">2.3 Payment Information</h3>
            <p className="mb-4">
              Softcodes never stores full credit card information.
              Payments are processed securely via third-party PCI-compliant vendors (e.g., Stripe).
            </p>

            <h3 className="text-xl font-semibold mb-2">2.4 Cookies and Tracking Technologies</h3>
            <p className="mb-4">
              We use cookies to:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Improve user experience</li>
              <li>Measure website traffic</li>
              <li>Support advertising and analytics (Google Analytics, Google Ads, etc.)</li>
            </ul>
            <p className="mb-4">
              You can manage cookie preferences through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Data</h2>
            <p className="mb-4">
              We use your information to:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Provide and improve the Softcodes service</li>
              <li>Authenticate your account</li>
              <li>Process payments and manage subscriptions</li>
              <li>Analyze usage and improve features</li>
              <li>Detect, prevent, and mitigate security threats</li>
              <li>Offer customer support</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mb-4">
              We do not sell your personal data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Use of Code and AI Inputs</h2>

            <h3 className="text-xl font-semibold mb-2">4.1 Ownership</h3>
            <p className="mb-4">
              You retain 100% ownership of your code, prompts, and data.
            </p>

            <h3 className="text-xl font-semibold mb-2">4.2 Confidentiality</h3>
            <p className="mb-4">
              Softcodes will never:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Share your code with third parties outside essential subprocessors</li>
              <li>Use your private code to train public AI models unless you opt in</li>
              <li>Access your repositories without permission</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">4.3 Temporary Processing</h3>
            <p className="mb-4">
              AI inputs may be temporarily processed to generate results but are not used for unrelated purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Data Sharing</h2>
            <p className="mb-4">
              We only share information with:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Trusted service providers (hosting, analytics, payment, support)</li>
              <li>Legal authorities when required by law</li>
            </ul>
            <p className="mb-4">
              We do not share data with advertisers or unrelated third parties.
              All subprocessors comply with GDPR and industry security standards.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
            <p className="mb-4">
              We retain personal and usage data only for as long as necessary:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Account data: retained until account deletion</li>
              <li>Logs: limited retention for security and debugging</li>
              <li>Billing data: retained as required by tax legislation</li>
            </ul>
            <p className="mb-4">
              Users may request deletion at any time.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. International Data Transfers</h2>
            <p className="mb-4">
              If data is transferred outside the EU, we ensure:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>GDPR-compliant safeguards</li>
              <li>Standard Contractual Clauses (SCCs) where applicable</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Your Rights (GDPR)</h2>
            <p className="mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Access your data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Download/export your data</li>
              <li>Restrict or object to processing</li>
            </ul>
            <p className="mb-4">
              To request any of these, contact us at mathys@softcodes.io.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Security Measures</h2>
            <p className="mb-4">
              Softcodes implements strong protections (see Security Page below), including:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Encryption in transit (HTTPS/TLS 1.2+)</li>
              <li>Server hardening</li>
              <li>Access controls and authentication</li>
              <li>Continuous monitoring</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Changes to This Policy</h2>
            <p className="mb-4">
              We may update this Privacy Policy periodically.
              Major updates will be announced via email or website notice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Contact</h2>
            <p className="mb-4">
              For privacy or GDPR inquiries:
              <br />
              mathys@softcodes.io
              <br />
              Softcodes — 17 rue Castanary, 75015 Paris, France
            </p>
          </section>
        </article>
      </div>
    </div>
  );
};

export default Privacy;