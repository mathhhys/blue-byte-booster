import { Link } from 'react-router-dom';

const Terms = () => {
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
          <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
          <p className="text-muted-foreground mb-4">
            <strong>Terms of Service — Softcodes (AI Coding Copilot)</strong>
          </p>
          <p className="text-muted-foreground mb-6">
            Last updated: November 16, 2025
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="mb-4">
              Welcome to Softcodes (“Softcodes”, “we”, “our”, or “us”).
              Softcodes provides an AI-powered coding copilot through a software-as-a-service platform, including a web application, API, and integrations.
            </p>
            <p className="mb-4">
              These Terms of Service (“Terms”) govern your use of the Softcodes platform. By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, you must stop using the Service.
            </p>
            <p className="mb-4">
              Softcodes is operated by:
              <br />
              Softcodes
              <br />
              17 rue Castanary, 75015 Paris, France
              <br />
              Contact & Support: mathys@softcodes.io
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Eligibility</h2>
            <p className="mb-4">
              To use Softcodes, you must:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Be at least 18 years old (or the age of majority in your jurisdiction),</li>
              <li>Have the authority to bind your organization if using the Service on its behalf,</li>
              <li>Use the Service in compliance with all applicable local and international laws.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Accounts</h2>
            <p className="mb-4">
              When creating a Softcodes account, you agree to:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Provide accurate and complete information,</li>
              <li>Keep your login credentials secure,</li>
              <li>Be responsible for all usage linked to your account or API keys.</li>
            </ul>
            <p className="mb-4">
              Softcodes reserves the right to suspend or terminate accounts that violate these Terms or pose security or misuse risks.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Description of the Service</h2>
            <p className="mb-4">
              Softcodes provides:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>AI-assisted code generation, review, explanation, and refactoring,</li>
              <li>Code suggestions within IDEs and the Softcodes web interface,</li>
              <li>API-based automation and code analysis tools.</li>
            </ul>
            <p className="mb-4">
              We may update, improve, replace, or discontinue certain features at any time.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Acceptable Use</h2>
            <p className="mb-4">
              You agree not to:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Use Softcodes to build or train competing AI models,</li>
              <li>Submit or upload code you do not have the rights to use,</li>
              <li>Attempt to extract, reverse-engineer, or copy model weights, datasets, or internal systems,</li>
              <li>Generate malicious or harmful code (malware, exploits, vulnerabilities),</li>
              <li>Bypass security measures or abuse rate limits,</li>
              <li>Interfere with or disrupt the Service or its infrastructure.</li>
            </ul>
            <p className="mb-4">
              Softcodes may monitor usage strictly for security, compliance, and service quality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. User Content & Code Confidentiality</h2>
            <h3 className="text-xl font-semibold mb-2">6.1 Ownership</h3>
            <p className="mb-4">
              You retain full ownership of all content you provide (“User Content”), including code, text, prompts, and files.
            </p>

            <h3 className="text-xl font-semibold mb-2">6.2 License to Provide the Service</h3>
            <p className="mb-4">
              You grant Softcodes a limited, worldwide, nonexclusive license to:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Process, analyze, and store User Content,</li>
              <li>Generate “AI Output” using our models.</li>
            </ul>
            <p className="mb-4">
              This license is solely for the purpose of providing the Service.
              Softcodes does not use your private code to train public models unless you explicitly opt in.
            </p>

            <h3 className="text-xl font-semibold mb-2">6.3 Code Privacy</h3>
            <p className="mb-4">
              Softcodes will not:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Use your proprietary code for model training (without opt-in),</li>
              <li>Access your data or repositories outside the scope of the Service,</li>
              <li>Sell or share your User Content with third parties except verified subprocessors required for operations.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. AI Output</h2>
            <p className="mb-4">
              You may use the AI Output generated by Softcodes for any lawful business or personal purpose.
            </p>
            <p className="mb-4">
              However, you understand and agree that:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>AI Output may be inaccurate, incomplete, or contain errors,</li>
              <li>You are responsible for reviewing and validating generated code before using it,</li>
              <li>Softcodes does not guarantee that AI Output is free from bugs, vulnerabilities, or legal issues.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Fees, Billing & Subscriptions</h2>
            <p className="mb-4">
              Softcodes may offer paid subscription plans.
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Fees are billed monthly or annually, depending on your chosen plan,</li>
              <li>Subscriptions renew automatically unless canceled before the renewal date,</li>
              <li>Price changes will be announced in advance,</li>
              <li>Taxes may apply depending on your jurisdiction.</li>
            </ul>
            <p className="mb-4">
              Failure to pay may result in suspension or termination of your account.
              Refunds are handled according to our Refund Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Intellectual Property</h2>
            <p className="mb-4">
              All intellectual property related to Softcodes—including models, software, documentation, branding, and design—is owned by Softcodes, 17 rue Castanary, 75015 Paris.
            </p>
            <p className="mb-4">
              You receive a limited, nontransferable, revocable license to use the Service as described in these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Third-Party Services</h2>
            <p className="mb-4">
              Softcodes may integrate with third-party platforms (e.g., GitHub, GitLab, IDE extensions).
              Softcodes is not responsible for:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>The availability or functionality of third-party APIs,</li>
              <li>Their content, terms, or practices,</li>
              <li>Downtime or data losses caused by third-party systems.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Security</h2>
            <p className="mb-4">
              Softcodes implements industry-standard security practices to protect your data.
              However, no online service can guarantee absolute security.
            </p>
            <p className="mb-4">
              You are responsible for:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Securing your environment,</li>
              <li>Keeping your credentials confidential,</li>
              <li>Evaluating generated code before running or deploying it.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Termination</h2>
            <p className="mb-4">
              Softcodes may suspend or terminate your account:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>If you violate these Terms,</li>
              <li>If required by law,</li>
              <li>For non-payment,</li>
              <li>For security or misuse concerns.</li>
            </ul>
            <p className="mb-4">
              You may terminate your account at any time.
              Upon termination, your access to the Service and stored data may be limited or removed.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. Disclaimers</h2>
            <p className="mb-4">
              Softcodes is provided “as is” and “as available” without warranties of any kind.
            </p>
            <p className="mb-4">
              We do not guarantee:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Accuracy, completeness, or reliability of AI Output,</li>
              <li>Compatibility with all environments,</li>
              <li>Uninterrupted availability of the Service.</li>
            </ul>
            <p className="mb-4">
              You use the Service at your own risk.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">14. Limitation of Liability</h2>
            <p className="mb-4">
              To the maximum extent permitted by law, Softcodes is not liable for:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Indirect, incidental, or consequential damages,</li>
              <li>Loss of profits, revenue, or business opportunities,</li>
              <li>Errors, bugs, or vulnerabilities in AI-generated code,</li>
              <li>Security issues caused by your environment or third-party tools.</li>
            </ul>
            <p className="mb-4">
              Softcodes’ total liability is limited to the amount you paid in the previous 3 months.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">15. Governing Law & Dispute Resolution</h2>
            <p className="mb-4">
              These Terms are governed by the laws of France.
              Any dispute will be handled by the competent courts of Paris, France.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">16. Changes to These Terms</h2>
            <p className="mb-4">
              Softcodes may update these Terms to improve clarity, transparency, compliance, or functionality.
              We will notify you of significant changes through:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Email,</li>
              <li>Website notice, or</li>
              <li>In-app notification.</li>
            </ul>
            <p className="mb-4">
              Continued use of Softcodes constitutes acceptance of updated Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">17. Contact</h2>
            <p className="mb-4">
              If you have any questions or concerns, you may contact us at:
            </p>
            <p className="mb-4">
              Softcodes
              <br />
              17 rue Castanary, 75015 Paris, France
              <br />
              Contact & Support: mathys@softcodes.io
            </p>
          </section>
        </article>
      </div>
    </div>
  );
};

export default Terms;