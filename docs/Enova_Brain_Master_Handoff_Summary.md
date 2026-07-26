<!-- 00_README_MISSION_AND_CURRENT_STATUS.md -->

# Enova Brain / Enova Operations OS — Mission, Benchmark, and Handoff

Generated: 2026-07-01 18:38:07

## Mission

Build **Enova Brain**, an internal, product-grade operations system for Enova Science. This is not just a dashboard. It is intended to become Enova's internal operating system for supplement manufacturing and eventually a scalable platform model.

The system must support the complete operational chain:

```text
Customer
→ Customer Product
→ Project / Work Order
→ Canned Job / Template
→ Formula
→ Inventory Items
→ Quote
→ Sales Order
→ Invoice / Payment Status
→ Manufacturing Order
→ BOM
→ MFSO
→ Production
→ QA
→ Shipping
→ Documents / Audit Trail
```

## Critical Operating Principle

The system must be built using a professional software-engineering approach:

```text
No random patching.
No uncontrolled edits.
No skipping validation.
No silent database changes.
No guessing with company-critical inventory data.
Every patch must include backup, validation, pass/fail gates, and stop conditions.
```

## User / Operator Context

The primary operator is not a programmer or data engineer. Instructions must be exact, step-by-step, path-specific, command-specific, validation-driven, and written with expected outputs and stop conditions.

## Current Build Folder

```text
C:\ERP\Releases\Enova_Brain_v1.8.0_employee_polish
```

## Current Runtime

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3001
Backend file: C:\ERP\Releases\Enova_Brain_v1.8.0_employee_polish\api\server_v1.6.1_hotfix.js
Database: enova_brain_staging
Database user: enova
MISys import folder: C:\ERP\Imports\MISys_Item_Valuation
File store: C:\ERP\Staging\EnovaOS_Master
```

## Current Benchmark

```text
04A Reconciled Operating Model Foundation: PASSED
04C MISys XLSX Live Inventory Import: PASSED
Inventory items loaded: 9,328
Live inventory balances loaded: 1,551
Import snapshot transactions logged: 1,551
Negative available inventory count: 0
Backend syntax check: PASSED
```

## Major Milestone Completed

The system now has a real live-inventory foundation populated from MISys XLSX data.

The following database areas are now in place:

```text
customer_products
enova_work_orders
canned_jobs
canned_job_materials
canned_job_packaging
project_canned_job_applications
product_material_links
product_packaging_links
work_order_materials
work_order_packaging
enova_inventory_balances
enova_inventory_transactions
enova_inventory_reservations
enova_inventory_adjustments
formulation_uploads
formulation_upload_extractions
```

## Replit Context

Replit can be used for prototyping, explanation, or external review, but it is **not the source of truth** for this local Windows/PostgreSQL/MISys/Mac Mini deployment.

The authoritative build is the local Enova Brain project under:

```text
C:\ERP\Releases\Enova_Brain_v1.8.0_employee_polish
```


---

<!-- 01_SYSTEM_ARCHITECTURE.md -->

# Enova Brain — System Architecture

## Current Stack

```text
Frontend: React 18 + Vite
Backend: Node.js / Express
Database: PostgreSQL
Authentication: JWT-based
Python utilities: report/document/import scripts
File storage: local Windows file store, later Mac Mini file store
Deployment target: Mac Mini internal server
```

## Core System Architecture

### Frontend

Purpose:
- Staff-facing browser UI
- Command Center
- Customers
- Projects
- Formulations
- Quotes
- Sales Orders
- Manufacturing Orders
- BOM
- MFSO
- Documents
- Inventory
- Label Review

Main files:
```text
web\src\App.jsx
web\src\App.css
```

### Backend

Purpose:
- API layer
- Authentication
- Database queries
- Document generation
- File routes
- Workflow actions

Main file:
```text
api\server_v1.6.1_hotfix.js
```

### Database

Purpose:
- Source of truth for Enova Brain app data
- Customers
- Projects
- Quotes
- Sales orders
- Documents
- BOMs
- Inventory item master
- Live inventory balances
- Inventory transaction ledger
- Work orders
- Canned jobs

### MISys Integration

Current decision:
- MISys remains the source system for inventory data.
- Enova Brain imports MISys XLSX snapshots into its own live inventory visibility tables.
- Do not use PDF parsing for live inventory import.
- Use XLSX or CSV only.

## Data Flow

```text
MISys XLSX
→ XLSX Profile
→ Import Preparation
→ inventory_items
→ enova_inventory_balances
→ enova_inventory_transactions
→ API read endpoints
→ Inventory UI
→ Work order / BOM / quote usage
```

## Inventory Lifecycle

```text
Quote stage:
  Check costs/availability only. No reservation.

Sales Order stage:
  Shows demand/pending need. No consumption.

MO/BOM stage:
  Reserve raw materials and packaging.

Production issue stage:
  Materials are pulled/issued.

Production close:
  Actual usage/waste/returns are locked.

Shipping/close:
  Finished goods shipped, unused reservations released.
```


---

<!-- 02_DATABASE_AND_INVENTORY_FOUNDATION.md -->

# Database and Live Inventory Foundation

## Existing Tables Before Foundation

The diagnostic found these key existing tables:

```text
boms
customers
documents
inventory_items
inventory_reservations
projects
quotes
sales_orders
```

The old inventory tables existed from an earlier build and caused conflicts with the original 04A migration. The safe route was to keep the older inventory tables and add new Enova-specific live inventory tables.

## Reconciled Foundation Decision

Avoid collisions with old table names. New live inventory layer uses:

```text
enova_inventory_balances
enova_inventory_transactions
enova_inventory_reservations
enova_inventory_adjustments
```

## Important Tables Created by 04A

```text
customer_products
enova_work_orders
canned_jobs
canned_job_materials
canned_job_packaging
project_canned_job_applications
product_material_links
product_packaging_links
work_order_materials
work_order_packaging
enova_inventory_balances
enova_inventory_transactions
enova_inventory_reservations
enova_inventory_adjustments
formulation_uploads
formulation_upload_extractions
```

## MISys XLSX Import Result

The successful 04C import loaded:

```text
inventory_items_total: 9,328
enova_inventory_balances_total: 1,551
IMPORT_SNAPSHOT transactions: 1,551
negative available balances: 0
```

## How Data Was Imported

### MIITEM Sheet

Imported into:

```text
inventory_items
```

Used for item number, description, UOM, item type/category, costs, lead days, reorder points, and source system metadata.

### MISLBINQ Sheet

Imported into:

```text
enova_inventory_balances
```

Used for location, item number, on-hand quantity, available quantity, and snapshot timestamp.

### Import Ledger

Imported into:

```text
enova_inventory_transactions
```

Transaction type:

```text
IMPORT_SNAPSHOT
```

## Import Lessons

1. PDF parsing was abandoned for live inventory.
2. XLSX/CSV is the required source path.
3. MISys XLSX may include duplicate item IDs.
4. The import must deduplicate item IDs before upsert.
5. Existing legacy columns have length limits, so long text fields were truncated safely during import.
6. Do not widen legacy text columns without checking dependent views.
7. The view `inventory_intel` depends on `inventory_items.description`.


---

<!-- 03_SCRIPT_HISTORY_AND_DO_NOT_RERUN.md -->

# Script History and Do-Not-Rerun List

## Successful / Active Scripts

### 04A_RECONCILED_OPERATING_MODEL_FOUNDATION.ps1

Status:
```text
PASSED
```

Purpose:
- Created reconciled operating model tables
- Created Enova live inventory tables using safe `enova_...` names
- Avoided collisions with older inventory tables

### 04C_RERUN_DEDUPED_TRUNCATED_MISYS_IMPORT.ps1

Status:
```text
PASSED
```

Purpose:
- Used prepared MISys XLSX staging CSV files
- Deduplicated item IDs
- Truncated long text fields to fit legacy schema
- Imported inventory item master
- Imported live inventory balances
- Created IMPORT_SNAPSHOT transaction ledger entries

### 04D_LIVE_INVENTORY_VALIDATION_AND_STATUS_REPORT_ONLY.ps1

Status:
```text
Recommended next no-risk report step
```

Purpose:
- Read-only validation report
- No database or code changes

## Retired / Do Not Rerun

Do not rerun these unless specifically instructed after review:

```text
04A_ENOVA_OPERATING_MODEL_AND_LIVE_INVENTORY_FOUNDATION.ps1
04A_FIX_EXISTING_INVENTORY_ITEMS_COMPATIBILITY.ps1
04A_FIX_EXISTING_LIVE_INVENTORY_TABLES_COMPATIBILITY.ps1
04C_MISYS_XLSX_IMPORT_TO_LIVE_INVENTORY.ps1
04C_RERUN_DEDUPED_MISYS_IMPORT.ps1
04C_FIX_INVENTORY_TEXT_COLUMN_LENGTHS.ps1
```

## Why Some Scripts Were Retired

- Original 04A failed because older inventory tables already existed.
- PDF parser path was retired for live inventory because PDF extraction was inconsistent.
- First 04C import failed because MIITEM had duplicate item IDs.
- Text-column widening failed because view `inventory_intel` depends on `inventory_items.description`.

## Backup Locations

Backups were created under:

```text
C:\ERP\Backups
```

Important successful backup folders:

```text
C:\ERP\Backups\20260630_224952-04A_RECONCILED_OPERATING_MODEL_FOUNDATION
C:\ERP\Backups\20260630_233854-04C_RERUN_DEDUPED_TRUNCATED_MISYS_IMPORT
```


---

<!-- 04_REPLIT_HANDOFF_GUIDE.md -->

# Replit Handoff Guide — Enova Brain

## Important Warning

Replit should not be treated as the production environment for this build.

The real system is currently a local Windows/PostgreSQL/Node/React application intended for Mac Mini internal deployment.

Replit may help with:
- Reviewing architecture
- Prototyping isolated UI
- Writing non-destructive code suggestions
- Mocking screens
- Explaining code
- Generating documentation

Replit should not be allowed to:
- Replace the local database
- Invent a new architecture without matching the current local app
- Rewrite the app blindly
- Use toy in-memory storage
- Ignore MISys integration
- Ignore Enova's quote / SO / MO / BOM / MFSO chain
- Import PDF inventory data directly
- Skip validation

## Current Source of Truth

```text
C:\ERP\Releases\Enova_Brain_v1.8.0_employee_polish
```

## Replit Prompt to Start With

```text
We are building Enova Brain / Enova Operations OS for Enova Science, a contract supplement manufacturer. This is an internal ERP/OPS system, not just a dashboard.

The authoritative local build is a React/Vite frontend, Node/Express backend, PostgreSQL database, and local file store. It runs on Windows now and will deploy to a Mac Mini as an internal browser-accessed app.

Do not invent a new architecture. Work from this mission:

Customer → Customer Product → Project / Work Order → Canned Job → Formula → Inventory Items → Quote → Sales Order → Invoice/payment status → Manufacturing Order → BOM → MFSO → Production → QA → Shipping → Documents.

Current completed milestone:
- 04A Reconciled Operating Model Foundation passed.
- 04C MISys XLSX live inventory import passed.
- inventory_items has 9,328 imported MISys item master rows.
- enova_inventory_balances has 1,551 item/location balances.
- enova_inventory_transactions has 1,551 IMPORT_SNAPSHOT audit rows.
- negative available inventory count is 0.

Important:
- Use XLSX/CSV for MISys inventory import. Do not use PDF for live import.
- Keep inventory transaction-ledger driven.
- Quote stage checks cost/availability only.
- MO/BOM stage reserves inventory.
- Production issue/close consumes inventory and releases unused reservations.
- Sales Order and Invoice/payment are related but separate.
- No destructive database changes without backup and validation.
- Every patch must include backup, syntax checks, health checks, validation, pass/fail gates, and stop conditions.
```

## Recommended Replit Task

Ask only for **read-only backend API endpoints** or a mock UI plan.

Next task:

```text
05A_LIVE_INVENTORY_API_READ_ENDPOINTS
```

Endpoints:

```text
GET /api/inventory-live/summary
GET /api/inventory-live/items
GET /api/inventory-live/items/:itemNumber
GET /api/inventory-live/transactions
GET /api/inventory-live/low-stock
```

Scope:
```text
Read-only only.
No inventory edits.
No reservation logic yet.
No consumption logic yet.
No frontend UI yet.
```


---

<!-- 05_NEXT_PATCH_PLAN.md -->

# Next Patch Plan

## Immediate No-Risk Step: 04D Report

Run:

```text
04D_LIVE_INVENTORY_VALIDATION_AND_STATUS_REPORT_ONLY.ps1
```

Purpose:
- Read-only inventory validation report
- Confirm imported MISys data quality
- No database changes
- No code changes

## Next Code Step: 05A Live Inventory Read-Only API

### Scope

Backend only.

Add read-only endpoints:

```text
GET /api/inventory-live/summary
GET /api/inventory-live/items
GET /api/inventory-live/items/:itemNumber
GET /api/inventory-live/transactions
GET /api/inventory-live/low-stock
```

### Data Sources

```text
inventory_items
enova_inventory_balances
enova_inventory_transactions
```

### Required Behavior

#### /summary

Return:
- total item master count
- total balance row count
- positive stock item count
- raw material count
- packaging count
- finished good count
- negative available count
- zero cost stocked item count
- latest import snapshot timestamp

#### /items

Return paginated inventory rows:
- item number
- description
- category
- uom
- avg cost
- recent cost
- standard cost
- location
- qty on hand
- qty reserved
- qty available
- last snapshot date

Support filters:
- search
- category
- location
- stockedOnly
- zeroCostOnly
- limit
- offset

#### /items/:itemNumber

Return:
- item master details
- all balances
- recent transactions

#### /transactions

Return:
- transaction ledger rows
- filter by itemNumber
- filter by transactionType
- filter by date range
- pagination

#### /low-stock

Return:
- items where available is below reorder point
- only where reorder point exists and is positive

## 05A Safety Requirements

Before patch:
- Backup backend file.
- Backup app folder checkpoint if needed.
- Do not edit frontend.
- Do not edit database schema.

Validation:
- `node --check server_v1.6.1_hotfix.js`
- backend restart
- `/api/health`
- test each endpoint with PowerShell `Invoke-RestMethod`
- verify no auth breakage
- verify app still loads

Stop Conditions:
- syntax check fails
- backend fails to restart
- health check fails
- endpoint returns SQL error
- login/auth breaks


---

<!-- 06_REQUIREMENTS_AND_ACCEPTANCE_CRITERIA.md -->

# Requirements and Acceptance Criteria

## Global Build Rules

Every technical patch must include:

```text
1. Clear scope
2. Backup/checkpoint
3. Exact path
4. Exact commands
5. Expected output
6. Stop conditions
7. Syntax/build validation
8. Backend health check when backend is touched
9. Database validation when database is touched
10. No skipped safety steps
```

## Customer-Centered Records

Each customer must have:
- overview
- products
- projects/work orders
- quotes
- sales orders
- invoices/payment status
- manufacturing orders
- BOMs
- MFSOs
- documents
- uploads
- communication/activity
- canned jobs

## Product-Centered Records

Each product must have:
- formula revisions
- packaging profile
- canned jobs
- quotes
- sales orders
- manufacturing orders
- BOMs
- MFSOs
- documents
- production history
- QA history
- inventory item links

## Canned Jobs

Canned jobs are reusable templates for common product/job types.

Examples:
- 60ct pectin gummy bottle
- 120ct pectin gummy bottle
- 30ct capsule bottle
- 60ct capsule bottle
- bulk powder blend
- bulk liquid blend
- 12oz syrup bottle
- 2oz tincture bottle
- stick pack display box
- powder tub/jar
- customer-supplied packaging job
- R&D sample job

Canned jobs must snapshot when applied to a project so old projects are not altered by later template edits.

## Bulk vs Packaged Logic

Bulk product quotes should not require retail packaging.

Packaged finished goods include bottle/jar, cap/lid, seal/liner, neckband, label, desiccant/scoop where applicable, master case shipper, divider/insert if fragile, stick pack film/display box where applicable.

## Inventory Acceptance Criteria

Inventory must support:

```text
on_hand
reserved
available
issued
consumed
returned
scrap/waste
closed/shipped
adjustments
```

Inventory must be transaction-ledger driven.

No silent direct quantity edits.

## Launch Acceptance

Before Mac Mini deployment:
- login works
- customer creation works
- project/work order creation works
- formulation creation works
- quote creation works
- SO creation works
- MO/BOM/MFSO generation works
- documents open/download
- inventory read-only works
- MISys XLSX import/reimport works
- backups/restore path documented
- manager test accounts created
- department pilot workflow validated


---

<!-- 07_TOMORROW_MISYS_REIMPORT_RUNBOOK.md -->

# Tomorrow MISys XLSX Replacement / Reimport Runbook

## Goal

Replace today's MISys XLSX snapshot with tomorrow's updated MISys XLSX export and refresh Enova Brain inventory safely.

## Rule

Do not overwrite old files.

Save tomorrow's export as a new dated file.

Example:

```text
C:\ERP\Imports\MISys_Item_Valuation\MIITEM002_Item_Valuation_2026-07-01.xlsx
```

## Required Source Format

Use:

```text
XLSX
XLS
CSV
```

Do not use PDF for live inventory import.

## Steps

### 1. Place the new MISys file

Folder:

```text
C:\ERP\Imports\MISys_Item_Valuation
```

### 2. Confirm newest file

```powershell
Get-ChildItem "C:\ERP\Imports\MISys_Item_Valuation" -File |
Where-Object {{ $_.Extension -in ".xlsx", ".xls", ".csv" }} |
Select-Object FullName, Length, LastWriteTime |
Sort-Object LastWriteTime -Descending
```

### 3. Run XLSX profile first

```powershell
powershell -ExecutionPolicy Bypass -File "C:\ERP\PatchPacks\v1.8.0_employee_polish\04B_XLSX_PROFILE_ONLY.ps1"
```

Confirm:
- MIITEM sheet exists
- MISLBINQ sheet exists
- row counts look reasonable

### 4. Import

Use the final successful deduped/truncated import pattern:
- XLSX prepare
- deduplication
- safe truncation
- database backup
- import
- validation

### 5. Validate

Expected validation output should include:

```text
inventory_items_total
enova_inventory_balances_total
import_snapshot_transactions_total
balances_with_negative_available = 0
```

Current known successful counts:

```text
inventory_items_total: 9,328
enova_inventory_balances_total: 1,551
IMPORT_SNAPSHOT transactions: 1,551
negative available balances: 0
```


---

<!-- 08_BOSS_LEVEL_EXECUTIVE_SUMMARY.md -->

# Executive Summary — Enova Brain

## What We Are Building

Enova Brain is an internal operating system for Enova Science's supplement manufacturing operation.

It is designed to connect customer management, product development, formulation, quoting, sales orders, manufacturing orders, BOMs, MFSOs, inventory, purchasing, QA, production, shipping, and document control into one coordinated system.

## Why It Matters

The company needs better visibility and control across departments. Enova Brain is intended to reduce bottlenecks, improve accountability, prevent document duplication, connect formulas to quotes and production records, and eventually allow department managers to work from one source of truth.

## Current Technical Status

The project is currently running locally on Windows:

```text
Frontend: React/Vite
Backend: Node/Express
Database: PostgreSQL
Future host: Mac Mini internal server
```

## Major Progress Completed

The system already has working foundations for:
- Customers
- Projects
- Quotes
- Sales Orders
- Documents
- BOM/MFSO-related workflows
- Database-backed records
- Local document/file generation
- Live inventory foundation

## Most Recent Milestone

Real MISys inventory data was imported from XLSX into Enova Brain's live inventory tables.

Current imported inventory benchmark:

```text
9,328 item master records
1,551 live inventory balance rows
1,551 import snapshot audit transactions
0 negative available inventory balances
```

## Current Strategy

Keep MISys as the current source of truth for inventory, but give Enova Brain controlled, read-only/live operational visibility by importing MISys XLSX snapshots.

This allows Enova Brain to support quoting, material availability checks, BOM planning, and future production reservation workflows without directly modifying MISys.

## Next Milestone

Build read-only backend API endpoints so the app can display imported MISys inventory:

```text
GET /api/inventory-live/summary
GET /api/inventory-live/items
GET /api/inventory-live/items/:itemNumber
GET /api/inventory-live/transactions
GET /api/inventory-live/low-stock
```

## Deployment Direction

```text
Local Windows staging
→ validation
→ Mac Mini internal deployment
→ department manager testing
→ controlled improvement cycle
```

## Replit Position

Replit may be used for prototyping or code review, but the real system is local and database-backed. Replit should not replace the local controlled build unless a deliberate migration plan is created.


---

<!-- 09_CURRENT_OPEN_RISKS_AND_DECISIONS.md -->

# Current Open Risks and Decisions

## Open Risks

### Replit Environment Mismatch

Risk:
Replit may not mirror the local Windows/PostgreSQL/file-store/MISys environment.

Mitigation:
Use Replit only for isolated code review or prototyping unless a full migration plan is approved.

### Legacy Schema Compatibility

Risk:
The database contains earlier schema elements and views such as `inventory_intel`.

Mitigation:
Do schema diagnostics before structural changes. Avoid altering legacy columns without checking dependent views.

### Inventory Import Source Quality

Risk:
PDF reports are fragile and can parse inconsistently.

Mitigation:
Use MISys XLSX/CSV only for live inventory imports.

### Frontend Coupling

Risk:
Changing frontend too early could cause visible app breakage.

Mitigation:
Build backend read-only endpoints first, validate them, then wire UI.

### Inventory Mutation Logic

Risk:
Reservation/consumption logic can corrupt stock if implemented casually.

Mitigation:
Keep all inventory mutations behind transaction-ledger functions with audit entries and validation.

## Decisions Already Made

```text
1. MISys remains source system for inventory.
2. Enova Brain imports XLSX snapshots.
3. PDF inventory import is retired for live data.
4. Existing legacy inventory tables remain.
5. New Enova live inventory tables use enova_ prefixes.
6. Sales Order and Invoice/payment status stay separate.
7. Quote stage does not consume/reserve inventory.
8. MO/BOM stage is where reservation begins.
9. Production issue/close is where consumption is recorded.
10. Replit is not the production source of truth.
```

## Do Not Forget

The mission is to build a real company operating system, not a collection of disconnected dashboards.

The final product must be robust enough for Enova employees and managers to rely on every day.


---

<!-- 10_COPY_PASTE_PROMPT_FOR_FRESH_CHAT_OR_REPLIT.md -->

# Copy/Paste Prompt for Fresh Chat or Replit

```text
We are building Enova Brain / Enova Operations OS for Enova Science, a contract supplement manufacturer. The user is not a programmer, so all technical guidance must be exact, step-by-step, validation-driven, and must include backups, syntax checks, health checks, pass/fail gates, and stop conditions.

This is not just a dashboard. It is a full operating system path:

Customer → Customer Product → Project / Work Order → Canned Job → Formula → Inventory Items → Quote → Sales Order → Invoice/payment status → Manufacturing Order → BOM → MFSO → Production → QA → Shipping → Documents.

Current local project folder:
C:\ERP\Releases\Enova_Brain_v1.8.0_employee_polish

Runtime:
Frontend http://localhost:5173
Backend http://localhost:3001
Backend file api\server_v1.6.1_hotfix.js
Database enova_brain_staging
MISys import folder C:\ERP\Imports\MISys_Item_Valuation

Current status:
04A Reconciled Operating Model Foundation passed.
04C MISys XLSX live inventory import passed.
inventory_items now has 9,328 item master records.
enova_inventory_balances has 1,551 item/location balance rows.
enova_inventory_transactions has 1,551 IMPORT_SNAPSHOT rows.
Negative available inventory count is 0.
Backend syntax check passed.

Important decisions:
- Use MISys XLSX/CSV as source for live inventory import, not PDF.
- Keep existing legacy inventory tables.
- Use new enova_inventory_* tables for live inventory.
- Inventory must be transaction-ledger driven.
- Quote checks costs/availability only.
- MO/BOM reserves inventory.
- Production issue/close consumes inventory and releases unused reservations.
- SO and Invoice/payment status are related but separate.
- Do not let Replit replace the local architecture unless a full migration plan is approved.

Next recommended patch:
05A_LIVE_INVENTORY_API_READ_ENDPOINTS

Add backend read-only endpoints:
GET /api/inventory-live/summary
GET /api/inventory-live/items
GET /api/inventory-live/items/:itemNumber
GET /api/inventory-live/transactions
GET /api/inventory-live/low-stock

Scope:
Backend only.
Read-only only.
No inventory edits.
No frontend changes yet.
No destructive database changes.
Must backup server file, run node --check, restart backend, health check, and validate every endpoint.
```
