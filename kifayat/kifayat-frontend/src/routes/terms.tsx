import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/landing/LegalPage";
import { SEO } from "@/components/seo/SEO";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <>
      <SEO
        title="Terms & Conditions"
        description="Kifayat's Terms & Conditions governing the use of our store, placing orders, payments, accounts, returns and dispute resolution in Pakistan."
        path="/terms"
        keywords="Kifayat terms and conditions, online shopping terms Pakistan, e-commerce terms"
      />
    <LegalPage
      title="Terms & Conditions"
      subtitle="Please read these terms carefully before placing an order."
      effectiveDate="1 July 2026"
      related={[
        { label: "Privacy Policy", to: "/privacy" },
        { label: "Return & Refund Policy", to: "/return-policy" },
        { label: "Shipping Policy", to: "/shipping-policy" },
      ]}
      sections={[
        {
          heading: "Acceptance of Terms",
          body: "By accessing kifayat.co, browsing products, creating an account, or placing an order, you unconditionally accept these Terms & Conditions and all policies referenced herein. If you do not agree, you must discontinue use of the website immediately. These terms constitute a legally binding agreement between you and Kifayat.",
        },
        {
          heading: "Eligibility & Account Registration",
          body: [
            "You must be at least 18 years old, or have the consent of a parent or legal guardian, to place orders on Kifayat.",
            "Each person may maintain only one account. Creating multiple accounts to circumvent bans, restrictions, or promotional limits is prohibited.",
            "You are responsible for the accuracy of all information provided during registration and checkout. Kifayat accepts no liability for failed deliveries or disputes arising from incorrect information.",
            "You are fully responsible for all activity that occurs under your account and must keep your login credentials confidential.",
            "Kifayat reserves the right to suspend or permanently terminate any account at its sole discretion, without notice, if these terms are violated.",
          ],
        },
        {
          heading: "Orders, Pricing & Payment",
          callout: "Placing an order constitutes a binding offer to purchase. Orders are only confirmed once you receive a written confirmation email from Kifayat.",
          body: [
            "All prices are displayed in Pakistani Rupees (PKR) and include applicable taxes unless stated otherwise.",
            "Product availability is not guaranteed. If an item becomes unavailable after your order is confirmed, we will notify you and issue a full refund.",
            "Kifayat reserves the right to cancel any order that shows signs of pricing errors, technical glitches, or suspected fraudulent activity — without any obligation beyond refunding the charged amount.",
            "Cash on Delivery (COD) orders that are refused at the door, returned undelivered, or abandoned after dispatch are subject to a non-refundable handling fee covering logistics costs.",
            "Repeated COD refusals or non-collection may result in account suspension and restriction to prepaid payment methods only.",
            "By providing payment details, you represent and warrant that you are authorised to use that payment method and that all information is accurate and truthful.",
          ],
        },
        {
          heading: "Fraud, Scams & Abuse Prevention",
          callout: "Kifayat operates a zero-tolerance policy on fraud. Confirmed fraudulent activity will be reported to the relevant law enforcement authorities.",
          body: [
            "Any attempt to use stolen, cloned, or unauthorised payment credentials is a criminal offence under Pakistani law and will be reported to FIA Cybercrime Wing.",
            "Placing orders using false identities, fake addresses, or fictitious contact details for the purpose of obtaining goods without payment constitutes fraud.",
            "Initiating a chargeback or payment dispute without first contacting Kifayat support and allowing a resolution period of at least 7 business days is considered bad-faith conduct. Kifayat reserves the right to provide all transaction records, IP logs, device fingerprints, and delivery evidence to the issuing bank and, where applicable, to law enforcement.",
            "Attempting to manipulate, reverse-engineer, or exploit Kifayat's pricing, promotional codes, or referral system for unauthorised gain is prohibited.",
            "Any account found to be involved in fraudulent activity will be permanently banned and its details shared with partner anti-fraud networks.",
          ],
        },
        {
          heading: "Intellectual Property",
          body: [
            "All content on Kifayat — including but not limited to the brand name, logo, product images, copy, UI design, and code — is the exclusive property of Kifayat and protected under applicable Pakistani and international intellectual property law.",
            "You may not copy, reproduce, scrape, redistribute, or commercially exploit any content from this website without prior written permission.",
            "Product images supplied by vendors remain the property of their respective rights holders.",
          ],
        },
        {
          heading: "Prohibited Conduct",
          body: [
            "Using the platform to transmit spam, malware, or any harmful code.",
            "Attempting to gain unauthorised access to any part of the website, backend systems, or other users' accounts.",
            "Posting false, defamatory, or misleading reviews or comments.",
            "Using automated bots, scrapers, or scripts to interact with the website.",
            "Reselling products purchased on Kifayat on third-party platforms without prior written consent.",
            "Harassing, threatening, or abusing Kifayat staff or other customers.",
            "Engaging in any conduct that disrupts, overloads, or impairs the proper functioning of the website.",
          ],
        },
        {
          heading: "Returns, Refunds & Disputes",
          body: "Returns and refunds are governed exclusively by our Return & Refund Policy. In the event of a dispute regarding an order, customers must contact contact@kifayat.co and allow up to 7 business days for resolution before escalating to any third party, payment provider, or regulatory body. Kifayat's decision on returns and refunds, made in accordance with its published policy, is final.",
        },
        {
          heading: "Limitation of Liability",
          body: [
            "To the maximum extent permitted by applicable law, Kifayat's total liability for any claim arising from your use of the website or any order shall not exceed the value of the specific order in dispute.",
            "Kifayat is not liable for indirect, incidental, special, consequential, or punitive damages, including loss of profit, data, or goodwill.",
            "Kifayat does not guarantee uninterrupted or error-free operation of the website and accepts no liability for losses caused by downtime, technical errors, or third-party service failures.",
            "Kifayat is not responsible for delays or failures caused by circumstances beyond our reasonable control, including natural disasters, strikes, courier failures, or government actions.",
          ],
        },
        {
          heading: "Indemnification",
          body: "You agree to indemnify, defend, and hold harmless Kifayat, its directors, employees, and agents from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising from: (a) your violation of these Terms; (b) your use or misuse of the website; (c) any false or misleading information you provided; or (d) your infringement of any third-party rights.",
        },
        {
          heading: "Governing Law & Dispute Resolution",
          body: "These Terms are governed by the laws of the Islamic Republic of Pakistan. Any dispute that cannot be resolved through our support process will be subject to the exclusive jurisdiction of the courts of Pakistan. You waive any right to a jury trial and agree not to participate in any class-action lawsuit against Kifayat.",
        },
        {
          heading: "Modifications",
          body: "Kifayat reserves the right to update these Terms at any time. Changes take effect immediately upon publication to the website. Continued use of the website after an update constitutes acceptance of the revised Terms. We encourage you to review this page periodically.",
        },
        {
          heading: "Contact",
          body: "For any legal enquiries, please email legal@kifayat.co. For general support, contact contact@kifayat.co. Response times are 1–2 business days.",
        },
      ]}
    />
    </>
  );
}
