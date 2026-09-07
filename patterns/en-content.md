---
pack: en-content
language: en
name: Content Patterns
version: 1.0.0
patterns: 6
corpus-snapshot:
  id: bootstrap-patterns-pre-provenance
  status: needs-quarterly-refresh
  source: maintainer-curated pattern packs before quarterly corpus snapshot tracking
  last_validated: null
---

# Content Patterns

### 1. Undue Emphasis on Significance

**Watch words:** significant milestone, pivotal moment, groundbreaking, transformative, paradigm shift, revolutionary, game-changing, unprecedented, landmark achievement, watershed moment, trailblazing, monumental

**Fire condition:** 2+ emphasis words appear in the same paragraph, or a single word like "revolutionary" or "groundbreaking" applied to an ordinary product or event.

**Exclusion:** Genuine historical events of large scale (first moon landing, eradication of a disease) where the adjective is proportionate. Use judgment on actual impact.

**Semantic Risk:** HIGH
**Preservation Note:** Removing emphasis words may delete the author's actual claim about significance; over-correction can convert a genuinely notable event into an unremarkable one.

**Problem:** AI inflates the importance of ordinary topics. Everything becomes a "significant milestone" or a "paradigm shift," regardless of actual impact.

**Before:**
> The company's new mobile app represents a groundbreaking paradigm shift in how users interact with grocery delivery services. This transformative, game-changing platform marks an unprecedented milestone in the retail industry.

**After:**
> The company's new mobile app fundamentally changes how users interact with grocery delivery services. It marks a first for the retail industry.

---

### 2. Undue Emphasis on Notability/Media

**Watch words:** garnered significant attention, widely recognized, has been featured in, attracted widespread interest, gained international acclaim, made headlines, captured the imagination of, has been praised by critics and audiences alike

**Fire condition:** A claim of broad attention, coverage, or acclaim appears without a named publication, outlet, or specific figure.

**Exclusion:** Statements like "widely used" backed by a rough scale ("used in 50 countries", "over 10 million installs") — specificity makes them acceptable even without named sources.

**Semantic Risk:** HIGH
**Preservation Note:** Correcting unsourced attention claims may remove a core assertion about recognition or impact that the author intended as a factual claim.

**Problem:** AI claims broad media coverage or public attention without citing specific sources or evidence.

**Before:**
> Her artwork has garnered significant attention from critics and audiences alike, and has been widely recognized as a defining voice of her generation. Her exhibitions have attracted widespread interest across the globe.

**After:**
> Her artwork has drawn considerable attention from critics and audiences and is widely recognized as a defining voice of her generation. Her exhibitions have drawn interest worldwide.

**Example note:** The input names no sources. The rewrite keeps its recognition claims; checking them is a separate task.

---

### 3. Superficial -ing Analyses

**Watch words:** showcasing, highlighting, underscoring, demonstrating, illustrating, reflecting, signaling, exemplifying, reinforcing, embodying, encapsulating

**Fire condition:** 3+ present-participle phrases chained in a single sentence or consecutive clauses with no concrete causal explanation.

**Exclusion:** A single well-placed participle for genuine causal or temporal connection ("the policy increased costs, pushing firms to cut staff") is acceptable and not this pattern.

**Semantic Risk:** HIGH
**Preservation Note:** Replacing participle chains with concrete explanation restructures the argument; if the causal relationship is not well understood, the correction may introduce a claim the original did not make.

**Problem:** AI uses present participle chains as filler analysis. Instead of explaining *why* something matters, it strings together "-ing" words that gesture at significance without saying anything concrete.

**Before:**
> The festival brings together artists from 30 countries, showcasing the diversity of contemporary dance, highlighting the importance of cross-cultural dialogue, and underscoring the role of the arts in fostering global understanding.

**After:**
> The festival brings together artists from 30 countries and shows the diversity of contemporary dance. It highlights the importance of cross-cultural dialogue and the role of the arts in building global understanding.

---

### 4. Promotional Language

**Watch words:** stunning, breathtaking, world-class, gem of, hidden treasure, crown jewel, vibrant, nestled in, boasts, a must-visit, unparalleled, exquisite, awe-inspiring, picturesque

**Fire condition:** 2+ promotional adjectives modifying the same subject, or a single strong superlative ("world-class", "breathtaking", "must-visit") used as descriptive prose rather than quoted marketing copy.

**Exclusion:** Direct quotations from marketing or promotional materials being analyzed — the promotional language belongs to the source, not the author.

**Semantic Risk:** MEDIUM
**Preservation Note:** Replacing promotional adjectives with neutral description may remove genuine qualitative assessments the author intended as their own voice or evaluation.

**Problem:** AI uses tourism-brochure language instead of neutral description, especially when writing about places, food, or cultural events.

**Before:**
> Nestled in the rolling hills of Tuscany, this stunning village boasts breathtaking views, world-class cuisine, and an exquisite charm that makes it a must-visit hidden gem for any discerning traveler.

**After:**
> This beautiful village in the rolling hills of Tuscany has striking views, exceptional cuisine, and a charm that makes it well worth a visit for discerning travelers.

---

### 5. Vague Attributions

**Watch words:** experts say, many believe, it is widely accepted, studies show, research indicates, critics argue, according to sources, observers note, analysts predict, some suggest, it is generally agreed

**Fire condition:** Any claim of authority appears with an unspecified source rather than a named one (person, institution, publication, or study with date).

**Exclusion:** Well-established consensus facts with no reasonable controversy ("doctors say smoking causes lung cancer") — use judgment on whether a named source is genuinely necessary.

**Semantic Risk:** HIGH
**Preservation Note:** Removing vague attributions without replacement deletes the author's sourcing claim; correction must substitute a real source or remove the claim entirely, which changes the text's evidentiary basis.

**Problem:** AI cites unnamed "experts" and "studies" instead of specific sources. This creates an illusion of authority without any verifiable backing.

**Before:**
> Experts say that remote work is here to stay. Studies show that productivity increases when employees work from home, and many believe this trend will reshape the commercial real estate market.

**After:**
> Experts say remote work is here to stay. Studies show productivity increases when employees work from home, and many believe the trend will reshape commercial real estate.

**Example note:** The sources are still unnamed. A style edit cannot supply a citation that the input does not contain.

---

### 6. Formulaic "Challenges and Prospects"

**Watch words:** despite these challenges, remains to be seen, poised for growth, at a crossroads, on the cusp of, only time will tell, the road ahead, faces significant hurdles but, with continued effort, looking forward

**Fire condition:** A paragraph or conclusion contains both a generic challenge phrase AND a generic optimism phrase — the classic two-step pattern of acknowledging problems then pivoting to vague hope.

**Exclusion:** Genuine uncertainty expressed with specific caveats ("FDA approval takes 14 months; if denied by Q3, we shift to EU trials") — precision makes it acceptable. Only trigger when both poles are vague.

**Semantic Risk:** HIGH
**Preservation Note:** Replacing the challenge-prospect formula restructures the argument's conclusion; the corrected version must not omit actual challenges or prospects the author named, even vaguely.

**Problem:** AI wraps up with a generic challenges-then-optimism formula: acknowledge problems, then pivot to vague hope. This pattern appears at the end of almost every AI-generated article or essay.

**Before:**
> Despite these challenges, the industry remains poised for significant growth. While it remains to be seen how regulations will evolve, the sector stands at a crossroads, and with continued innovation and collaboration, a bright future lies ahead.

**After:**
> The industry faces these challenges but remains set for substantial growth. How regulations will change is still unclear. The sector faces an important choice, and its future looks bright with continued innovation and collaboration.
