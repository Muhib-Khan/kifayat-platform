import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/landing/LegalPage";
import { SEO } from "@/components/seo/SEO";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <>
      <SEO
        title="Privacy Policy"
        description="Learn how Kifayat collects, uses, and protects your personal data when you shop online in Pakistan. Full transparency on data collection, cookies, and your rights."
        path="/privacy"
        noindex={false}
        keywords="Kifayat privacy policy, data protection Pakistan, online shopping privacy"
      />
    <LegalPage
      title="Privacy Policy"
      subtitle="We respect your privacy. Here is exactly what we collect, why, and how we protect it."
      effectiveDate="1 July 2026"
      related={[
        { label: "Terms & Conditions", to: "/terms" },
        { label: "Return & Refund Policy", to: "/return-policy" },
      ]}
      sections={[
        {
          heading: "Who We Are",
          body: "Kifayat is an e-commerce platform operating in Pakistan at kifayat.co. References to Kifayat, we, us, or our in this policy refer to the entity operating this platform. Your use of our services constitutes acceptance of this Privacy Policy.",
        },
        {
          heading: "Information We Collect",
          body: [
            "Account information: name, email address, phone number, and password stored in encrypted form.",
            "Order and transaction data: delivery addresses, order history, payment method type (we do not store full card numbers), and COD preferences.",
            "Device and technical data: IP address, browser type, operating system, and device identifiers collected automatically when you visit our website.",
            "Usage data: pages visited, products viewed, search queries, cart activity, and session duration — used solely to improve your experience.",
            "Communications: messages sent to our support team, reviews submitted, and any other correspondence.",
            "Verification data: in cases of suspected fraud, we may request identity verification documents which are stored only for the duration of the review.",
          ],
        },
        {
          heading: "How We Use Your Information",
          body: [
            "To process, fulfil, and deliver your orders.",
            "To send order confirmations, shipping updates, and delivery notifications via SMS and email.",
            "To verify your identity and prevent fraud, account takeovers, and payment abuse.",
            "To provide customer support and resolve disputes.",
            "To improve our website, personalise product recommendations, and conduct internal analytics.",
            "To send promotional emails and offers — only if you have opted in. You may unsubscribe at any time.",
            "To comply with legal obligations, court orders, and requests from Pakistani law enforcement authorities.",
          ],
        },
        {
          heading: "Legal Basis for Processing",
          body: [
            "Contract performance: processing is necessary to fulfil your orders and provide our services.",
            "Legitimate interests: fraud prevention, security monitoring, and improving the platform.",
            "Legal obligation: compliance with applicable Pakistani law, including tax reporting and law enforcement requests.",
            "Consent: for marketing communications. You may withdraw consent at any time by clicking Unsubscribe in any email.",
          ],
        },
        {
          heading: "Sharing Your Data",
          callout: "We do not sell, rent, or trade your personal data to any third party for marketing purposes — ever.",
          body: [
            "Courier partners (e.g. TCS, Leopards, M&P): receive your name, phone number, and delivery address solely to complete your delivery.",
            "Payment processors: receive transaction amounts and masked card details to authorise payments. We do not store full card numbers.",
            "Cloud infrastructure providers: operate under strict data processing agreements.",
            "Google Firebase: used for authentication. Google's privacy policy applies to authentication data.",
            "Email delivery service: processes your email address to deliver transactional emails.",
            "Law enforcement or regulatory authorities: when required by valid legal process, court order, or to protect against imminent harm.",
          ],
        },
        {
          heading: "Cookies & Tracking",
          body: [
            "Session cookies: keep you logged in during your browsing session. Essential and cannot be disabled.",
            "Cart cookies: remember your cart contents across sessions.",
            "Analytics: we use basic, privacy-respecting analytics to understand traffic patterns. No individual profiling.",
            "We do not use third-party advertising cookies or cross-site tracking.",
            "You can disable non-essential cookies in your browser settings, though this may affect site functionality.",
          ],
        },
        {
          heading: "Data Retention",
          body: [
            "Account data is retained for as long as your account is active, plus 2 years for dispute resolution purposes.",
            "Order records are retained for 5 years to comply with tax and accounting obligations.",
            "Support communications are retained for 2 years.",
            "Fraud investigation records may be retained for up to 7 years.",
            "When data is no longer required, it is securely deleted or anonymised.",
          ],
        },
        {
          heading: "Data Security",
          body: [
            "All data is transmitted over HTTPS/TLS encryption.",
            "Passwords are hashed using industry-standard algorithms and never stored in plain text.",
            "Access to personal data is restricted to authorised Kifayat personnel on a need-to-know basis.",
            "We conduct regular security reviews of our systems.",
            "In the event of a data breach that materially affects your rights, we will notify affected users promptly.",
          ],
        },
        {
          heading: "Your Rights",
          body: [
            "Access: you may request a copy of the personal data we hold about you.",
            "Correction: you may request correction of inaccurate or incomplete data.",
            "Deletion: you may request deletion of your account and associated data, subject to our legal retention obligations.",
            "Portability: you may request your order and account data in a machine-readable format.",
            "Opt-out: you may opt out of marketing communications at any time via the unsubscribe link in any email.",
            "To exercise any of these rights, email privacy@kifayat.co with the subject line Data Request. We will respond within 30 days.",
          ],
        },
        {
          heading: "Children's Privacy",
          body: "Kifayat is not directed at children under the age of 13. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact privacy@kifayat.co and we will promptly delete it.",
        },
        {
          heading: "Changes to This Policy",
          body: "We may update this Privacy Policy from time to time. Material changes will be notified via email or a prominent notice on the website. Continued use of Kifayat after changes are published constitutes acceptance of the updated policy.",
        },
        {
          heading: "Contact & Complaints",
          body: "For privacy-related queries or concerns, contact us at privacy@kifayat.co. If you believe we have handled your data unlawfully, you have the right to file a complaint with the relevant Pakistani data protection authority.",
        },
      ]}
    />
    </>
  );
}
