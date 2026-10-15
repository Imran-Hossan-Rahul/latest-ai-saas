import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 prose prose-slate dark:prose-invert">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-gray-500">Last updated: {new Date().getFullYear()}</p>

      <h2>1. Data We Collect</h2>
      <p>
        SalesBot AI collects the following data to provide its service:
      </p>
      <ul>
        <li>Your name and email address (for account creation)</li>
        <li>Facebook Page access tokens (encrypted at rest using AES-256-GCM)</li>
        <li>Messenger conversation metadata (sender PSID, timestamps)</li>
        <li>Message content from your Facebook Page&apos;s Messenger inbox (used solely to generate AI replies)</li>
      </ul>

      <h2>2. How We Use Your Data</h2>
      <p>
        Data is used exclusively to operate the AI sales agent on your behalf. We do not sell,
        share, or use your data for advertising. Message content is processed by Anthropic&apos;s
        Claude API to generate replies and is not stored beyond what is necessary for conversation
        context.
      </p>

      <h2>3. Facebook Data</h2>
      <p>
        We access your Facebook Page data under the permissions you grant during the OAuth flow.
        This data is used only to respond to Messenger messages on your behalf. We comply with
        the{" "}
        <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer">
          Facebook Platform Terms
        </a>{" "}
        and{" "}
        <a href="https://www.facebook.com/policies/ads/" target="_blank" rel="noopener noreferrer">
          Messenger Platform Policy
        </a>.
      </p>

      <h2>4. Data Deletion</h2>
      <p>
        You can delete your account and all associated data at any time from your account settings.
        If you remove SalesBot AI from your Facebook App settings, we will receive a deletion
        callback and remove all associated data within 30 days.
      </p>

      <h2>5. Security</h2>
      <p>
        Facebook access tokens are encrypted at rest using AES-256-GCM. We use HTTPS for all
        data in transit. Webhook events are verified using HMAC-SHA256 signatures.
      </p>

      <h2>6. Contact</h2>
      <p>
        For privacy questions, contact us at{" "}
        <a href="mailto:privacy@salesbot.ai">privacy@salesbot.ai</a>.
      </p>
    </div>
  );
}
