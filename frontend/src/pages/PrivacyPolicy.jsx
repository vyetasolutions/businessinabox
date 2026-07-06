import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import Footer from '../components/Footer';

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{title}</h2>
      <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-midnight-950 flex flex-col">
      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-10 flex-1">
        <Link to="/signup" className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-600 dark:text-gold-400 mb-8">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <BrandMark size={40} rounded="rounded-xl" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Privacy Policy</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Vyeta Business Hub · Vyeta Digital Solutions</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-7">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            This policy explains how Vyeta Digital Solutions ("Vyeta", "we", "us") collects, uses, and protects information
            through the Vyeta Business Hub platform ("the Platform"). It applies to businesses who register on the Platform
            ("Businesses"), their staff ("Managers" and "Employees"), and the customers of those Businesses whose details are
            recorded through the Platform ("End Customers").
          </p>

          <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-xl p-4">
            This policy is written in plain language to be genuinely useful, not just legally decorative — but it has not
            been reviewed by a lawyer. If you are relying on this for formal compliance purposes, have it reviewed before
            treating it as final.
          </div>

          <Section title="1. Who we are">
            <p>
              Vyeta Digital Solutions is a registered technology business operating in Lusaka, Zambia, providing IT
              infrastructure, business automation, and digital platform services. For the Vyeta Business Hub platform, Vyeta
              acts as the "data controller" for account and platform-level information, and as a "data processor" on behalf
              of each Business for the End Customer data that Business chooses to record (names, phone numbers, addresses
              entered when generating a document).
            </p>
            <p>
              Contact us about privacy matters at{' '}
              <a href="mailto:vyeta.solutions@outlook.com" className="font-semibold text-gold-600 dark:text-gold-400">
                vyeta.solutions@outlook.com
              </a>{' '}
              or{' '}
              <a href="mailto:vyeta.tech@gmail.com" className="font-semibold text-gold-600 dark:text-gold-400">
                vyeta.tech@gmail.com
              </a>
              .
            </p>
          </Section>

          <Section title="2. What we collect">
            <p><span className="font-semibold text-slate-800 dark:text-slate-200">From Businesses and their staff:</span> business name, phone number, address, tax identification (TPIN) and banking details entered into Business Profile settings; full name and email address for each Manager and Employee account; role and activity within the Platform (e.g. documents created, stock changes).</p>
            <p><span className="font-semibold text-slate-800 dark:text-slate-200">From End Customers, entered by a Business:</span> name, phone number, and address, only as needed to generate an Invoice, Quotation, Receipt, or Delivery Note. We do not independently collect End Customer data — it is entered by the Business using the Platform, and the Business is responsible for having a lawful basis to do so (e.g. it's their own customer, completing a transaction).</p>
            <p><span className="font-semibold text-slate-800 dark:text-slate-200">We do not collect:</span> payment card numbers (the Platform does not currently process payments), national ID numbers, or any special category data (health, biometric, religious, political information) as part of normal use.</p>
          </Section>

          <Section title="3. Why we process this data">
            <p>To provide the core functionality a Business signs up for: generating business documents, tracking stock, managing staff access, and giving each Business a working dashboard of their own activity. We also use account information to review new Business signups before granting full access, and to respond if a Business or individual contacts us for support.</p>
          </Section>

          <Section title="4. Where data is stored">
            <p>
              Platform data is hosted on Supabase, a third-party infrastructure provider, in a European hosting region. This
              means data may be processed outside Zambia. We choose infrastructure providers who maintain independently
              audited security practices, and access to the underlying database is restricted to Vyeta and protected by
              database-level security rules that keep each Business's data isolated from every other Business.
            </p>
          </Section>

          <Section title="5. How long we keep it">
            <p>
              We retain account and document data for as long as a Business's account remains active, plus a reasonable
              period afterward in case of disputes or legal obligations (for example, tax-related record-keeping
              expectations). If a Business closes its account, it can request deletion of its data as described below.
            </p>
          </Section>

          <Section title="6. Your rights">
            <p>
              Consistent with Zambia's Data Protection Act, 2021, individuals whose personal data we hold can request: a copy
              of the data we hold about them, correction of inaccurate data, or deletion of their data (subject to any
              legitimate business or legal reason to retain it, such as financial record-keeping). Businesses are
              responsible for handling these requests from their own End Customers in the first instance, since Vyeta does
              not have a direct relationship with them; Vyeta will assist a Business in fulfilling such a request on the
              underlying Platform data where needed.
            </p>
            <p>
              To make a request directly to Vyeta (for your own Manager/Employee account data), email us at the addresses
              above.
            </p>
          </Section>

          <Section title="7. Sharing with third parties">
            <p>
              We use Supabase for database, authentication, and file storage, and Render for application hosting — both
              process data strictly to provide their infrastructure service to us, not for their own purposes. We do not
              sell personal data, and do not share it with advertisers. If WhatsApp message delivery via Twilio is enabled
              in the future, a customer's phone number and the document link would be shared with Twilio solely to deliver
              that message.
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              Access to each Business's data is enforced at the database level (Row-Level Security), meaning even a
              technical fault in the app cannot expose one Business's data to another. Administrative credentials with
              broader access are held only by Vyeta and never exposed in the browser application.
            </p>
          </Section>

          <Section title="9. Children">
            <p>The Platform is intended for business use by adults. We do not knowingly collect data belonging to children through normal use of the Platform.</p>
          </Section>

          <Section title="10. Changes to this policy">
            <p>We may update this policy as the Platform evolves. Material changes will be reflected by updating the date at the top of this page.</p>
          </Section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
