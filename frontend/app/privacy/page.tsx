import type { Metadata } from "next";
import BackToApplication from "@/components/Layout/BackToApplication";

export const metadata: Metadata = {
  title: "Privacy Policy | OSM Road Closures",
  description: "Privacy information for the Temporary Road Closures service.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <article className="text-gray-700">
        <header className="mb-10 border-b border-gray-200 pb-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-700">
            Legal information
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-gray-950">
            Privacy Policy
          </h1>
          <dl className="mt-5 space-y-1 text-sm">
            <div>
              <dt className="inline font-semibold text-gray-900">
                Effective date:
              </dt>{" "}
              <dd className="inline">26th November 2026</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-gray-900">
                Last updated:
              </dt>{" "}
              <dd className="inline">26th November 2026</dd>
            </div>
          </dl>
        </header>

        <div className="space-y-10 leading-7">
          <section aria-labelledby="operator">
            <h2
              id="operator"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              1. Who is responsible?
            </h2>
            <p>
              The Temporary Road Closures service is operated by the{" "}
              <a
                href="https://sosm.ch/"
                className="text-blue-700 underline"
              >
                Swiss OpenStreetMap Association (SOSM)
              </a>
              , based in Switzerland.
            </p>
          </section>

          <section aria-labelledby="scope">
            <h2
              id="scope"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              2. Scope
            </h2>
            <p>
              This Privacy Policy explains how SOSM collects and processes
              personal data through:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>the Temporary Road Closures website;</li>
              <li>the closure reporting and management interfaces;</li>
              <li>the associated APIs; and</li>
              <li>the closure-aware routing functions.</li>
            </ul>
            <p className="mt-4">
              This Policy does not cover websites or services operated by third
              parties that may be linked from or used with this service. Those
              services have their own privacy notices.
            </p>
          </section>

          <section aria-labelledby="personal-data">
            <h2
              id="personal-data"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              3. Personal data processed
            </h2>

            <h3 className="mb-2 mt-5 text-xl font-semibold text-gray-900">
              3.1 Account and authentication data
            </h3>
            <p>If you register or sign in, we may process:</p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>your username and email address;</li>
              <li>your full name, if provided;</li>
              <li>
                a password hash, account identifier, role, and permissions;
              </li>
              <li>authentication tokens and session-related data;</li>
              <li>
                identifiers or profile information received from a third-party
                sign-in provider, if that sign-in option is enabled; and
              </li>
              <li>authentication and security events.</li>
            </ul>
            <p className="mt-4">
              We recommend using an OpenStreetMap account to access this service.
            </p>
            <p className="mt-4">
              We do not need to store your password in readable form.
            </p>

            <h3 className="mb-2 mt-5 text-xl font-semibold text-gray-900">
              3.2 Road closure reports
            </h3>
            <p>
              If you submit or manage a closure, we may process its road or
              location geometry, description, closure type and status,
              confidence level, start and end times, source or attribution
              information, submitting account or contributor identifier, and
              report creation or modification history.
            </p>
            <p className="mt-4">
              Closure information is intended to be shared publicly through the
              website and API. Do not include sensitive or unrelated personal
              information in a report.
            </p>

            <h3 className="mb-2 mt-5 text-xl font-semibold text-gray-900">
              3.3 Routing data
            </h3>
            <p>
              When you use closure-aware routing, we may process the route start
              and destination, selected transportation mode, calculated route
              geometry, routing requests and results, and the closure records
              considered during the calculation.
            </p>
            <p className="mt-4">
              Routing calculations are not intended to create an
              account-level route history. Technical logs may nevertheless
              temporarily contain routing-related network information.
            </p>

            <h3 className="mb-2 mt-5 text-xl font-semibold text-gray-900">
              3.4 Technical data
            </h3>
            <p>
              When you access the service, technical data may be processed,
              including your IP address, browser and device information,
              operating system, access date and time, requested URL, HTTP
              response status, referrer information, application or API error
              details, and security or abuse-prevention information.
            </p>
          </section>

          <section aria-labelledby="purposes">
            <h2
              id="purposes"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              4. Purposes and legal grounds
            </h2>
            <p>We process personal data to:</p>
            <ul className="mt-3 list-disc space-y-1 pl-6">
              <li>operate and secure the service;</li>
              <li>create and manage user accounts;</li>
              <li>
                allow authenticated users to submit, edit, or remove closure
                reports;
              </li>
              <li>display closures and provide access through the API;</li>
              <li>calculate routes and provide routing results;</li>
              <li>prevent abuse and unauthorised access;</li>
              <li>investigate security incidents;</li>
              <li>maintain backups and service availability;</li>
              <li>meet legal obligations; and</li>
              <li>improve the reliability and performance of the service.</li>
            </ul>
            <p className="mt-4">
              For users in Switzerland, processing is subject to applicable
              Swiss data protection law. Depending on the circumstances, it is
              necessary to provide a requested service, comply with a legal
              obligation, or pursue SOSM&apos;s legitimate interests in
              operating and securing a useful public service.
            </p>
            <p className="mt-4">
              Where European Union or European Economic Area data protection
              law applies, processing may be based on performing a service or
              agreement, complying with a legal obligation, your consent where
              obtained, or our legitimate interests in operating and securing
              the service.
            </p>
          </section>

          <section aria-labelledby="public-data">
            <h2
              id="public-data"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              5. Public visibility
            </h2>
            <p>
              Closure reports, including their location, timing, description,
              source, and, where enabled, contributor attribution, are intended
              to be public. Public closure data may be displayed on the website,
              queried through the API, reproduced or cached by external
              services, incorporated into OpenStreetMap or other datasets, or
              retained by users and organisations that obtain the data.
            </p>
            <p className="mt-4">
              Accounts and public contributor profiles may also be visible if
              the service exposes them. We cannot control later use or
              retention of data published through the public API. Please do not
              submit names, telephone numbers, email addresses, photographs, or
              other unnecessary personal information about individuals.
            </p>
          </section>

          <section aria-labelledby="cookies">
            <h2
              id="cookies"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              6. Cookies and local storage
            </h2>
            <p>
              The service may use strictly necessary cookies or browser local
              storage for authentication, session and security management,
              remembering interface settings, and maintaining a signed-in
              state. The service is not intended to use advertising or tracking
              cookies.
            </p>
            <p className="mt-4">
              If optional analytics or cookies are introduced, this Policy will
              be updated. Any optional processing that requires consent will
              be used only where applicable law requires consent. Clearing
              browser storage may remove your signed-in state and settings.
            </p>
          </section>

          <section aria-labelledby="third-parties">
            <h2
              id="third-parties"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              7. Third-party services
            </h2>

            <h3 className="mb-2 mt-5 text-xl font-semibold text-gray-900">
              7.1 Authentication providers
            </h3>
            <p>
              If you choose OpenStreetMap or an other third party sign-in, 
	      that provider processes
              authentication and may provide SOSM with profile information and
              identifiers, as described in the provider&apos;s own privacy
              notice. You can review or disconnect permissions through the
              provider&apos;s account settings.
            </p>

            <h3 className="mb-2 mt-5 text-xl font-semibold text-gray-900">
              7.2 Mapping and tile providers
            </h3>
            <p>
              The map interface may retrieve map tiles from OpenStreetMap or
              another tile provider. Your browser communicates directly with
              those providers, and your IP address may be recorded in their
              access logs.
            </p>

            <h3 className="mb-2 mt-5 text-xl font-semibold text-gray-900">
              7.3 Routing providers
            </h3>
            <p>
              Routing features may use an external routing service, such as
              Valhalla or a Valhalla-based provider. Route start, destination,
              transportation mode, and relevant closure data may be transmitted
              to the routing provider to calculate a result.
            </p>

            <h3 className="mb-2 mt-5 text-xl font-semibold text-gray-900">
              7.4 Hosting and infrastructure providers
            </h3>
            <p>
              The service is currently hosted in Germany. Depending on the
              system configuration, hosting, database, email, backup, logging,
              monitoring, and security providers may process personal data to
              provide their services. The service may move to Switzerland or
              another jurisdiction. This Policy will be updated if a change
              materially affects the information provided here.
            </p>
          </section>

          <section aria-labelledby="international-transfers">
            <h2
              id="international-transfers"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              8. International transfers
            </h2>
            <p>
              The service currently uses infrastructure in Germany and may also
              use providers located outside Switzerland or the European
              Economic Area. Where Swiss or European law requires safeguards
              for an international transfer, SOSM will use an appropriate
              legal mechanism, which may include an adequacy decision, standard
              contractual clauses, or another recognised safeguard.
            </p>
            <p className="mt-4">
              Additional legal rules may apply to access to or disclosure of
              personal data by public authorities.
            </p>
          </section>

          <section aria-labelledby="service-providers">
            <h2
              id="service-providers"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              9. Service providers
            </h2>
            <p>
              We may share personal data with hosting, database, security,
              monitoring, backup, email, authentication, mapping, and routing
              providers to the extent needed to provide and secure the service.
              We require appropriate confidentiality and security commitments
              where required by law.
            </p>
            <p className="mt-4">
              We do not sell personal data or use it for targeted advertising.
            </p>
          </section>

          <section aria-labelledby="automated-decisions">
            <h2
              id="automated-decisions"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              10. Automated decisions
            </h2>
            <p>
              The service does not use personal data to make decisions that
              produce legal or similarly significant effects on you. Automated
              systems may perform routing calculations, spam or abuse
              detection, or closure-status calculations. These systems do not
              determine an individual&apos;s legal rights or eligibility.
            </p>
          </section>

          <section aria-labelledby="retention">
            <h2
              id="retention"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              11. Retention
            </h2>
            <p>
              We retain personal data only for as long as needed for the
              purposes described in this Policy, subject to legal obligations
              and the operational needs of the service.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Account data:</strong> retained while the account is
                active or needed to provide the service. After account
                deletion, data is deleted or anonymised unless legal, security,
                or dispute requirements apply.
              </li>
              <li>
                <strong>Authentication and security logs:</strong> retained
                for a limited period appropriate to security and incident
                investigation.
              </li>
              <li>
                <strong>Technical logs:</strong> retained for a limited
                operational and security period.
              </li>
              <li>
                <strong>Closure reports:</strong> retained as public
                operational information while active and may be retained as
                historical or aggregate records after expiry.
              </li>
              <li>
                <strong>Routing requests:</strong> retained only as long as
                needed for current calculations, debugging, abuse prevention,
                or a documented operational period.
              </li>
              <li>
                <strong>Backups:</strong> may retain deleted or changed data
                for a limited backup cycle.
              </li>
            </ul>
            <p className="mt-4">
              Actual retention periods may differ where required by law or
              necessary for a security investigation, dispute, or backup
              operation.
            </p>
          </section>

          <section aria-labelledby="security">
            <h2
              id="security"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              12. Security
            </h2>
            <p>
              We use appropriate technical and organisational measures to
              protect personal data. These may include encrypted HTTPS
              connections, password hashing, access controls and role-based
              permissions, authentication-token protections, network and
              application security controls, input validation, logging and
              monitoring, and database backups.
            </p>
            <p className="mt-4">
              No system can guarantee complete security. Use a strong, unique
              password and notify us promptly if you suspect unauthorised
              activity on your account.
            </p>
          </section>

          <section aria-labelledby="rights">
            <h2
              id="rights"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              13. Your rights
            </h2>

            <h3 className="mb-2 mt-5 text-xl font-semibold text-gray-900">
              13.1 Users in Switzerland
            </h3>
            <p>
              Subject to the Swiss Federal Act on Data Protection and
              applicable exceptions, you may request information about whether
              we process personal data concerning you and ask for access,
              correction, or deletion of that data. You may also have rights to
              request information about disclosures or to object to certain
              processing.
            </p>

            <h3 className="mb-2 mt-5 text-xl font-semibold text-gray-900">
              13.2 Users in the EU or EEA
            </h3>
            <p>
              Where the General Data Protection Regulation applies, you may
              have rights to access, correct, erase, or obtain a copy of your
              personal data; restrict or object to certain processing; request
              portability; and withdraw consent where processing is based on
              consent. You may also lodge a complaint with a competent data
              protection supervisory authority.
            </p>

            <h3 className="mb-2 mt-5 text-xl font-semibold text-gray-900">
              13.3 Making a request
            </h3>
            <p>
              Send privacy requests to{" "}
              <a
                href="mailto:info@sosm.ch"
                className="text-blue-700 underline"
              >
                info@sosm.ch
              </a>
              . We may need to verify your identity before responding. We may
              retain some records where required for legal, security, or
              accountability purposes.
            </p>
            <p className="mt-4">
              Public closure reports may remain available through copies held
              by the public API, search engines, archived backups, or third
              parties, even after a change or deletion in the service.
            </p>
          </section>

          <section aria-labelledby="children">
            <h2
              id="children"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              14. Children
            </h2>
            <p>
              The service is not directed at children under 16, and we do not
              knowingly collect children&apos;s personal data. If you believe a
              child has provided personal data, contact{" "}
              <a
                href="mailto:info@sosm.ch"
                className="text-blue-700 underline"
              >
                info@sosm.ch
              </a>{" "}
              so we can assess the request and remove the data where
              appropriate.
            </p>
          </section>

          <section aria-labelledby="changes">
            <h2
              id="changes"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              15. Changes to this Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. The latest
              version will be published here with a revised effective date.
              Material changes will be communicated through the website or
              service where appropriate.
            </p>
          </section>

          <section aria-labelledby="contact">
            <h2
              id="contact"
              className="mb-3 text-2xl font-semibold text-gray-950"
            >
              16. Contact
            </h2>
            <address className="not-italic">
              Swiss OpenStreetMap Association (SOSM)
              <br />
              Heitersbergstrasse 1, 8962 Bergdietikon
              <br />
              Switzerland
              <br />
              Email:{" "}
              <a
                href="mailto:info@sosm.ch"
                className="text-blue-700 underline"
              >
                info@sosm.ch
              </a>
            </address>
	    <p className="mt-6">
              <BackToApplication />
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
