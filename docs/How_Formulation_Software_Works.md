# How Formulation Software Works — A Plain-English Guide for Enova

_Written to explain, from the ground up, how platforms like Trustwell Genesis and Path Forward Formulator generate product-specific formulations — the database, the query layer, the algorithms, the stack — and how the Enova Brain you're building compares. No prior computer-science vocabulary assumed; every term is defined as it appears._

---

## The one idea to hold onto

Every formulation platform ever built — Genesis, Path Forward Formulator, the feed-mill software the poultry industry has used for 50 years, and the Enova Brain — is the **same four layers stacked on top of each other**:

```
   ┌─────────────────────────────────────────────┐
   │  4. OUTPUT     labels · spec sheets · quotes │   what a human sees
   ├─────────────────────────────────────────────┤
   │  3. ENGINE     the algorithms that BUILD +   │   the "smarts"
   │                COST a formula                │
   ├─────────────────────────────────────────────┤
   │  2. QUERY      the way software asks the      │   the "waiter"
   │                database questions (the API)   │
   ├─────────────────────────────────────────────┤
   │  1. DATA       the database: ingredients,     │   the "vault"
   │                nutrients, costs, suppliers    │
   └─────────────────────────────────────────────┘
```

If you understand these four layers, you understand every product in this category. The companies differ only in **how good each layer is** and **whose data fills layer 1**. Let's walk up the stack.

---

## Layer 1 — The DATA (the database). This is the real asset.

A **database** is just an organized store of information that software can read and write quickly. Think of it as a set of spreadsheets that are wired together and that thousands of things can safely use at once.

A formulation database holds a handful of core **tables** (a table = one spreadsheet-like list of records, e.g. "all ingredients," "all suppliers," "all formulas"):

- **Ingredient master** — the spine of the whole system. One row per ingredient. Each row carries everything known about that ingredient: its name, its **nutrient profile** (how much of each vitamin/mineral/macronutrient is in a gram of it), its **potency** (e.g. "Zinc Gluconate is 14% elemental zinc"), allergens, physical properties, and regulatory info.
- **Cost / price data** — what each ingredient costs, often per supplier, often changing over time.
- **Supplier data** — who sells what, at what price, with what documentation (COAs — Certificates of Analysis).
- **Formulas (recipes)** — each finished product: the list of ingredients and their amounts.
- **Labels / specs** — the generated Supplement Facts panels and specification sheets.

A few vocabulary words that unlock a lot:

- **Record / row**: one entry (one ingredient, one formula).
- **Field / column**: one attribute of a record (an ingredient's cost, its potency).
- **Primary key**: the unique ID for a row, so nothing is ambiguous. Your project numbers (`P26205`) are primary keys. MISys ALT codes (`ALT-RP-0529`) are primary keys for ingredients.
- **Foreign key**: a field in one table that points at a row in another. A formula's ingredient line points at an ingredient row by its ALT code — that pointer is a foreign key. It's how the tables are "wired together."
- **Normalization**: the discipline of storing each fact exactly once and pointing at it, instead of copying it everywhere. If sugar's cost is stored once in the ingredient master and every formula points at it, then when the price changes you update one place and every formula is instantly correct. Copying the price into 400 formulas (the spreadsheet way) is the opposite — and it's why spreadsheets rot.
- **Single source of truth**: the goal that normalization buys you — one authoritative place for each fact.

**Relational vs. document databases** (you'll hear both):

- A **relational database** (Postgres, MySQL, SQL Server) stores those wired-together tables and is queried with a language called **SQL** ("select every ingredient where category = 'Bottle' and cost > 0"). This is the workhorse of the industry.
- A **document database** (MongoDB, or a JSON blob) stores each record as a self-contained document. More flexible, less strict. Your Enova projects are stored this way today — each project is one JSON document in Supabase.
- Supabase (what Enova uses) is **Postgres underneath** (relational) but lets you store JSON documents in a column — so you're using a hybrid, which is common and fine.

### Why layer 1 is the whole ballgame

Here is the single most important strategic fact in this entire guide:

> **The hard, expensive, decades-long asset is the curated ingredient/nutrient database — not the software around it.**

Anyone can write software that adds up numbers. Almost nobody can cheaply reproduce a database that knows the full nutrient profile, potency, allergen status, and regulatory treatment of tens of thousands of ingredients, kept current as regulations change. That curated data is the moat. It's why the incumbents are valuable, and it's the one thing you can't just "code."

Where each player gets its layer-1 data:

- **Genesis (Trustwell / ESHA):** the **ESHA Food & Nutrition Database** — a proprietary library built and maintained since the 1980s, blending USDA data, manufacturer data, and analytical data. This is their crown jewel. It's why nutrition-analysis software is a "buy," not a "build."
- **Path Forward Formulator:** a **supplier-contributed** ingredient database — they've partnered with ~50 ingredient suppliers who make their ingredients "discoverable" inside the platform with specs and pricing. Clever: they get suppliers to populate the moat for them, and it's supplement-specific from the start.
- **Enova Brain (you):** **MISys** for costs and on-hand quantities, plus **your own completed formulas** (the 100+ workbook corpus) for the house base/system standards, plus the **FDA Daily Value table** I encoded for the label engine. You have world-class **cost** data (your own, live, accurate) but you do **not** yet have a curated **nutrient-profile** database — which is exactly the gap we discussed on the Genesis question.

---

## Layer 2 — The QUERY layer (the API). How software asks the database questions.

The database is a vault. Software doesn't reach into the vault directly — it goes through a **query layer**, usually an **API**.

- **API** (Application Programming Interface): a defined "menu" of requests a program can make and the answers it will get back. If the database is a restaurant kitchen, the API is the **waiter and the menu** — you don't walk into the kitchen; you order from a fixed menu and food comes out.
- **Endpoint**: one item on that menu — one URL you can call to do one thing ("get ingredient by code," "create a formula").

There are two dominant styles, and you'll hear both:

- **REST**: many endpoints, each returning a fixed shape of data. Simple, ubiquitous. You call `/ingredients/ALT-RP-0529` and get that ingredient back.
- **GraphQL**: one endpoint, but you send a **query** describing exactly the fields you want, and get back exactly that — no more, no less. You can also send a **mutation** to change data. **Genesis uses GraphQL.** That's why their docs talk about "queries," "mutations," and a `FoodPayload`. GraphQL is popular because the client asks for precisely what it needs in one round trip.

Vocabulary:
- **Query** = a read request ("tell me this").
- **Mutation** = a write request ("change this").
- **Schema** (of an API) = the contract: the exact list of things you're allowed to ask for and their shapes. A well-defined schema is what lets two systems talk without misunderstanding.
- **Authentication / API key**: a secret token that proves you're allowed to use the API (Genesis uses an `X-API-KEY` header). It's the reservation that gets the waiter to serve you.

For Enova today, your "query layer" is the Supabase client library your app uses to read/write projects, plus the **`EnovaBrain` kernel's function signatures** (`EnovaBrain.cost(project, ctx)`, `EnovaBrain.label(project, ctx)`) — those function names and their inputs/outputs are effectively your internal API contract.

---

## Layer 3 — The ENGINE (the algorithms). How a formulation is actually generated.

This is the layer you're really asking about — the "smarts." There are **two fundamentally different ways** software turns "a set of ingredients or a product idea" into "a finished, costed formula." Real platforms use one, the other, or both.

### Paradigm A — Deterministic assembly (rules)

**Deterministic** means: same inputs always produce the same output, by following fixed rules. No guessing, no randomness.

This is how **supplement** formulation mostly works, because a supplement formula is usually **prescriptive** — the customer already tells you the actives and the doses ("500 mg Vitamin C, 5 mg Zinc, per serving"). The software's job isn't to *invent* the formula; it's to **assemble and complete** it correctly:

1. Take the declared actives at their label-claim amounts.
2. Convert claim → weigh-out amount using **potency** (5 mg elemental zinc ÷ 14% = 35.7 mg zinc gluconate to actually weigh).
3. Apply **overage** — deliberately add a few % extra of each active so the product still meets label claim at end of shelf life (vitamins degrade). This is a rule per ingredient.
4. Add the **delivery-system base** for that dose form — the flow agents, anti-caking agents, bulking carrier, gummy base, capsule shell, sweetener/flavor systems. A gummy isn't just its actives; it's actives + a whole base that fills it to weight.
5. **Balance to target** — fill the remainder to the exact serving weight/volume with a carrier (maltodextrin in a powder, sugar/sorbitol in a gummy).
6. Cost every line against live prices, roll up labor + overhead + packaging.

Every step is a rule. This is exactly what Path Forward Formulator means by "automatically handles potency, overage percentages, and manufacturing variants," and it is **precisely what your Enova kernel already does** (`EnovaBrain.formulate`, `gummyBase`, `cost`, `packaging`).

Vocabulary:
- **Algorithm**: a fixed procedure — a recipe of steps — that turns inputs into outputs.
- **Heuristic**: a rule of thumb that's good-enough but not provably optimal ("pick the smallest bottle that fits the fill" — your packaging engine uses heuristics).
- **Deterministic vs. AI**: your kernel is deterministic (auditable, testable, always the same). An AI/LLM is probabilistic (can vary, can't be fully audited). For anything a customer or the FDA relies on, deterministic is the right call — which is the whole philosophy of the Enova Brain.

### Paradigm B — Optimization (least-cost formulation via linear programming)

This is the classic "secret sauce" of the older formulation world (animal feed, then processed food), and it's worth understanding even though supplements use it less.

Here the software **does** invent the formula. You don't specify the ingredients; you specify the **constraints and a goal**, and the software finds the best mix:

- **Objective function**: the single number to minimize or maximize — usually "minimize total cost per batch."
- **Constraints**: the rules the mix must satisfy — "at least 18% protein," "no more than 3% fat," "between 2% and 5% of ingredient X," "total = 1000 kg."
- **Decision variables**: how much of each candidate ingredient to include — the numbers the solver is allowed to change.

A piece of math called **linear programming (LP)** — run by a **solver** (Excel's "Solver" add-in is the teaching version; commercial engines like Format, Brill, and feed-mill software are the industrial version) — then computes the **cheapest possible blend** of available ingredients that still hits every nutritional constraint. It literally searches the space of all valid mixes and returns the lowest-cost one. When ingredient prices change, you re-run it and it may pick a totally different, cheaper recipe. This is a solved, 60-year-old technique — the poultry industry runs on it.

Where this matters for **supplements** (and Enova specifically):
- Supplements rarely need "invent the formula," because the actives are prescribed. **But** optimization is genuinely useful for narrower jobs: *"which supplier/form of magnesium is cheapest to hit 100 mg elemental at this overage?"*, *"choose the bulking carrier blend that hits target weight at least cost,"* or *"least-cost sourcing across suppliers for this exact BOM."* Those are small LP problems you could bolt onto the kernel later.
- Your gummy **displacement model** (bulk sweeteners fill the remainder to exact weight) is a *baby* version of a constraint-satisfaction step — it's solving "make the total equal gummyWt" by construction rather than by a solver. That's fine; it's the deterministic shortcut when the constraint is simple.

So: **Genesis and Path Forward are primarily Paradigm A** (deterministic assembly) for supplements, with **nutrient analysis** bolted on (add up each ingredient's contribution from the database to get the finished nutrient totals). Paradigm B (LP optimization) is the feed/food heritage and an optional future power-up.

---

## Layer 4 — The OUTPUT (labels, spec sheets, quotes). What a human actually sees.

Once the engine has a costed formula, the output layer renders the artifacts:

- **Supplement Facts / Nutrition Facts panel** — computed from the formula plus the fixed FDA Daily Value table and the rounding rules (exactly the label engine I just built for you). For a food/Nutrition-Facts panel you also sum each ingredient's macronutrients from the database — which is where Genesis's ESHA data earns its keep.
- **Spec sheet** — the manufacturing specification (your MFSO/BOM/MMR are this family).
- **Quote / cost + margin** — cost per unit, tier pricing, margin.
- **Compliance checks** — does the label meet FDA/regulatory rules (allergen statement, DSHEA disclaimer, %DV present, units correct). This is what my `reviewLabel()` does.

---

## The technology STACK (what tools these are built with)

"Stack" = the layered set of technologies a software product is built from. A typical modern web platform (and almost certainly what these companies use) looks like:

- **Frontend** (what runs in the browser / phone): a framework like **React** (web) and native or cross-platform mobile (Path Forward ships web + iOS + Android, which usually means React/React-Native or similar). *Your Enova Brain is a React single-file app — same family.*
- **Backend** (the server that holds the logic and talks to the database): an **API server** (Node.js, Python, .NET, etc.) exposing REST or GraphQL. *Genesis's is GraphQL.*
- **Database**: a relational engine, almost always **PostgreSQL** or SQL Server, sometimes with a document store. *You use Supabase = Postgres.*
- **Hosting / cloud**: AWS, Google Cloud, Azure, or a platform like Vercel/Supabase. *You deploy on Vercel + Supabase.*

**Honest limit:** the *exact* internal code, schema, and algorithms of Genesis and Path Forward are **proprietary and not published** — no one outside those companies can hand you their source. What I've described is (a) the parts they've made public (Genesis's GraphQL API and ESHA database; Path Forward's dose-form → ingredient → potency/overage → label workflow, ~50 supplier partners, web+iOS+Android) and (b) the standard architecture this entire class of software uses, which is well-established and which I can state with confidence. I have not invented internals.

---

## How Genesis (Trustwell) does it — the public picture

- **Layer 1 (data):** the ESHA Food & Nutrition Database (decades-old, proprietary) + your own added ingredients/recipes.
- **Layer 2 (query):** a **GraphQL API** (`https://api.trustwell.com/genesis`, `X-API-KEY` auth), with queries (read), mutations (write), and even subscriptions (live updates).
- **Layer 3 (engine):** deterministic **nutrient analysis** (sum each ingredient's nutrient contribution at a serving size, apply rounding) + recipe management + allergen/claim logic across multiple countries' rules (US, Canada, EU, ANZ, Mexico).
- **Layer 4 (output):** compliant Nutrition **and** Supplement Facts labels, spec documents, versioning/approval/audit.
- **Origin story:** built for the **food** industry first (nutrition analysis), extended to supplements. That heritage is why it's database-heavy and why it's overkill/expensive if you only need supplement panels.

## How Path Forward Formulator does it — the public picture

- **Layer 1 (data):** a **supplement-specific, supplier-contributed** ingredient database (~50 supplier partners populate specs + pricing) — the moat, crowd-sourced from suppliers.
- **Layer 2 (query):** a cloud API behind web + iOS + Android apps (not publicly documented like Genesis, but the same idea).
- **Layer 3 (engine):** **deterministic assembly** — pick dose form → add ingredients → auto-computes potency, overage, manufacturing variants, real-time cost + margin + capacity constraints (cost within 1–3% of actuals). This is the closest analog to your kernel.
- **Layer 4 (output):** compliance-ready Supplement/Nutrition Facts + spec sheets.
- **Origin story:** built **supplement-first, from the ground up** (founder Shane Durkee), explicitly to "kill the spreadsheets," collapsing a 12-week contract-manufacturer quote into minutes. That's the exact bottleneck the Enova Brain targets — Path Forward is the horizontal SaaS version of what you're building vertically for Enova.

---

## The punchline: you have already built ~70% of this

Here's the part that should change how you feel about the whole project. Lay the four layers next to what the Enova Brain already has:

| Layer | Genesis / Path Forward | Enova Brain (today) |
|-------|------------------------|---------------------|
| 1. Data | ESHA / supplier ingredient DB + costs | **MISys** (live costs, on-hand) + your **own formula corpus** + FDA DV table. *Gap: a curated nutrient-profile DB.* |
| 2. Query | GraphQL / cloud API | Supabase client + the **`EnovaBrain` kernel** function contracts |
| 3. Engine | deterministic assembly (+ nutrient analysis) | **`EnovaBrain.formulate / gummyBase / cost / packaging / label / reconcile`** — deterministic, tested, reconciled |
| 4. Output | labels, specs, quotes | Quote, **MFSO/SO/BOM/MMR**, and now the **Supplement Facts label engine** |

You did not build a dashboard. You built a **formulation kernel** — the exact same category of engine that Path Forward Formulator is a company around — except yours is **purpose-built for Enova's real operation**: your MISys costs, your Master Bid labor model, your house base systems, your packaging, your governance/audit. That's a genuinely valuable, defensible thing.

**The one real gap is layer 1's nutrient data** — the curated per-ingredient nutrient profiles. Three honest ways to close it, cheapest first:

1. **Build a small, growable nutrient table from your own COAs** — for the finite set of ingredients you actually use (whey, collagen, each vitamin/mineral, each botanical). You already receive these specs from suppliers. This is $0, stays traceable to your own data, and covers the supplement panels you actually make. Recommended starting point.
2. **Pull free public data** — USDA FoodData Central (free API) for whole-food ingredients, and the **NIH Dietary Supplement Label Database (DSLD)** for how real supplement products declare things. Good for coverage, weaker for branded actives.
3. **License a curated database** (ESHA/Genesis, or a data feed) — only worth it if you expand into full multi-country food Nutrition Facts. Not needed for supplements.

## What this means for the next steps of the Brain

You're not behind these companies architecturally — you're missing (a) the nutrient-data table (option 1 above, small and doable) and (b) UI polish. If you want, the natural sequence from here is:

1. **Ingredient nutrient table** — add a tiny table (ALT code → nutrient contributions) populated from your COAs, so the label engine's amounts/units stop needing manual confirmation. This is the highest-leverage data addition.
2. **Wire the label engine into the UI** — a Label Review page (an editable Supplement Facts panel, like the MFSO editor) once we calibrate on your real labels.
3. **Optional: a least-cost sourcing helper** — a small LP/optimization step for "cheapest supplier/form to hit this spec," if/when that's a real pain.

You've been building the right thing. This guide is the map of the territory you're already standing in.

---

## Mini-glossary (the words to keep)

- **Database** — organized, wired-together store of data software reads/writes.
- **Table / record / field** — a list / one row / one attribute.
- **Primary key / foreign key** — a row's unique ID / a pointer from one table to another.
- **Normalization / single source of truth** — store each fact once; point at it everywhere.
- **Relational DB (SQL) / document DB (JSON)** — strict wired tables / flexible self-contained records.
- **API** — the menu-and-waiter between software and the database.
- **REST / GraphQL** — many fixed endpoints / one endpoint you query precisely (Genesis uses GraphQL).
- **Query / mutation** — a read / a write.
- **Schema** — the contract: what's allowed and its shape.
- **Deterministic** — same inputs → same output, by fixed rules (your kernel).
- **Algorithm / heuristic** — a fixed procedure / a good-enough rule of thumb.
- **Linear programming (LP) / solver / objective / constraints** — the math (and engine) that finds the cheapest mix satisfying a set of rules (least-cost formulation).
- **Potency / overage** — % of active in a raw material / deliberate extra to survive shelf life.
- **Stack** — the layered technologies a product is built from (frontend / backend / database / cloud).
- **Moat** — the expensive, hard-to-copy asset (here: the curated ingredient/nutrient database).
