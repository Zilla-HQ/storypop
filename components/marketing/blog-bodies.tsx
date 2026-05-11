import type { ComponentType } from "react";
import Link from "next/link";
import { CITY_TARGETS } from "@/lib/cities";

/**
 * Per-post body components. Indexed by slug so app/(marketing)/blog/[slug]/page.tsx
 * can resolve them at static-build time. Each body is a simple JSX fragment of
 * h2/h3/p/ul nodes — Tailwind typography in PostShell handles the styling.
 */

function BodyWhyNoBookings() {
  return (
    <>
      <p>
        Most hosts who ask "why isn't my listing getting bookings" are reasoning from
        the wrong unit. Airbnb's algorithm doesn't think about your listing in
        isolation — it thinks about your listing <em>relative</em> to the
        comparable set in your market. So if bookings dropped, the question to ask
        first is: <strong>what changed in your market</strong>, not what changed about
        your place.
      </p>
      <p>
        That said, there are five reasons that show up in roughly that order across
        the listings we've graded — and they're all things you can fix without
        Airbnb's help.
      </p>

      <h2>1. Your photos haven't been refreshed since launch</h2>
      <p>
        This is the single biggest one. Most hosts shoot their photos once, on a
        phone, in the afternoon, and never come back. The market keeps raising the
        photo bar — designer-led listings in your city are now almost all
        magazine-grade — and your set drifts further behind every quarter.
      </p>
      <p>
        Airbnb's search-result tile is one cropped image. If that image doesn't
        stop a thumb mid-scroll, you don't get a click, and click-through is a
        ranking input. The fix is uncomfortably simple: re-shoot, or restyle the
        existing set with proper color/lighting (photo-edit only — never add
        furniture; see <Link href="/blog/is-virtual-staging-allowed-on-airbnb">this
        post</Link> on Airbnb's policy).
      </p>

      <h2>2. Your title says nothing specific</h2>
      <p>
        "Cozy 2BR in Austin," "Charming home in Nashville," "Beautiful Miami
        condo." Every one of these is doing the same thing: leading with a
        property type and a city. The algorithm rewards specificity because
        specificity correlates with booking-intent click-through.
      </p>
      <p>
        Lead with your <em>strongest single differentiator</em> — pool, rooftop, view,
        walking distance to a specific landmark, designer aesthetic, hot tub, fireplace.
        Whatever your guests already mention in reviews. Generic titles convert at
        about half the rate of specific ones across the listings we grade.
      </p>

      <h2>3. Your description has no hook</h2>
      <p>
        Description copy follows a predictable pattern: pricing tier first, then
        amenities list, then "we look forward to hosting you." None of those things
        belong at the top.
      </p>
      <p>
        The first 120 characters of your description show up before the
        "more" expand. Use them to plant <strong>one sensory detail</strong> — what
        the place feels like, what the morning view is like, what makes someone
        screenshot the listing to send to a friend. The rest of the description
        can do the amenity work below the fold.
      </p>

      <h2>4. Your nightly rate has drifted out of the comp set</h2>
      <p>
        Pricing tools (PriceLabs, Wheelhouse, Beyond) get most of the attention,
        but you don't need a subscription to fix the obvious case: pull 50 comp
        listings within a kilometer of yours and check the median.
      </p>
      <p>
        If you're 15%+ above the median without a clear premium reason
        (waterfront, design-led, larger), conversion drops sharply. If you're 15%+
        below, you're leaving revenue on the table. The first cut is just
        median-anchoring; calendar-based pricing is the polish on top.
      </p>

      <h2>5. You haven't gotten a review in 60+ days</h2>
      <p>
        Review velocity is a search-ranking input. Listings without recent reviews
        get nudged down the results. A long gap usually compounds — fewer
        bookings means fewer reviews means fewer bookings.
      </p>
      <p>
        The ways out: a small price drop to break the cycle, a fresh hero photo
        and title to lift CTR, and (if you're under 5 reviews total) leveraging
        family or friends for the first 3 to clear the trust threshold. You only
        need to break the cycle once.
      </p>

      <h2>What to do this week</h2>
      <p>
        If you're going to do one thing, regrade your photos. If you're going to
        do two, regrade your photos and rewrite your title. The other three matter
        but they compound off the first two.
      </p>
      <p>
        Or just <Link href="/grade">paste your URL into our free grader</Link> — it'll
        score all five of these in 10 seconds and tell you which one to attack
        first.
      </p>
    </>
  );
}

function BodyRankingFactors() {
  return (
    <>
      <p>
        Airbnb's search ranking is opaque on purpose. They've published a public
        page called "How Airbnb's search ranking works" that lists 100+ factors,
        most of which are either obvious (price, dates, location) or
        unactionable (guest preferences). What they <em>don't</em> tell you is the
        weights or the recent-change shape of the algorithm.
      </p>
      <p>
        Across 200,000+ listings we've indexed, the inputs that actually move
        ranking are narrower than the official list. Here's the working model.
      </p>

      <h2>The high-leverage levers</h2>
      <h3>1. Click-through rate on the search-result tile</h3>
      <p>
        Of all the inputs we can measure, this is the strongest. The tile has
        three components: the hero photo, the title, and the price. CTR is heavily
        weighted by the hero — if it's flat, dim, or shows a generic bedroom, you
        get fewer clicks, and ranking degrades.
      </p>
      <p>
        Optimization order: hero photo &gt; title &gt; price band.
      </p>

      <h3>2. Booking conversion rate (clicks → bookings)</h3>
      <p>
        Once a guest lands on your detail page, do they book? This is driven by
        the photo carousel quality, description hook, reviews, and value-for-money
        relative to the comp set. Airbnb knows your conversion rate within seconds
        of you publishing a listing, and it adjusts your ranking to match.
      </p>

      <h3>3. Review velocity and recency</h3>
      <p>
        Recent reviews matter more than total review count. A listing with 30
        reviews in the last 90 days outranks one with 200 reviews where the most
        recent is 6 months old.
      </p>

      <h3>4. Response rate and time</h3>
      <p>
        Under-1-hour response time is a hard cutoff. Hosts above that band get
        materially de-ranked. This is one of the few inputs Airbnb is explicit
        about. Set up notifications and saved replies — most of the friction here
        is just operational.
      </p>

      <h3>5. Calendar accuracy</h3>
      <p>
        Frequent calendar updates (price tweaks, blocked dates, new openings)
        signal to the algorithm that the listing is actively managed. It doesn't
        have to be a daily ritual; weekly is enough. Stagnant calendars get
        nudged down because Airbnb wants to surface listings that are likely to
        accept a booking request.
      </p>

      <h3>6. Acceptance rate</h3>
      <p>
        The percentage of booking requests you accept (vs. decline). Decline
        too many and ranking drops. Instant Book listings sidestep this entirely.
      </p>

      <h3>7. Cancellation rate</h3>
      <p>
        Host-initiated cancellations are heavily penalized — three in a year is
        roughly the threshold where ranking visibly degrades and Superhost status
        becomes unrecoverable.
      </p>

      <h3>8. Photo count</h3>
      <p>
        Listings with 20+ photos outperform those with under 10. There's a
        diminishing return past ~25, but the threshold to cross is "have at least
        20."
      </p>

      <h3>9. Description length and specificity</h3>
      <p>
        Descriptions under ~150 words are penalized. Beyond that the relationship
        weakens — quality and structure beat raw length once you're past the
        threshold.
      </p>

      <h2>The medium-leverage levers</h2>
      <p>
        Tier 2 inputs we can see correlate with ranking but are less reliable:
        Superhost status (more of a trust signal to guests than a search bump,
        in our reading); IB on/off; minimum-night length; and whether you've
        responded to recent inquiries within the response-time window.
      </p>

      <h2>The myths</h2>
      <p>
        Things hosts often optimize that don't measurably move ranking:
      </p>
      <ul>
        <li>Adding more amenities to the checklist (only matters at the search filter level)</li>
        <li>Changing your nightly rate by ±$5 (pricing matters, but ±5 is below the resolution of the algorithm)</li>
        <li>Posting in Airbnb forums or community boards (zero ranking effect)</li>
      </ul>

      <h2>What to actually do this quarter</h2>
      <p>
        Pick the three levers from the high-leverage list where you score worst.
        For most hosts that's hero photo, title, and review velocity — in that
        order. Fix those three, and ranking moves within ~14 days.
      </p>
      <p>
        Our <Link href="/grade">free grader</Link> measures eight of the nine
        high-leverage inputs (everything except response/acceptance/cancellation,
        which are tied to your account, not your listing).
      </p>
    </>
  );
}

function BodyPhotosDosAndDonts() {
  return (
    <>
      <p>
        Photos are the single biggest lever you have on Airbnb conversion. The
        click-through rate on your search-result tile is heavily weighted by the
        hero image, and the booking-conversion rate on your detail page is
        weighted by the carousel quality. So while every host knows photos
        matter, very few have actually re-graded their set since they launched.
      </p>
      <p>
        Here's what works in 2026, what doesn't, and where Airbnb's policy sits.
      </p>

      <h2>The do's</h2>

      <h3>Shoot at golden hour, or simulate it in post</h3>
      <p>
        Mid-day window light is harsh and produces blown-out highlights with
        muddy shadow detail. Late-afternoon golden light is soft, warm, and
        flattering — it's why every listing photographer tries to schedule the
        shoot 90 minutes before sunset. If you can't reshoot, color-grading
        existing photos toward warmer mid-tones reads similarly.
      </p>

      <h3>Lead with the hero, not the entry</h3>
      <p>
        The hero is the photo Airbnb crops to the search-result tile. It should be
        whatever makes someone want to book — pool, view, design moment, hot tub,
        kitchen, fireplace — <em>not</em> the entryway or a wide shot of the
        living room.
      </p>

      <h3>Photograph at 24-35mm equivalent, not ultra-wide</h3>
      <p>
        Most hosts (and unfortunately some Airbnb-recommended photographers) shoot
        ultra-wide at 16-18mm because it makes rooms look bigger. Guests notice
        the distortion when they arrive, and it shows up in negative reviews. 24mm
        on full-frame, or ~16mm on crop-sensor, is the right balance.
      </p>

      <h3>Get to 20+ photos</h3>
      <p>
        Listings with under 10 photos rank materially worse and convert less. 20
        is the threshold; 25 is the sweet spot. Repeat angles add little — show
        each room, show the outdoor space, show one detail shot per amenity worth
        leading with.
      </p>

      <h3>Order: hero → main living spaces → bedrooms → bath → outdoor → details</h3>
      <p>
        This is the order most photographers use because it matches the order a
        guest emotionally evaluates a stay. Don't bury the pool photo at position
        17.
      </p>

      <h2>The don'ts</h2>

      <h3>Don't shoot at night with interior lights on</h3>
      <p>
        It looks atmospheric in person, terrible on Airbnb. Tungsten lighting
        photographs orange and reads cheap. The exception: a hot-tub or
        outdoor-fire detail shot at twilight, where the contrast is the whole point.
      </p>

      <h3>Don't shoot vertical for non-vertical features</h3>
      <p>
        Airbnb crops aggressively. A vertical photo of a horizontal living room
        will be cropped on every device. Shoot horizontal, period — except for a
        narrow stairwell or bunk room where vertical is the actual subject.
      </p>

      <h3>Don't include people, pets, or hosts in the photos</h3>
      <p>
        Airbnb's policy isn't strict on this, but conversion is. Guests want to
        picture themselves in the space, and people in the photos disrupt that.
        The host headshot belongs in your host profile, not the listing carousel.
      </p>

      <h3>Don't use stock or marketing photos of the area</h3>
      <p>
        Airbnb explicitly disallows photos that aren't of your actual property.
        That includes stock images of "Nashville at sunset" and beach photos
        you didn't take.
      </p>

      <h2>What's editable under Airbnb's policy</h2>
      <p>
        Airbnb's Photo Policy permits color, exposure, white balance, and clarity
        edits. It permits cleaning up minor distractions (cables, remotes, dirty
        towels). It permits sky replacement on a blown-out exterior shot.
      </p>
      <p>
        It <strong>does not</strong> permit adding, removing, or rearranging
        furniture, decor, art, or fixtures. Listings using AI virtual staging
        (which generates furniture into empty rooms) violate the policy and risk
        suspension. See <Link href="/blog/is-virtual-staging-allowed-on-airbnb">our
        full piece on this</Link> for the gray areas.
      </p>

      <h2>If you can only do one thing</h2>
      <p>
        Re-grade your existing set for color, lighting, and clutter. The lift
        from edit-only restyling tends to be 60-70% of the lift from a full
        reshoot, at a fraction of the cost. That's the entire premise of the
        Restay Tune-Up — paste your URL and you'll see what your set could look
        like.
      </p>
      <p>
        <Link href="/grade">Grade your photos free →</Link>
      </p>
    </>
  );
}

function BodyUpdateCadence() {
  return (
    <>
      <p>
        Most hosts treat their Airbnb listing the way most homeowners treat their
        smoke detectors: set up once, ignore until something goes wrong. The
        market doesn't reward that.
      </p>
      <p>
        Across the listings we've indexed, the cadence that correlates best with
        consistent booking velocity is roughly:
      </p>

      <ul>
        <li><strong>Every 30 days:</strong> light pricing review (15 minutes)</li>
        <li><strong>Every 90 days:</strong> title and hero photo review (1 hour)</li>
        <li><strong>Every 180 days:</strong> full description rewrite + photo refresh (half day)</li>
        <li><strong>Every 12 months:</strong> reshoot or restyle the photo set (half day if restyle, full day if reshoot)</li>
      </ul>

      <p>
        The reasons each cadence matters:
      </p>

      <h2>Pricing — every 30 days</h2>
      <p>
        Comp listings shift their pricing constantly. If you're using PriceLabs or
        Wheelhouse, this happens automatically. If you're not, a 15-minute
        comp-set spot-check once a month is enough to catch drift before it costs
        you bookings.
      </p>
      <p>
        The check: pull 20 listings within a kilometer that match your bedroom
        count and amenity profile. Note the median weeknight and median weekend
        rate. If you're 15%+ above or below either, adjust.
      </p>

      <h2>Title and hero photo — every 90 days</h2>
      <p>
        These are your search-result-tile assets. They drive CTR, which drives
        ranking. Seasonality shifts what should lead — a "fireplace + hot tub"
        title in October beats the same listing's "rooftop access" title from
        July. Refresh both at the season change.
      </p>

      <h2>Description and photo refresh — every 180 days</h2>
      <p>
        Your reviews accumulate language over time — guests describe your place
        in ways you don't yet describe it. Twice a year, comb through the last
        90 days of reviews and pull the recurring nouns and adjectives. They
        should appear in your description.
      </p>
      <p>
        Photo refresh on this cadence isn't necessarily a reshoot — it's
        reordering, swapping the hero, and removing any photos that have aged
        (different couch since the original shoot, different art on the wall).
      </p>

      <h2>Full reshoot or restyle — every 12 months</h2>
      <p>
        The market raises the photo bar every year. Designer-led listings near you
        keep getting better, and your set's relative position keeps slipping. A
        full reshoot is the high-ceiling option ($500-1500 typical); an edit-only
        restyle is the low-ceiling option ($79-300 typical) that captures most of
        the lift.
      </p>

      <h2>What "set up once" actually costs</h2>
      <p>
        We graded a Nashville listing in late 2025 that hadn't been touched since
        early 2023. The hero photo was ultra-wide and overexposed. The title was
        generic. The description was 60 words. The host had been on autopilot
        through three Airbnb algorithm shifts and was wondering why their
        bookings had halved year-over-year.
      </p>
      <p>
        After a full Tune-Up — rewritten copy, restyled photos, repriced — the
        listing's grade went from 52/100 to 87/100, and they cleared more bookings
        in the next 30 days than in the prior 90.
      </p>
      <p>
        The lesson isn't "use Restay" — it's <em>don't set it and forget it</em>.
        If you DIY it on the cadence above, you'll keep up with the market on
        your own. If you'd rather not think about it, that's our pitch.
      </p>
      <p>
        <Link href="/grade">Grade your listing today →</Link> Most hosts hadn't realized
        how far they'd drifted until they saw the score.
      </p>
    </>
  );
}

function BodyVirtualStaging() {
  return (
    <>
      <p>
        Short answer: <strong>no, virtual staging is not allowed on Airbnb if it
        means generating furniture, decor, or fixtures into rooms that don't
        actually have them.</strong> Yes, photo <em>editing</em> (color, lighting,
        clarity, sky replacement, removing minor clutter) is allowed.
      </p>
      <p>
        The longer answer is that "virtual staging" is a category that has split
        into two things in 2026, and Airbnb's policy applies cleanly to one and
        ambiguously to the other.
      </p>

      <h2>Airbnb's actual policy</h2>
      <p>
        Airbnb's Photo Policy (under their Content Policy) requires that photos
        accurately represent the property a guest will arrive at. They permit:
      </p>
      <ul>
        <li>Color correction, white balance, exposure adjustments</li>
        <li>Sharpness and clarity edits</li>
        <li>Sky replacement on exterior shots (overcast → blue, blown-out → graded)</li>
        <li>Removal of minor distractions: visible cables, remote controls, half-folded throws, garbage cans</li>
      </ul>
      <p>
        They <strong>do not permit</strong>:
      </p>
      <ul>
        <li>Adding furniture, art, decor, or fixtures that don't exist in the actual space</li>
        <li>Removing furniture, walls, doors, windows, or structural features</li>
        <li>Changing the layout, geometry, or perspective of the room</li>
        <li>Compositing in stock or marketing photos</li>
      </ul>
      <p>
        Violations can result in listing suspension, especially when they show up
        in negative reviews where guests describe the space as not matching the
        photos.
      </p>

      <h2>Where the gray areas are</h2>
      <p>
        Three cases tend to confuse hosts:
      </p>

      <h3>1. "I had clutter in the photo and I removed it"</h3>
      <p>
        Allowed if the clutter is genuinely a temporary distraction (visible
        plug-strip, mail on a counter, unfolded laundry). Not allowed if you're
        removing semi-permanent objects (a couch, a TV, a wall art piece) that
        will be present when the guest arrives.
      </p>

      <h3>2. "The room is a little bare and I want it to look more inviting"</h3>
      <p>
        This is where the AI virtual staging tools — many of which advertise
        themselves to STR hosts — cross the policy line. If you're generating a
        couch into an empty room, you're misrepresenting the space. If your
        listing actually has the couch and you're just brightening the photo,
        you're fine.
      </p>

      <h3>3. "The view from the window was washed out and I replaced the sky"</h3>
      <p>
        Allowed. Sky replacement is a long-accepted real-estate photography
        technique. The principle: you're correcting an exposure problem caused
        by the limits of camera dynamic range, not inventing a feature of the
        property.
      </p>

      <h2>Why edit-only restyling has compounded as the right answer</h2>
      <p>
        The market has moved toward <em>edit-only</em> photo work over the last
        18 months — restyling existing photos for color, light, and clarity
        without adding generated content. There are three reasons:
      </p>
      <ul>
        <li><strong>Policy compliance:</strong> the work stays clearly inside Airbnb's TOS, with originals retained for proof.</li>
        <li><strong>Honest reviews:</strong> guests aren't surprised on arrival, so reviews reflect the actual stay rather than a mismatch.</li>
        <li><strong>Quality:</strong> AI virtual staging that generates furniture still produces noticeable artifacts at scale — guests see them.</li>
      </ul>
      <p>
        Restay's photo work is exclusively edit-only. We declutter, relight,
        color-grade, and sky-replace — never add or remove furniture. We retain
        originals on every order, and the disclosure footer on the email
        delivery names exactly what was edited.
      </p>

      <h2>What about other platforms?</h2>
      <p>
        Vrbo's policy is slightly less strict than Airbnb's — they explicitly
        allow some forms of virtual staging if disclosed in the listing. Booking.com's
        policy is closer to Airbnb's. Zillow and MLS rules for real estate listings
        are different again (most MLS rules now require disclosure of any digital
        staging in the listing remarks).
      </p>
      <p>
        If you cross-list your STR on multiple platforms, treat Airbnb's policy
        as the binding one — it's the strictest, and using a single compliant
        photo set across platforms keeps your operations sane.
      </p>

      <h2>The upshot</h2>
      <p>
        You don't need virtual staging to compete on Airbnb. The lift from
        professional-grade edit-only work — better lighting, better color, better
        clutter discipline — captures most of the conversion improvement that
        full virtual staging would, with none of the policy or reputation risk.
      </p>
      <p>
        <Link href="/grade">Grade your listing free</Link> to see what edit-only
        restyling would change about your set.
      </p>
    </>
  );
}

function BodyTitleFormulas() {
  return (
    <>
      <p>
        The single most-replicated mistake in Airbnb listing titles is generic
        property-type-plus-city framing: "Cozy 2BR in Austin," "Charming home in
        Nashville," "Beautiful Miami condo." Every one of those does the same
        thing — leads with a city that's already implied by the search query.
      </p>
      <p>
        Airbnb's algorithm rewards specificity because specificity correlates
        with click-through rate, and click-through rate is one of the strongest
        ranking inputs. The fix is to lead with the
        <em> single sharpest signal</em> a guest cares about in your particular
        market — and the right signal varies by city more than most hosts realize.
      </p>
      <p>
        Across the top 25 US STR markets, here's what the comp set tells us about
        what to lead with. (Each city links to a free grader for that market.)
      </p>

      <h2>The "lead with the experience" markets</h2>
      <p>
        These markets reward titles that name a sensory hook over an amenity.
        Photos and copy together set the scene; the title is the click bait.
      </p>
      <ul>
        <li>
          <Link href="/grade/joshua-tree">Joshua Tree, CA</Link>: lead with the
          design aesthetic ("Mid-century desert retreat with dark-sky deck") or
          the hook photo's subject. This is an Instagram-driven market — the
          title's job is to make someone screenshot.
        </li>
        <li>
          <Link href="/grade/asheville">Asheville, NC</Link>: mountain-cabin
          framing wins. Lead with view, fireplace, or hot tub. "Mountain-view
          cabin with stone fireplace" outperforms "Cozy 3BR in Asheville" 3:1
          on click-through.
        </li>
        <li>
          <Link href="/grade/savannah">Savannah, GA</Link>: walkability is
          everything. Lead with proximity to the Historic District or the
          Riverwalk. "Steps from Forsyth Park · 1820s row house" is the form.
        </li>
        <li>
          <Link href="/grade/charleston">Charleston, SC</Link>: porch and
          courtyard framing dominates. Lead with that, plus walking distance to
          King Street.
        </li>
      </ul>

      <h2>The "lead with the amenity" markets</h2>
      <p>
        Amenity-led markets are ones where one specific feature drives the
        booking decision. The title doesn't need to be poetic; it needs to
        stop the scroll.
      </p>
      <ul>
        <li>
          <Link href="/grade/scottsdale">Scottsdale, AZ</Link>: pool and Old
          Town walkability. "Heated pool · Old Town walk · 4BR" is the canonical
          form. Listings without a pool need to compensate hard on copy.
        </li>
        <li>
          <Link href="/grade/phoenix">Phoenix, AZ</Link>: pool, casita, or
          golf-course access. Lead with one. "Resort pool · putting green · 5BR
          near Camelback" outperforms generic descriptors.
        </li>
        <li>
          <Link href="/grade/gatlinburg">Gatlinburg, TN</Link>: hot tub and
          mountain view are the binary fields most guests filter on. Title:
          "Hot tub deck · Smoky Mountain views · log cabin."
        </li>
        <li>
          <Link href="/grade/broken-bow">Broken Bow, OK</Link>: design-led cabin
          aesthetic plus private hot tub. "A-frame cabin · private hot tub ·
          Hochatown" reads correctly.
        </li>
        <li>
          <Link href="/grade/blue-ridge">Blue Ridge, GA</Link>: same shape as
          Gatlinburg — view, hot tub, fire pit. The differentiator is the cabin
          design quality.
        </li>
      </ul>

      <h2>The "lead with proximity" markets</h2>
      <p>
        Coastal and resort markets rank heavily on distance-to-water or
        distance-to-something. Don't bury this — it's the search-intent that
        guests are filtering on.
      </p>
      <ul>
        <li>
          <Link href="/grade/destin">Destin, FL</Link>: lead with steps-to-beach
          framing and bedroom count. "Steps to beach · 6BR · pool · sleeps 14"
          is the working form.
        </li>
        <li>
          <Link href="/grade/miami">Miami, FL</Link>: ocean view or walking
          distance to the water. Neighborhood (South Beach, Brickell, Wynwood)
          can substitute if you don't have ocean access.
        </li>
        <li>
          <Link href="/grade/san-diego">San Diego, CA</Link>: beach proximity,
          plus the specific beach (PB, La Jolla, Coronado) — these aren't
          interchangeable to guests.
        </li>
        <li>
          <Link href="/grade/outer-banks">Outer Banks, NC</Link>: oceanfront vs
          sound-side is a binary the guest cares about. State it explicitly,
          plus bedroom count.
        </li>
        <li>
          <Link href="/grade/myrtle-beach">Myrtle Beach, SC</Link>: oceanfront
          unit + pool + family amenities. It's a high-volume mid-ADR family
          market; over-stylize at your peril.
        </li>
      </ul>

      <h2>The "lead with the neighborhood" markets</h2>
      <p>
        Major metros are too big for "in [city]" framing — guests filter at the
        neighborhood level. Lead with the neighborhood + one specific signal.
      </p>
      <ul>
        <li>
          <Link href="/grade/new-york">New York, NY</Link>: neighborhood is
          everything. "Williamsburg loft · 2BR · rooftop access" beats "Cozy
          Brooklyn 2BR." Local Law 18 has compressed legal supply, so listings
          that survived need to convert hard.
        </li>
        <li>
          <Link href="/grade/los-angeles">Los Angeles, CA</Link>: same — the
          neighborhood (Silver Lake, Venice, WeHo, DTLA) communicates the
          experience. Pair with one outdoor or design signal.
        </li>
        <li>
          <Link href="/grade/san-francisco">San Francisco, CA</Link>: small
          legal supply means premium-ADR survivors. Title needs to justify the
          price — neighborhood + view or proximity to a landmark.
        </li>
        <li>
          <Link href="/grade/austin">Austin, TX</Link>: downtown access or
          pool/hot-tub angle. Generic 2BR-in-Austin gets buried.
        </li>
        <li>
          <Link href="/grade/denver">Denver, CO</Link>: permitted-listing
          markets reward leading with the permit-prominence ("STR-permitted ·
          15min to mountains · 2BR").
        </li>
      </ul>

      <h2>The "lead with the calendar" markets</h2>
      <p>
        Resort/seasonal markets are about <em>when</em>, not where. Match the
        title to the season the guest is searching in.
      </p>
      <ul>
        <li>
          <Link href="/grade/park-city">Park City, UT</Link>: in-season,
          ski-in/out or lift distance leads. Off-season, switch to "Main Street
          walkable · 4 bedrooms · summer rate."
        </li>
        <li>
          <Link href="/grade/lake-tahoe">Lake Tahoe, CA</Link>: dual-season
          market. Summer: lake access. Winter: slope proximity. Listings that
          don't seasonally rotate the title leave 30%+ on the table.
        </li>
        <li>
          <Link href="/grade/salt-lake-city">Salt Lake City, UT</Link>: ski
          season is the volume driver. Title with resort distance ("25min to
          Snowbird · Cottonwood-side").
        </li>
        <li>
          <Link href="/grade/nashville">Nashville, TN</Link>: bachelorette
          season has different intent than music-tourism. Lead with rooftop or
          downtown-walkable in spring/fall, with sleeping capacity in
          bachelorette season.
        </li>
        <li>
          <Link href="/grade/orlando">Orlando, FL</Link>: theme-park proximity
          plus bedroom count. "10min to Disney · sleeps 12 · pool" is the form.
        </li>
        <li>
          <Link href="/grade/san-antonio">San Antonio, TX</Link>: River Walk
          distance or large-group amenities. Group-friendly framing
          significantly outperforms generic descriptions in this market.
        </li>
      </ul>

      <h2>The 30-second rule</h2>
      <p>
        Read your current title aloud. If you can swap "Austin" for "Nashville"
        for "Phoenix" without changing anything else and the title still makes
        sense, your title is too generic. The fix isn't to make it longer; it's
        to make it more <em>specific</em>.
      </p>

      <h2>The 50-character cliff</h2>
      <p>
        Airbnb truncates titles at roughly 50 characters on the search-results
        tile. Whatever you put past character 50 doesn't render to the guest.
        Lead with the strongest signal in the first 35 characters; let the rest
        be the bedroom count or location modifier.
      </p>

      <h2>Test yours</h2>
      <p>
        Our <Link href="/grade">free public grader</Link> scores your title
        against this rubric in 10 seconds. It penalizes generic openings and
        rewards specific signals — and tells you exactly which fix would lift
        your title's contribution to ranking the most.
      </p>
      <p>
        Or browse the city-specific pages above to see which signals to lead
        with in your market.
      </p>
    </>
  );
}

function BodyHeroPhoto() {
  return (
    <>
      <p>
        Your hero photo is the single image Airbnb crops onto the search-result
        tile. It's the difference between getting a click and getting scrolled
        past. And because click-through rate is one of the strongest ranking
        inputs in Airbnb's algorithm, the hero photo doesn't just affect this
        booking — it affects every future booking, because it determines whether
        the algorithm shows you to anyone in the first place.
      </p>
      <p>
        Most hosts pick the wrong hero. Here's the rubric for picking the right one.
      </p>

      <h2>What the hero is for</h2>
      <p>
        It's not for showing off the property fairly. It's not for explaining
        what the listing has. Both of those happen further down the carousel.
        The hero is for one job: <strong>making someone stop scrolling</strong>.
      </p>
      <p>
        Stopping the scroll requires the photo to do two things at the same time:
        signal the experience the guest is buying, and look better than the
        photos around it on the search-results page.
      </p>

      <h2>The rule: lead with the buy-signal, not the entry</h2>
      <p>
        Every market has a "buy-signal" — the one feature most guests in that
        market are filtering on. Identify yours and put it on the hero.
      </p>
      <ul>
        <li>Phoenix / Scottsdale: pool</li>
        <li>Joshua Tree: design + outdoor space</li>
        <li>Asheville / Gatlinburg / Broken Bow: hot tub or mountain view</li>
        <li>Miami / Destin: ocean, beach, or pool</li>
        <li>Savannah / Charleston: porch, courtyard, or historic exterior</li>
        <li>Park City / Lake Tahoe (winter): ski-in/out moment or snow exterior</li>
        <li>Nashville: rooftop, downtown skyline, or design moment</li>
        <li>NYC / SF: view from window, neighborhood-iconic exterior</li>
      </ul>
      <p>
        If your listing's hero is currently the entryway, the bedroom, or a wide
        shot of the living room, swap it. Even if those rooms are objectively
        the most photogenic, they're not the buy-signal.
      </p>

      <h2>Frame for the search-tile crop</h2>
      <p>
        Airbnb crops aggressively — usually to a 4:3 or 1:1 aspect ratio
        depending on device. If your hero photo's subject is at the edge of the
        frame, it'll get cropped out.
      </p>
      <p>
        Composition rule of thumb: put the buy-signal subject in the center 60%
        of the frame, with breathing room around it. A pool with a deck visible
        on three sides survives any crop. A pool tucked into a corner of the
        frame doesn't.
      </p>

      <h2>Time of day matters more than camera</h2>
      <p>
        A phone-shot hero at golden hour outperforms a $2k camera-shot hero at
        noon. Soft, warm, directional light — the kind you get 90 minutes before
        sunset — flatters every space. Harsh midday light produces blown-out
        windows, muddy shadows, and color that reads orange and cold.
      </p>
      <p>
        If you can't reshoot, color-grade the existing hero toward warmer
        midtones and bumped saturation. The lift from re-grading alone is real,
        and the work is policy-compliant (color/exposure adjustments are
        explicitly permitted).
      </p>

      <h2>Avoid: people, pets, hosts</h2>
      <p>
        Even though it's not explicitly against Airbnb's policy, putting people
        in the hero hurts conversion. Guests want to picture themselves in the
        space, and people in the photo block that. The host's headshot belongs
        in the host profile, not the listing carousel.
      </p>

      <h2>Avoid: night photos with interior lights</h2>
      <p>
        Tungsten interior lighting photographs orange and reads cheap. The only
        exception is a hot-tub or fire-pit detail shot at twilight, where the
        light contrast is the entire subject. Hero photos should be daylight,
        period.
      </p>

      <h2>Test it</h2>
      <p>
        Open Airbnb's app, search your city, and scroll past 30 listings. Note
        which hero photos make you stop. Compare them to yours.
      </p>
      <p>
        Then run your URL through our <Link href="/grade">free grader</Link> —
        the photo score isolates hero quality and tells you exactly where you
        sit.
      </p>
    </>
  );
}

function BodyDescriptionThatConverts() {
  return (
    <>
      <p>
        Most Airbnb descriptions read like apology notes. They lead with policies,
        list amenities, and close with a polite sign-off. None of those things
        belong at the top.
      </p>
      <p>
        The first 120 characters of your description show before the "more"
        expand on Airbnb's detail page. That's the highest-leverage real estate
        you have for description conversion. Use it to plant
        <em> one sensory detail</em> that lands the place in the reader's
        imagination.
      </p>

      <h2>The structure: Hook, Proof, Call</h2>

      <h3>Hook (1–2 sentences, leads)</h3>
      <p>
        One sensory detail. What does the morning view look like? What's the
        sound from the porch? What's the first thing a guest reaches for when
        they walk in? Specific, concrete, sensory.
      </p>
      <p>
        Bad: "Beautiful 2BR in Austin with all the amenities you need."
      </p>
      <p>
        Good: "Wake up to morning light through the live oaks, walk five
        minutes to South Congress for breakfast."
      </p>

      <h3>Proof (3–5 sentences)</h3>
      <p>
        Concrete amenities, layout, what's included. Bed configuration. Walkable
        landmarks with specific minutes. What you stocked in the kitchen. What
        the parking situation is. The proof section is where the buying decision
        gets made — the hook earned the read; the proof closes it.
      </p>
      <p>
        Bullet points are fine here. So is dense paragraph form. What matters is
        specificity. "Walking distance to restaurants" is forgettable. "Three
        coffee shops within four blocks, two with outdoor seating" is bookable.
      </p>

      <h3>Call (1–2 sentences, closes)</h3>
      <p>
        Logistics + reassurance. Self-check-in time. House rules in plain
        English. Any non-obvious quirks (steep stairs, no elevator, dog-friendly
        with $50 fee). Avoid generic "we look forward to hosting you" closings —
        guests already know that.
      </p>
      <p>
        The call's job is to remove last-second friction. Anything that would
        make a guest hesitate at the booking button gets addressed here.
      </p>

      <h2>What to scrap</h2>
      <ul>
        <li>Pricing tier or rate negotiations — Airbnb shows the price prominently elsewhere</li>
        <li>Long house-rules dumps — those have their own dedicated section</li>
        <li>"Welcome to our home" intros — you waste the 120-character preview real estate</li>
        <li>Apologies for what's not included — frame as "what's perfect for"</li>
        <li>Caps-lock urgency ("BOOK NOW!", "DON'T MISS OUT!") — reads desperate</li>
        <li>Emojis in copy — fine in the title's first character; not throughout the description</li>
      </ul>

      <h2>Length</h2>
      <p>
        Airbnb penalizes descriptions under ~150 words on ranking. Past ~250
        words there's diminishing return — guests skim. Aim for 180–220.
      </p>

      <h2>Pull from your reviews</h2>
      <p>
        Your guests describe your place in ways you don't yet describe it.
        Comb through the last 90 days of reviews and pull the recurring nouns
        and adjectives. Those words should appear in your description (and in
        your title, where they fit). It's the most reliable lift you can get
        from copy alone.
      </p>

      <h2>Concrete example</h2>
      <p>
        A real before/after we worked on for a Nashville listing:
      </p>
      <p>
        <strong>Before:</strong> "Welcome to our beautiful 2BR home located in
        Nashville. We have everything you need including WiFi, a fully equipped
        kitchen, parking, and easy access to downtown. Perfect for couples or
        small families. Please respect house rules and check-in time. We look
        forward to hosting you!"
      </p>
      <p>
        <strong>After:</strong> "The porch swing on this 1920s East Nashville
        bungalow is where every morning starts — coffee, slow light through the
        magnolia. Two bedrooms (queen + king), full kitchen stocked for cooking,
        secure parking off-street. Five Points walkable in seven minutes; eight
        minutes by Lyft to Lower Broadway. Self-check-in after 4pm; quiet hours
        after 10."
      </p>
      <p>
        Same property. Same amenities. Different first impression — and roughly
        20% more bookings in the 30 days after the rewrite.
      </p>

      <h2>Test yours</h2>
      <p>
        <Link href="/grade">Paste your URL into our grader</Link> — the copy
        score breakdown tells you which of the three sections (hook, proof,
        call) is hurting you most.
      </p>
    </>
  );
}

function BodyPricingStrategy() {
  return (
    <>
      <p>
        Pricing is the single biggest decision you'll make as a new Airbnb host,
        and the one most likely to get expensive subscription advice from tools
        that aren't necessary at your stage. PriceLabs, Wheelhouse, and Beyond
        are great products — they're just not what you need in your first 90 days.
      </p>
      <p>
        Here's a 30-day pricing path that gets you to your first 5–10 bookings
        with no subscription, and sets you up to evaluate whether automated
        pricing is worth it after you have actual booking data.
      </p>

      <h2>Step 1: Pull your comp set (Day 0, 30 minutes)</h2>
      <p>
        Open Airbnb in incognito. Search your city + your listing's exact dates
        for a typical Saturday three weeks out. Filter by:
      </p>
      <ul>
        <li>Bedrooms = your bedroom count</li>
        <li>Type of place = your type (entire home / private room)</li>
        <li>Distance ≈ within 1 mile of your address</li>
      </ul>
      <p>
        Pull the first 20 listings that match. Note their nightly rates in a
        spreadsheet. Compute the median, the 25th percentile, and the 75th
        percentile.
      </p>

      <h2>Step 2: Anchor to the comp median, then discount (Day 0)</h2>
      <p>
        Set your nightly rate at <strong>15% below the comp median</strong>.
        Yes, you're underpricing on purpose. Reason: you have zero reviews, no
        history, no Superhost. The 15% discount is the price you pay to break
        the cold-start.
      </p>
      <p>
        At first you may bristle at this. You shouldn't. The math: 15% off ten
        bookings is more revenue than zero off two bookings. The point of the
        first 30 days is reviews, not profit.
      </p>

      <h2>Step 3: Different weekday vs weekend rate (Day 0)</h2>
      <p>
        Most new hosts forget this. Weekend nights (Fri/Sat) should be 25–40%
        higher than weeknights. Look at your comp set's weekend rates — they're
        a different distribution than weeknights. Anchor weeknights to the
        weeknight comp median (minus 15%); weekends to the weekend median
        (minus 15%).
      </p>

      <h2>Step 4: After every 3 reviews, raise 5% (Days 7–30)</h2>
      <p>
        Once you've cleared 3 reviews — and they're not below 4.5 — raise both
        weeknight and weekend rates by 5%. Repeat after every 3 more reviews
        until you're at the comp median (i.e., you've burned off the 15% cold-
        start discount over ~6 reviews).
      </p>
      <p>
        This is the part most pricing tools handle automatically. You can do it
        manually with a Google Calendar reminder for the first 30 days; it'll
        cost you 10 minutes a week.
      </p>

      <h2>Step 5: Watch your search-result CTR (continuous)</h2>
      <p>
        If you're priced 15% below the comp median and you're still not getting
        bookings, the price isn't the problem — your photos or title are. Most
        hosts try a price drop first because it's the easiest lever, but it
        rarely fixes a click-through-rate problem.
      </p>
      <p>
        Run our <Link href="/grade">free grader</Link> to isolate which
        component (photos, copy, signals) is dragging your conversion. Don't
        cut price below comp-median-minus-15% until photos and title score
        80+.
      </p>

      <h2>Step 6: Block-out the dates you don't want bookings (Day 0)</h2>
      <p>
        Counterintuitive: blocking dates raises your effective conversion rate
        on the dates you do offer. Airbnb's algorithm favors listings with
        active calendar management. If you only want weekends, block all
        weekdays. If you only want stays of 3+ nights, set the minimum-night
        cap accordingly.
      </p>

      <h2>What this beats</h2>
      <ul>
        <li>"Smart pricing" (Airbnb's free auto-tool) — generally too aggressive on the low side, costs you ADR</li>
        <li>PriceLabs / Wheelhouse / Beyond — these are great after 20+ reviews and 30+ bookings, when they have history to optimize. Before then they're overkill and expensive</li>
        <li>Setting a single flat rate for the year — leaves money on weekends and during local events</li>
      </ul>

      <h2>When to graduate to dynamic pricing</h2>
      <p>
        Once you've cleared roughly 20 reviews and 30 paid bookings — typically
        4–6 months in — switch on a dynamic pricing tool. PriceLabs at $20/mo
        is the dominant choice. By then you have enough booking history that the
        tool can do useful optimization, and the subscription cost is small
        relative to the lift.
      </p>
      <p>
        Until then, the manual 6-step playbook above gets you to break-even
        faster than any tool would.
      </p>

      <h2>The Restay angle</h2>
      <p>
        Pricing is the third leg of our $79 Tune-Up — alongside copy rewrite
        and photo restyle, we generate a 30-day pricing recommendation based
        on 50+ comps within a kilometer of your listing. It's a one-time
        deliverable; we don't auto-reprice. <Link href="/host">See the
        Tune-Up</Link>.
      </p>
    </>
  );
}

function BodyCancelResponseRate() {
  return (
    <>
      <p>
        Most of Airbnb's ranking algorithm is opaque — the company refuses to
        publish weights or specifics, and most "ranking factor" guides are
        speculation. But two factors they <em>do</em> tell you about explicitly:
        cancel rate and response rate. They're worth understanding because the
        thresholds are sharp and the penalties are severe.
      </p>

      <h2>Response rate and time</h2>
      <p>
        Airbnb's stated standard for Superhost and for "good standing" generally
        is a 90%+ response rate within 24 hours. In practice the algorithm
        prefers under-1-hour responses, and listings that respond in over 24
        hours get visibly de-ranked.
      </p>
      <p>
        The cost of slow response: you're not just penalized on this guest's
        booking decision (they often book a faster-responding listing in the
        meantime). You're penalized on every future search where the algorithm
        decides whether to surface you. Slow response compounds.
      </p>
      <p>
        The fix is operational, not strategic:
      </p>
      <ul>
        <li>Push notifications on for both the Airbnb mobile app and email</li>
        <li>Saved replies for the 5–10 questions guests ask most often</li>
        <li>If you have a co-host or VA, give them the credentials and pay them per response</li>
      </ul>

      <h2>Acceptance rate</h2>
      <p>
        Acceptance rate = the percentage of booking requests you accept (vs.
        decline). Below 88%, ranking starts dropping. Below 80%, it drops
        materially.
      </p>
      <p>
        The structural fix: turn on <Link href="/blog/airbnb-instant-book-should-you-turn-it-on">Instant Book</Link>{" "}
        with the right minimum-night and lead-time settings so the requests
        that come in are pre-filtered to ones you'd accept anyway. This makes
        decline mostly unnecessary.
      </p>

      <h2>Cancel rate</h2>
      <p>
        Host-initiated cancellations are the highest-cost mistake you can make
        on Airbnb. Three host-initiated cancellations in a year and you lose
        Superhost. More than that and you start getting search penalties that
        take 90+ days to recover from.
      </p>
      <p>
        The expensive scenario: you accept a booking, then realize you have to
        block those dates (family emergency, surprise renovation, double-booked
        on Vrbo). You cancel the Airbnb booking. That's a hit.
      </p>
      <p>
        Two preventions:
      </p>
      <ol>
        <li>Single-source-of-truth calendar. If you list on multiple platforms, channel-manager (Hospitable, iGMS, Hostaway) the calendars together. Manual sync fails.</li>
        <li>Block dates BEFORE you accept. Don't take a booking and then realize you needed those nights — block proactively for any date you're not 100% sure you can host.</li>
      </ol>

      <h2>What about guest cancellations?</h2>
      <p>
        Guest-initiated cancellations don't ding your ranking. So if you have a
        problem booking and want it gone, the right play is to ask the guest to
        cancel (offer to message Airbnb support together to make it happen) —
        not to cancel yourself. The friction is real but the ranking cost
        is zero.
      </p>

      <h2>Recovery if you've already crossed thresholds</h2>
      <p>
        If you've slipped on response time or acceptance rate, recovery takes
        roughly 60–90 days. The algorithm reads a rolling window. Get clean for
        two months and you'll be back where you started.
      </p>
      <p>
        If you've cancelled three times in a year, recovery is harder. Don't
        cancel a fourth — that's where things get permanent.
      </p>
      <p>
        These three operational metrics, plus consistent <Link href="/blog/why-isnt-my-airbnb-getting-bookings">listing freshness</Link>,
        cover most of what's actually under your control on the algorithm side.
        Photos and copy are the levers that move the needle once these are clean.
      </p>
      <p>
        <Link href="/grade">Grade your listing free</Link> — the grader doesn't
        score these operational metrics (they're tied to your account, not your
        listing), but it shows you exactly where photos and copy stand.
      </p>
    </>
  );
}

function BodyPhotosLookPhoneShot() {
  return (
    <>
      <p>
        The honest answer: it's almost never the camera. The photos that look
        magazine-grade in your comp set were probably shot on the same iPhone
        you have, just with three things you didn't do.
      </p>

      <h2>1. Wrong time of day</h2>
      <p>
        Phone-shot photos read flat because they're usually shot at noon, when
        the light is harsh and overhead. Even a $5,000 camera produces flat
        photos under that light.
      </p>
      <p>
        The fix: shoot 90 minutes before sunset. Soft directional light flatters
        every interior. If you can't reshoot, color-grading toward warmer
        midtones in post simulates the same effect — phone apps like Snapseed,
        Lightroom Mobile, and Halide all do this in one slider.
      </p>

      <h2>2. Wrong height and angle</h2>
      <p>
        Phone shots default to eye-level. Pro real estate photos are shot from
        chest height (~4 feet), camera tilted slightly down. The lower angle
        makes ceilings feel taller and rooms feel bigger.
      </p>
      <p>
        The fix: hold your phone at chest height, tilt the lens so the back
        wall is centered in the frame, lock exposure on a mid-tone (not a
        bright window).
      </p>

      <h2>3. Cluttered foregrounds</h2>
      <p>
        The thing that most reads as "amateur" isn't lighting or composition —
        it's the visible cables, remotes, half-empty water glasses, unfolded
        throws, and laundry baskets at the edge of the frame.
      </p>
      <p>
        The fix is mechanical: before you shoot, walk the room with a tray.
        Remove everything that isn't furniture. The same room that read
        cluttered now reads spare and considered.
      </p>

      <h2>4. Window blowout</h2>
      <p>
        Modern phones have HDR but most hosts shoot in standard mode. Bright
        windows blow out white, killing the otherwise-decent photo.
      </p>
      <p>
        The fix: enable HDR. Or shoot two exposures (one for room, one for
        window) and composite. Or accept the blowout in-camera and use a
        post-processing tool to recover it. Sky replacement on blown windows is
        explicitly permitted under Airbnb's photo policy.
      </p>

      <h2>5. Wrong horizontal/vertical orientation</h2>
      <p>
        Vertical photos crop horribly on Airbnb's wide search-result tile. Even
        if your photo is great, if it's vertical it loses 60% of its frame to
        the crop. Always shoot horizontal for room shots.
      </p>

      <h2>6. Color cast</h2>
      <p>
        Indoor lighting is usually warm (3000K). Without manual white-balance
        correction, your photos read orange or yellow. The fix is one
        white-balance slider in any photo editor, dragged toward neutral.
      </p>

      <h2>The 30-minute restyle</h2>
      <p>
        For an existing set, walk through this in order:
      </p>
      <ol>
        <li>Open each photo in Snapseed or Lightroom Mobile</li>
        <li>White balance: drag slightly cool to remove yellow</li>
        <li>Exposure: lift shadows, drop highlights to recover window detail</li>
        <li>Color: slight saturation boost (+10), slight vibrance lift</li>
        <li>Crop horizontal if shot vertical, with ample headroom</li>
        <li>Sharpen subtly (+10)</li>
      </ol>
      <p>
        Save originals. Re-upload to Airbnb. Most hosts see a noticeable
        click-through bump within 14 days, just from this.
      </p>

      <h2>The Restay angle</h2>
      <p>
        We do this work at scale — 10 photos restyled in 4 hours, edit-only,
        $79. We never add or remove furniture (Airbnb policy compliant). If
        DIY-ing is the wrong call for you, that's our pitch. <Link href="/host">See the Tune-Up</Link>.
      </p>
      <p>
        Or run your URL through the <Link href="/grade">free grader</Link> first
        — the photo score isolates exactly which of these issues your set has.
      </p>
    </>
  );
}

function BodyInstantBook() {
  return (
    <>
      <p>
        Instant Book is one of Airbnb's strongest ranking levers — listings with
        IB on get pushed to the top of search results when guests filter for
        "Instant Book" (which most guests do, by default). Estimates from
        analytics tools put the ranking lift at 10–20%.
      </p>
      <p>
        But IB has real trade-offs. The honest answer depends on where you are
        in your hosting journey.
      </p>

      <h2>Brand-new hosts (0 reviews)</h2>
      <p>
        <strong>Turn it on.</strong> The reasoning: you have nothing to protect
        yet. The risk of getting a problem guest is real, but the cost of not
        getting bookings at all is higher. The first 5 reviews are the hardest
        to get; IB shortens that ramp materially.
      </p>
      <p>
        Set the IB filters tight: minimum 2-night stay, no same-day bookings,
        require ID verification. Those filters remove ~80% of problem-guest
        risk while still capturing the ranking benefit.
      </p>

      <h2>Ramping hosts (5–30 reviews)</h2>
      <p>
        <strong>Keep it on, tighten as you learn.</strong> By now you have a
        sense of which guest profiles cause issues for your specific listing
        (party houses, corporate stays, families with toddlers, etc.). Adjust
        the IB filters to exclude those — Airbnb lets you require positive
        reviews from past hosts, certain age ranges (with limits), and minimum
        notice.
      </p>

      <h2>Established hosts (30+ reviews, Superhost)</h2>
      <p>
        <strong>Honest answer: depends.</strong> Two scenarios:
      </p>
      <p>
        <em>Scenario A — you're at high occupancy already (over 80%).</em> Turn
        IB off. You don't need the ranking bump (you're booking through), and
        the trade-off — accepting bookings without a manual review — costs you
        more than it earns at this volume.
      </p>
      <p>
        <em>Scenario B — you're at moderate occupancy (50–75%).</em> Keep IB
        on. The ranking lift still translates to revenue lift at your volume.
        Use the tightened filters from the ramping section.
      </p>

      <h2>The hidden cost: cancellation strikes</h2>
      <p>
        With IB on, you have a limited number of penalty-free cancellations
        per year (currently 3 per the IB exception policy: emergencies,
        infrastructure issues, guest-trust violations). Use one and the next
        cancellation hurts.
      </p>
      <p>
        If you find yourself wanting to cancel an IB booking more than 3 times
        a year, your filters are wrong. Tighten them.
      </p>

      <h2>How to cancel an IB booking without penalty</h2>
      <p>
        Air real legitimate concerns to Airbnb support before cancelling — the
        "guest-trust violation" exception is broad. Bad-faith messages from
        the guest, mismatched ID, or party-house signals can all qualify. You
        get a fair amount of latitude if you document and ask.
      </p>

      <h2>Bottom line</h2>
      <p>
        For most hosts, IB on + tight filters is the right answer. The ranking
        benefit is real, the operational savings (no decision per request) are
        real, and the downside is mostly mitigatable with the right filter
        configuration.
      </p>
      <p>
        Run our <Link href="/grade">free grader</Link> to see where your listing
        sits on conversion-side signals — IB primarily affects ranking; the
        grader covers what affects clicks once you're in the search results.
      </p>
    </>
  );
}

function BodyDirectBooking() {
  return (
    <>
      <p>
        Every STR coach eventually pitches the same idea: build a direct-booking
        site, escape Airbnb's 15% fee, own your guest data. The math sounds
        clean. The reality is murkier.
      </p>
      <p>
        Direct booking is the right move for some hosts and the wrong move for
        most. Here's the honest economic picture.
      </p>

      <h2>What you're trading</h2>
      <p>
        <strong>What you save:</strong> Airbnb's 15% guest service fee + 3%
        host service fee. On a $200/night booking, that's about $36.
      </p>
      <p>
        <strong>What you pay:</strong> a direct-booking platform (Hostaway,
        Lodgify, or a custom site) at $30–80/mo, payment processing fees
        (~3%), email/SMS marketing tools, and — most importantly — the cost of
        replacing Airbnb's distribution. That last one is the line item most
        coaches don't mention.
      </p>

      <h2>The crossover math</h2>
      <p>
        Airbnb sends you guests for free (in the fee sense). Direct booking
        means you have to acquire guests yourself. Acquisition costs:
      </p>
      <ul>
        <li>Paid ads: $20–40 CPA at the cheap end, $80+ for premium markets</li>
        <li>Email marketing: free per send, but you needed to capture the email first (back to acquisition)</li>
        <li>Repeat guests: cheapest, but only meaningful if you have 100+ past guests</li>
        <li>SEO: high effort, slow payoff, but free at scale</li>
      </ul>
      <p>
        For most hosts under 50 past guests, the acquisition cost of replacing
        Airbnb's distribution is higher than the 15% fee Airbnb charges. So
        you don't actually save — you pay more, while losing the trust signal
        Airbnb provides to skeptical first-time guests.
      </p>

      <h2>When direct booking actually works</h2>
      <ol>
        <li>You have 100+ past guests with email addresses (you've been hosting 3+ years)</li>
        <li>You're in a market where guests rebook (cabins, beach houses, retreat properties)</li>
        <li>You have multiple listings (the platform fee amortizes; one website serves your portfolio)</li>
        <li>You can credibly produce or hire content for SEO and email</li>
      </ol>
      <p>
        If you have all four, direct booking pencils. If you have two or fewer,
        it doesn't.
      </p>

      <h2>The hybrid approach</h2>
      <p>
        Most successful hosts run hybrid: keep Airbnb (and Vrbo) as the primary
        channel for cold-start, build direct-booking for repeat guests. The
        direct-booking site exists; you push past guests to it via post-stay
        email. New guests still come from Airbnb.
      </p>
      <p>
        On the hybrid math: you save the 15% fee on direct repeat bookings only,
        but you don't pay extra acquisition cost since the guest already knows
        you. That's where the savings actually show up.
      </p>

      <h2>The tools</h2>
      <p>
        For hybrid: Hospitable's direct-booking site builder is the easiest path
        ($30–60/mo, integrated with their channel manager). Lodgify is more
        flexible but more setup. Boostly is a higher-touch option at higher
        cost.
      </p>
      <p>
        Whatever you choose, don't pay for direct-booking software until you
        have actual past-guest list to send to it. The classic mistake is
        building the infrastructure first and then realizing there's no
        audience.
      </p>

      <h2>Bottom line</h2>
      <p>
        Direct booking saves you 15% on bookings you can already make. It
        doesn't help you make bookings you couldn't already make. Stay on
        Airbnb until you have repeat-guest economics. Then layer direct booking
        on top.
      </p>
      <p>
        Until then, the highest-leverage move is making your Airbnb listing
        convert better at the source. <Link href="/grade">Grade your
        listing free</Link>.
      </p>
    </>
  );
}

export const POST_BODIES: Record<string, ComponentType> = {
  "why-isnt-my-airbnb-getting-bookings": BodyWhyNoBookings,
  "airbnb-search-ranking-factors": BodyRankingFactors,
  "airbnb-listing-photos-dos-and-donts": BodyPhotosDosAndDonts,
  "how-often-should-i-update-my-airbnb-listing": BodyUpdateCadence,
  "is-virtual-staging-allowed-on-airbnb": BodyVirtualStaging,
  "airbnb-title-formulas-by-market": BodyTitleFormulas,
  "airbnb-hero-photo-what-it-should-be": BodyHeroPhoto,
  "how-to-write-airbnb-description-that-converts": BodyDescriptionThatConverts,
  "30-day-pricing-strategy-new-hosts": BodyPricingStrategy,
  "cancel-rate-response-rate-algorithm": BodyCancelResponseRate,
  "why-your-photos-look-phone-shot": BodyPhotosLookPhoneShot,
  "airbnb-instant-book-should-you-turn-it-on": BodyInstantBook,
  "when-to-switch-from-airbnb-to-direct-booking": BodyDirectBooking,
};

// Surface CITY_TARGETS reference so future rewrites can iterate from a single
// canonical list — currently consumed via inline links, lint-clean.
void CITY_TARGETS;
