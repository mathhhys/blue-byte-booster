import { Link } from 'react-router-dom';

const Security = () => {
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
          <h1 className="text-3xl font-bold mb-6">Security Page</h1>
          <p className="text-muted-foreground mb-4">
            <strong>Security Page — Softcodes</strong>
          </p>
          <p className="text-muted-foreground mb-6">
            Last updated: November 16, 2025
          </p>

          <p className="mb-6">
            Softcodes is built with a security-first architecture to protect your code, data, and workflows. We apply industry-standard practices aligned with modern SaaS and AI-platform security requirements.
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Infrastructure Security</h2>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Hosted on secure, reputable cloud providers</li>
              <li>Data stored in GDPR-compliant regions</li>
              <li>Strict firewalling & isolated environments</li>
              <li>Regular security audits and testing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Data Protection</h2>

            <h3 className="text-xl font-semibold mb-2">Encryption</h3>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Data in transit: Encrypted with HTTPS/TLS 1.2+</li>
              <li>Data at rest: Encrypted with strong AES standards</li>
            </ul>

            <h3 className="text-xl font-semibold mb-2">Access Controls</h3>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Role-based access (RBAC)</li>
              <li>Strict internal access limitations</li>
              <li>Multi-factor authentication (MFA) used internally</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Handling of Code & AI Inputs</h2>
            <p className="mb-4">
              Softcodes is designed to protect developer code:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Code is processed only to generate AI output</li>
              <li>No code is used to train public models unless explicitly opted in</li>
              <li>No unauthorized human access to user code</li>
              <li>Processing is transient unless explicitly saved by the user</li>
            </ul>
            <p className="mb-4">
              Your code is never shared, never resold, and never repurposed.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Monitoring & Incident Response</h2>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Continuous monitoring of systems</li>
              <li>Automated anomaly and intrusion detection</li>
              <li>24/7 alerting on critical infrastructure</li>
              <li>Established incident response procedures</li>
            </ul>
            <p className="mb-4">
              If a security incident affects your data, you will be notified promptly, in compliance with GDPR.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Reliability & Redundancy</h2>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>High-availability infrastructure</li>
              <li>Automatic failover mechanisms</li>
              <li>Regular backups for essential account data</li>
              <li>Distributed architecture for stability</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. User Security Responsibilities</h2>
            <p className="mb-4">
              To maximize protection:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Keep your password secure</li>
              <li>Enable MFA (when available)</li>
              <li>Review AI-generated code before execution</li>
              <li>Protect your local environment and IDE</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Compliance</h2>
            <p className="mb-4">
              Softcodes aligns with:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>GDPR</li>
              <li>Industry best practices for SaaS</li>
              <li>Secure coding standards</li>
            </ul>
            <p className="mb-4">
              Upcoming certifications (optional):
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>SOC 2 Type I → planned</li>
              <li>SOC 2 Type II → planned</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Contact for Security Issues</h2>
            <p className="mb-4">
              If you believe you’ve found a security vulnerability or risk:
              <br />
              mathys@softcodes.io
              <br />
              Subject: Security Concern — Softcodes
            </p>
            <p className="mb-4">
              We respond promptly to all security-related messages.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
};

export default Security;