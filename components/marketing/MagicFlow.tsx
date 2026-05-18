/**
 * Magic Flow — three product stages visible at once, with a glowing magic
 * pulse traveling left → right through them. Each panel "activates" (glows
 * coral, lifts up) as the pulse arrives. Loop = 4.5s.
 */
export function MagicFlow() {
  return (
    <div className="flow">
      <div className="flow-row">
        {/* STAGE 1 — form */}
        <div>
          <div className="flow-panel flow-panel-1">
            <div className="flow-card">
              <div className="text-[10px] font-bold text-ink/50 mb-1.5 uppercase tracking-wide">
                Your kid&apos;s name
              </div>
              <div className="flow-input">Maya</div>
              <div className="text-[10px] font-bold text-ink/50 mb-1.5 uppercase tracking-wide">
                What they love
              </div>
              <div className="flow-pills">
                <span className="flow-pill flow-pill-active">Bluey</span>
                <span className="flow-pill">dragons</span>
                <span className="flow-pill">Frozen</span>
                <span className="flow-pill">space</span>
              </div>
              <div className="flow-photo-box">📸 Photo (optional)</div>
            </div>
          </div>
          <div className="flow-stage-label">
            <span className="flow-stage-num">1</span>
            <span className="flow-stage-title">Tell us about your kid</span>
            <div className="flow-stage-body">Name, personality, favorite shows.</div>
          </div>
        </div>

        {/* CONNECTOR 1 — pulse travels here */}
        <div className="flow-connector flow-connector-1" />

        {/* STAGE 2 — magic */}
        <div>
          <div className="flow-panel flow-panel-2">
            <div className="flow-magic-core">
              <div className="flow-magic-orb" />
              <div className="flow-magic-ring" />
              <div className="flow-magic-ring flow-magic-ring-2" />
              <div className="flow-magic-ring flow-magic-ring-3" />
              <div className="flow-spark flow-spark-1" />
              <div className="flow-spark flow-spark-2" />
              <div className="flow-spark flow-spark-3" />
              <div className="flow-spark flow-spark-4" />
              <div className="flow-spark flow-spark-5" />
              <div className="flow-spark flow-spark-6" />
            </div>
          </div>
          <div className="flow-stage-label">
            <span className="flow-stage-num">2</span>
            <span className="flow-stage-title">We write &amp; illustrate</span>
            <div className="flow-stage-body">12 personalized pages with your kid as the hero.</div>
          </div>
        </div>

        {/* CONNECTOR 2 — pulse travels here */}
        <div className="flow-connector flow-connector-2" />

        {/* STAGE 3 — book */}
        <div>
          <div className="flow-panel flow-panel-3">
            <div className="flow-book">
              <div className="flow-book-inner">
                <div className="flow-book-page flow-book-page-left">
                  <span className="flow-book-line flow-book-line-w-80" />
                  <span className="flow-book-line flow-book-line-w-90" />
                  <span className="flow-book-line flow-book-line-w-60" />
                  <span className="flow-book-line flow-book-line-w-80" />
                  <span className="flow-book-line flow-book-line-w-90" />
                  <span className="flow-book-line flow-book-line-w-60" />
                </div>
                <div className="flow-book-page flow-book-page-right">
                  <div className="flow-book-illustration" />
                </div>
                <div className="flow-book-spine" />
              </div>
            </div>
          </div>
          <div className="flow-stage-label">
            <span className="flow-stage-num">3</span>
            <span className="flow-stage-title">Read tonight</span>
            <div className="flow-stage-body">
              Printable PDF instantly &nbsp;·&nbsp;
              <span className="text-coral font-bold">Or order a hardcover, shipped to you</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
