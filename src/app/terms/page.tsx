import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-slate dark:prose-invert">
      <h1>Terms of Service</h1>
      <p className="text-sm text-gray-500">Last updated: {new Date().getFullYear()}</p>

      <h2>1. Acceptance</h2>
      <p>
        By using SalesBot AI, you agree to these Terms of Service and our Privacy Policy.
        If you do not agree, do not use the service.
      </p>

      <h2>2. Service Description</h2>
      <p>
        SalesBot AI provides an AI-powered sales agent that automatically responds to Facebook
        Messenger messages on your behalf. The service requires connecting your Facebook Page
        via OAuth.
      </p>

      <h2>3. Your Responsibilities</h2>
      <ul>
        <li>You must comply with Facebook&apos;s Platform Terms and Messenger Platform Policy</li>
        <li>You are responsible for the accuracy of business information you provide to the AI</li>
        <li>You must not use the service to send spam, misleading, or illegal content</li>
        <li>You must have the legal right to manage the Facebook Pages you connect</li>
      </ul>

      <h2>4. AI Limitations</h2>
      <p>
        The AI agent may occasionally produce inaccurate responses. You are responsible for
        monitoring conversations and taking over when necessary. SalesBot AI is not liable for
        any business outcomes resulting from AI-generated responses.
      </p>

      <h2>5. Subscription & Billing</h2>
      <p>
        Paid plans are billed monthly via Stripe. You may cancel at any time. Refunds are
        provided at our discretion for unused periods.
      </p>

      <h2>6. Termination</h2>
      <p>
        We reserve the right to suspend or terminate accounts that violate these terms or
        Facebook&apos;s Platform Policies.
      </p>

      <h2>7. Contact</h2>
      <p>
        For questions, contact us at{" "}
        <a href="mailto:support@salesbot.ai">support@salesbot.ai</a>.
      </p>
    </div>
  );
}
