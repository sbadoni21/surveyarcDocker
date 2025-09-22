import React from "react";
import {
  Shield,
  Lock,
  Eye,
  Users,
  FileText,
  Mail,
  Calendar,
  Globe,
} from "lucide-react";

export default function Policy() {
  const lastUpdated = "December 15, 2024";

  const sections = [
    {
      id: "information-collection",
      title: "Information We Collect",
      icon: <FileText className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <h4 className="font-semibold dark:text-[#96949C] text-gray-900">Personal Information</h4>
          <ul className="list-disc pl-6 space-y-2 dark:text-[#5B596A] text-gray-700">
            <li>
              Name, email address, and contact information when you create an
              account
            </li>
            <li>
              Profile information including profile pictures and user
              preferences
            </li>
            <li>Payment information when you subscribe to premium services</li>
            <li>Survey responses and data when you participate in surveys</li>
          </ul>

          <h4 className="font-semibold dark:text-[#96949C] text-gray-900 mt-6">
            Usage Information
          </h4>
          <ul className="list-disc pl-6 space-y-2 dark:text-[#5B596A] text-gray-700">
            <li>
              Log data including IP addresses, browser type, and device
              information
            </li>
            <li>Usage patterns and interaction data with our platform</li>
            <li>Cookies and similar tracking technologies</li>
            <li>Survey creation and management activities</li>
          </ul>
        </div>
      ),
    },
    {
      id: "information-use",
      title: "How We Use Your Information",
      icon: <Eye className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-[#96949C]">We use the information we collect to:</p>
          <ul className="list-disc pl-6 space-y-2 dark:text-[#5B596A] text-gray-700">
            <li>Provide, maintain, and improve our survey platform services</li>
            <li>Process transactions and send related information</li>
            <li>
              Send technical notices, updates, and administrative messages
            </li>
            <li>
              Respond to comments, questions, and provide customer service
            </li>
            <li>Monitor and analyze trends, usage, and activities</li>
            <li>Personalize and improve user experience</li>
            <li>Detect, investigate, and prevent fraudulent transactions</li>
            <li>
              Comply with legal obligations and enforce our terms of service
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "information-sharing",
      title: "Information Sharing and Disclosure",
      icon: <Users className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-[#96949C]">
            We may share your information in the following circumstances:
          </p>

          <h4 className="font-semibold dark:text-[#96949C] text-gray-900">With Your Consent</h4>
          <p className="text-gray-700 dark:text-[#5B596A]">
            We share information when you explicitly consent to such sharing.
          </p>

          <h4 className="font-semibold dark:text-[#96949C] text-gray-900 mt-4">
            Service Providers
          </h4>
          <p className="text-gray-700 dark:text-[#5B596A]">
            We work with third-party service providers who perform services on
            our behalf, such as payment processing, data analysis, email
            delivery, and customer service.
          </p>

          <h4 className="font-semibold dark:text-[#96949C] text-gray-900 mt-4">
            Legal Requirements
          </h4>
          <p className="text-gray-700 dark:text-[#5B596A]">
            We may disclose information if required by law or in response to
            valid requests by public authorities.
          </p>

          <h4 className="font-semibold dark:text-[#96949C] text-gray-900 mt-4">
            Business Transfers
          </h4>
          <p className="text-gray-700 dark:text-[#5B596A]">
            In connection with any merger, sale of assets, or acquisition of all
            or a portion of our business.
          </p>
        </div>
      ),
    },
    {
      id: "data-security",
      title: "Data Security",
      icon: <Lock className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-[#96949C]">
            We implement appropriate technical and organizational measures to
            protect your personal information:
          </p>
          <ul className="list-disc pl-6 space-y-2 dark:text-[#5B596A] text-gray-700">
            <li>
              Encryption of data in transit and at rest using industry-standard
              protocols
            </li>
            <li>Regular security assessments and vulnerability testing</li>
            <li>Access controls and authentication mechanisms</li>
            <li>Employee training on data protection and privacy practices</li>
            <li>Incident response procedures for data breaches</li>
            <li>Regular backups and disaster recovery procedures</li>
          </ul>
          <p className="text-gray-700 dark:text-[#5B596A] mt-4">
            However, no method of transmission over the Internet or electronic
            storage is 100% secure, and we cannot guarantee absolute security.
          </p>
        </div>
      ),
    },
    {
      id: "user-rights",
      title: "Your Rights and Choices",
      icon: <Shield className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-[#96949C]">
            You have the following rights regarding your personal information:
          </p>

          <h4 className="font-semibold dark:text-[#96949C] text-gray-900">
            Access and Portability
          </h4>
          <p className="text-gray-700 dark:text-[#5B596A]">
            Request access to your personal data and receive a copy in a
            portable format.
          </p>

          <h4 className="font-semibold dark:text-[#96949C] text-gray-900 mt-4">Correction</h4>
          <p className="text-gray-700 dark:text-[#5B596A]">
            Request correction of inaccurate or incomplete personal information.
          </p>

          <h4 className="font-semibold text-gray-900 dark:text-[#96949C] mt-4">Deletion</h4>
          <p className="text-gray-700 dark:text-[#5B596A]">
            Request deletion of your personal information, subject to certain
            exceptions.
          </p>

          <h4 className="font-semibold dark:text-[#96949C] text-gray-900 mt-4">Opt-out</h4>
          <p className="text-gray-700 dark:text-[#5B596A]">
            Opt out of certain communications and data processing activities.
          </p>

          <h4 className="font-semibold dark:text-[#96949C] text-gray-900 mt-4">Account Settings</h4>
          <p className="text-gray-700 dark:text-[#5B596A]">
            Update your account information and privacy preferences through your
            account settings.
          </p>

          <p className="text-gray-700 dark:text-[#5B596A] mt-4">
            To exercise these rights, please contact us at
            privacy@surveyarc.com.
          </p>
        </div>
      ),
    },
    {
      id: "cookies",
      title: "Cookies and Tracking Technologies",
      icon: <Globe className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-[#96949C]">
            We use cookies and similar tracking technologies to enhance your
            experience:
          </p>

          <h4 className="font-semibold dark:text-[#96949C] text-gray-900">Essential Cookies</h4>
          <p className="text-gray-700 dark:text-[#5B596A]">
            Required for the platform to function properly, including
            authentication and security.
          </p>

          <h4 className="font-semibold dark:text-[#96949C] text-gray-900 mt-4">
            Analytics Cookies
          </h4>
          <p className="text-gray-700 dark:text-[#5B596A]">
            Help us understand how users interact with our platform to improve
            our services.
          </p>

          <h4 className="font-semibold dark:text-[#96949C] text-gray-900 mt-4">
            Preference Cookies
          </h4>
          <p className="text-gray-700 dark:text-[#5B596A]">
            Remember your settings and preferences for a personalized
            experience.
          </p>

          <p className="text-gray-700 dark:text-[#5B596A] mt-4">
            You can control cookie settings through your browser preferences,
            but disabling certain cookies may limit platform functionality.
          </p>
        </div>
      ),
    },
    {
      id: "data-retention",
      title: "Data Retention",
      icon: <Calendar className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-[#96949C]">
            We retain your information for as long as necessary to:
          </p>
          <ul className="list-disc pl-6 space-y-2 dark:text-[#5B596A] text-gray-700">
            <li>Provide our services and maintain your account</li>
            <li>Comply with legal obligations and resolve disputes</li>
            <li>Enforce our agreements and protect our rights</li>
            <li>Improve our services and develop new features</li>
          </ul>

          <p className="text-gray-700 dark:text-[#96949C] mt-4">Specific retention periods:</p>
          <ul className="list-disc pl-6 space-y-2 dark:text-[#5B596A] text-gray-700">
            <li>
              Account information: Retained while your account is active plus 3
              years
            </li>
            <li>
              Survey data: Retained as long as specified by survey creators or 7
              years maximum
            </li>
            <li>
              Usage logs: Retained for 2 years for security and analytics
              purposes
            </li>
            <li>
              Payment information: Retained as required by financial regulations
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "international-transfers",
      title: "International Data Transfers",
      icon: <Globe className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-[#96949C]">
            SurveyArc operates globally, and your information may be transferred
            to and processed in countries other than your country of residence.
            We ensure appropriate safeguards are in place:
          </p>
          <ul className="list-disc pl-6  dark:text-[#5B596A] space-y-2 text-gray-700">
            <li>
              Standard contractual clauses approved by relevant authorities
            </li>
            <li>
              Adequacy decisions for countries with appropriate protection
              levels
            </li>
            <li>Certification schemes and codes of conduct</li>
            <li>Binding corporate rules for intra-group transfers</li>
          </ul>
        </div>
      ),
    },
    {
      id: "children-privacy",
      title: "Children's Privacy",
      icon: <Shield className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-[#5B596A]">
            SurveyArc is not intended for children under 13 years of age. We do
            not knowingly collect personal information from children under 13.
            If we become aware that we have collected personal information from
            a child under 13, we will take steps to delete such information
            promptly.
          </p>
          <p className="text-gray-700 dark:text-[#5B596A]">
            For users between 13 and 18, we recommend parental guidance when
            using our services.
          </p>
        </div>
      ),
    },
    {
      id: "contact-info",
      title: "Contact Information",
      icon: <Mail className="w-5 h-5" />,
      content: (
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-[#96949C]">
            If you have questions about this Privacy Policy or our privacy
            practices, please contact us:
          </p>
          <div className="bg-gray-50 dark:bg-[#1A1A1E] dark:border-[#8C8A97] dark:border p-4 rounded-lg">
            <p className="font-semibold dark:text-[#96949C] text-gray-900">
              SurveyArc Privacy Team
            </p>
            <p className="text-gray-700 dark:text-[#5B596A]">Email: support@appinfologic.in</p>
            <p className="text-gray-700 dark:text-[#5B596A]">
              Address: Jagriti Vihar, Dehradun, Uttarakhand, India
            </p>
            <p className="text-gray-700 dark:text-[#5B596A]">Phone: +91 8755910826</p>
          </div>
          <p className="text-gray-700 dark:text-[#5B596A]">
            We will respond to your inquiry within 30 days of receipt.
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen dark:bg-[#121214] bg-gray-50">
      <div className="bg-white dark:bg-[#1A1A1E] dark:border-[#8C8A97] dark:border shadow-sm rounded-xl border-b">
        <div className=" mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-orange-600" />
            <div>
              <h1 className="text-3xl font-bold dark:text-[#CBC9DE] text-gray-900">
                Privacy Policy
              </h1>
              <p className="text-gray-600 dark:text-[#5B596A]">
                SurveyArc - Last updated: {lastUpdated}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="py-8">
        {/* Introduction */}
        <div className="bg-white dark:border-[#8C8A97] dark:border dark:bg-[#1A1A1E] rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold dark:text-[#CBC9DE] text-gray-900 mb-4">
            Introduction
          </h2>
          <p className="text-gray-700 dark:text-[#5B596A] leading-relaxed">
            At SurveyArc, we are committed to protecting your privacy and
            personal information. This Privacy Policy explains how we collect,
            use, disclose, and protect your information when you use our survey
            platform and related services. By using SurveyArc, you agree to the
            collection and use of information in accordance with this policy.
          </p>
        </div>

        {/* Navigation */}
        <div className="bg-white dark:border-[#8C8A97] dark:border dark:bg-[#1A1A1E] rounded-lg shadow-sm p-6 mb-8">
          <h3 className="text-lg font-semibold dark:text-[#CBC9DE] text-gray-900 mb-4">
            Quick Navigation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 text-orange-600 hover:text-blue-800 transition-colors"
              >
                {section.icon}
                <span className="text-sm">{section.title}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="space-y-8">
          {sections.map((section) => (
            <div
              key={section.id}
              id={section.id}
              className="bg-white dark:border-[#8C8A97] dark:border dark:bg-[#1A1A1E] rounded-lg shadow-sm p-6"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0 text-orange-600">
                  {section.icon}
                </div>
                <h2 className="text-xl font-semibold dark:text-[#CBC9DE] text-gray-900">
                  {section.title}
                </h2>
              </div>
              <div className="prose prose-gray dark:text-[#5B596A] max-w-none">
                {section.content}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 dark:bg-[#1A1A1E] dark:border-[#8C8A97] dark:border border border-blue-200 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold dark:text-[#96949C] text-blue-900 mb-2">
            Changes to This Privacy Policy
          </h3>
          <p className="text-blue-800 dark:text-[#5B596A]">
            We may update our Privacy Policy from time to time. We will notify
            you of any changes by posting the new Privacy Policy on this page
            and updating the "last updated" date. We encourage you to review
            this Privacy Policy periodically for any changes. Changes to this
            Privacy Policy are effective when they are posted on this page.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-gray-200">
          <p className="text-gray-500 text-sm">
            © 2024 SurveyArc. All rights reserved. |
            <a href="/terms" className="text-orange-600 hover:text-blue-800 ml-1">
              Terms of Service
            </a>{" "}
            |
            <a
              href="/contact"
              className="text-orange-600 hover:text-blue-800 ml-1"
            >
              Contact Us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
