import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";

export const metadata: Metadata = {
  title: "Accessibility statement",
  description: "Accessibility commitment, conformance target, known limitations, and assistance information.",
};

export default function AccessibilityPage() {
  return (
    <PageShell
      active="Accessibility"
      eyebrow="Access for everyone"
      title="Accessibility statement"
      description="Our commitment to making Neighborhood Investment Intelligence usable by people with disabilities."
    >
      <article className="detail-card wide-card legal-page">
        <p className="statement-updated">Last reviewed July 30, 2026</p>

        <section aria-labelledby="commitment">
          <h2 id="commitment">Our commitment</h2>
          <p>
            We are working to make this website perceivable, operable, understandable, and robust
            for people with diverse abilities, devices, and assistive technologies. Accessibility
            is treated as an ongoing product requirement, not a one-time certification.
          </p>
        </section>

        <section aria-labelledby="standard">
          <h2 id="standard">Standard and conformance status</h2>
          <p>
            Our technical target is the{" "}
            <a href="https://www.w3.org/TR/WCAG22/" target="_blank" rel="noreferrer">
              Web Content Accessibility Guidelines (WCAG) 2.2 Level AA
            </a>
            . The current website is partially conformant with that target. This means many
            accessibility requirements are implemented, while some content or interactions may
            not yet fully meet every success criterion.
          </p>
          <p>
            This statement records our accessibility efforts. It is not a legal certification,
            and requirements may vary according to the website operator, audience, location, and
            use of the service.
          </p>
        </section>

        <section aria-labelledby="measures">
          <h2 id="measures">Measures we take</h2>
          <ul>
            <li>Semantic page structure, descriptive headings, labels, and link text.</li>
            <li>Keyboard access, visible focus indicators, and a skip-to-content link.</li>
            <li>Text alternatives and accessible names for meaningful maps, controls, and charts.</li>
            <li>Information presented with text in addition to color wherever practicable.</li>
            <li>Responsive layouts, browser zoom support, and reduced-motion preferences.</li>
            <li>Source tables and detail views that supplement interactive map information.</li>
            <li>Accessibility review during product changes and before publication.</li>
          </ul>
        </section>

        <section aria-labelledby="limitations">
          <h2 id="limitations">Known limitations</h2>
          <ul>
            <li>
              Dense geospatial visualizations may not communicate every spatial relationship to
              screen-reader users. The opportunity results table provides the corresponding area
              records and links to detailed views.
            </li>
            <li>
              Third-party websites, government portals, and source documents opened from evidence
              links are controlled by their respective publishers and may have different
              accessibility support.
            </li>
            <li>
              User-imported property records may contain abbreviations or descriptions that the
              website cannot automatically make more understandable.
            </li>
            <li>
              An independent manual audit with multiple assistive-technology combinations has not
              yet been completed.
            </li>
          </ul>
        </section>

        <section aria-labelledby="compatibility">
          <h2 id="compatibility">Compatibility</h2>
          <p>
            The website is designed for current versions of major browsers and for keyboard and
            screen-reader operation using standards-based HTML, CSS, JavaScript, and WAI-ARIA.
            Older browsers may not provide the same experience.
          </p>
        </section>

        <section aria-labelledby="assistance">
          <h2 id="assistance">Feedback and assistance</h2>
          <p>
            If you encounter an accessibility barrier or need information in a different format,
            contact the workspace administrator through the same channel used to provide your
            access. Include the page address, the task you were trying to complete, your browser,
            and any assistive technology used. The administrator should acknowledge the request
            promptly and provide a reasonable accessible alternative while the issue is reviewed.
          </p>
        </section>

        <section aria-labelledby="references">
          <h2 id="references">Reference framework</h2>
          <ul>
            <li><a href="https://www.ada.gov/resources/web-guidance/" target="_blank" rel="noreferrer">U.S. Department of Justice web accessibility guidance</a></li>
            <li><a href="https://www.section508.gov/manage/laws-and-policies/website-accessibility-statement/" target="_blank" rel="noreferrer">Section508.gov accessibility statement guidance</a></li>
            <li><a href="https://www.w3.org/WAI/planning/statements/" target="_blank" rel="noreferrer">W3C guidance for accessibility statements</a></li>
          </ul>
        </section>
      </article>
    </PageShell>
  );
}
