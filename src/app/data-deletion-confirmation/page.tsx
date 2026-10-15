import type { Metadata } from "next";

export const metadata: Metadata = { title: "Data Deletion Confirmed" };

export default function DataDeletionConfirmationPage() {
  return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold">Data Deletion Confirmed</h1>
      <p className="text-gray-600">
        Your request has been received. All data associated with your Facebook account
        has been scheduled for deletion and will be removed within 30 days.
      </p>
      <p className="text-sm text-gray-400">
        If you have questions, contact{" "}
        <a href="mailto:privacy@salesbot.ai" className="underline">
          privacy@salesbot.ai
        </a>
      </p>
    </div>
  );
}
