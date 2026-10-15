# Masal local operations

The dashboard now implements local stock-purchase approval, inventory lifecycle, damaged-card claims, supplier returns, manual sale fulfillment, internal accounting and staff permissions. Top-up, Fourth Stars and Premium have configuration/catalog/order interfaces and a persisted provider execution engine. No real provider network adapter, provider account, or payment-gateway integration is bundled.

## Run and review

- `npm ci`, then `npm run dev` uses the ordinary database.
- `npm run dev:demo` seeds and runs a separate `server/data/demo.sqlite`. All sample codes start with `DEMO` and are nonredeemable. The banner identifies the demo. Re-running does not reset review edits.
- Open `http://127.0.0.1:5173/#/admin`. The launcher prints temporary local admin credentials. Existing `ADMIN_USER` and `ADMIN_PASSWORD` remain supported.
- The local demo includes a pending purchase, an approved batch, an issued sale and unpaid sale, a damaged-card claim, a pending supplier return and unconnected service catalog entries. There are no real purchases, customer messages or money transfers in demo setup.

Pages: `#/admin/purchases`, `warehouse`, `claims`, `returns`, `fulfillment`, `finance`, `staff`, `topup`, `rabia`. `inventory` remains the stock overview/export page. GitHub Pages remains a static preview and cannot run the API, encryption or these operational workflows.

## Purchase orders and stock

Files/pasted text are mapped per source. XLSX uses every nonempty sheet, including date cells. Header detection covers Arabic and English names; manual mapping, extra fields and a declared-row-count check are available. Source card and denomination overrides support one category per source and mixed files with identity columns. Limits are 200 sources and 200 distinct denominations, 50,000 cards, 2 MiB per file, and 100 columns per Excel sheet. Validation and paged lists avoid rendering all card rows at once; parsing is bounded in-memory, not a streaming parser.

Per-denomination rules can require serial, expiry and named extra fields. PIN uniqueness is global. Serial uniqueness is within product and denomination; existing callers passing a legacy global serial set remain conservatively supported. Keep Excel PIN/serial columns as text. Lost leading zeroes in an already-numeric source cell cannot be reconstructed.

Each source has unit cost, total source expenses, and optional default expiry. IQD uses whole dinars; USD uses cents. Decimal strings are converted through integer arithmetic. Source expenses divide evenly with the remaining minor units assigned to the first rows, so allocated cost exactly equals the input total.

Draft -> pending -> approved, returned for correction, or rejected. Drafts do not affect stock or financial balances. Corrections re-upload the desired source set and retain internal card IDs for unchanged PINs. Approval rechecks supplier/company relationships, catalog versions, expiry and duplicates and atomically creates batches/cards and a purchase journal. A changed catalog forces return/correction instead of silently approving a stale preview. Operation keys persist across lost responses and reject payload changes.

Available quantities derive from individual cards, not browser counters. A sellable card must be available, unexpired, unrevealed and unlinked to another hold/order. Reservations select nearest expiry, oldest import, then stable ID. SQLite `BEGIN IMMEDIATE` protects operational mutations. The current deployment model remains one Node process, as in the original project.

## Sales, money and receipts

Existing sales IDs are reused. Staff may create a local sale, reserve cards, record a matching **manual** payment with a unique reference, issue once, and open the same receipt again. Store checkout creates an unpaid order and never proves payment by browser return. Provider categories cannot pass through the local stock import/sale path.

Unpaid reservations expire through server housekeeping, also checked on operational requests. Paid reservations are held for review. Late payment rechecks availability; another order's cards are never reassigned. Safe cancellation releases only unissued, unpaid reservations. Partial/full manual refunds have unique references and do not return sold or revealed PINs to stock. Existing single-item orders are preserved; no replacement cart system was introduced.

Receipts validate ownership or staff permissions in the server, log first/repeat access and download/print attempts, and reuse the original card IDs. Browser printing is supported. Closing a print dialog is not proof of a physical print. No printer-driver integration or approved-device mechanism existed to reuse.

The internal ledger records balanced per-currency entries: purchase inventory/payable, manual cash/customer deposit, issuance revenue/COGS, supplier receivable or loss settlements, and linked customer refunds. Unknown legacy card costs display as unknown; an authorized one-time opening-cost entry is available. Confirmed profit displays only when actual costs are known in IQD; no exchange rate is invented. Supplier compensation is a receivable, not a cash receipt or automatic customer refund. This is the project's new internal ledger, not a connection to an external accounting package or certified financial reporting system.

## Claims and supplier returns

Selected unsold cards are held for review. A rejected claim/return restores each prior status exactly; a previously quarantined card stays quarantined. Settlement supports restoring the prior eligible state, supplier compensation receivable, matching-count/denomination replacements, or write-off. Replacement preserves valuation and links to the original claim without another purchase invoice.

Approved supplier returns cannot be sold. Export requires return approval, export and PIN-reveal permissions and a 12–128 character passphrase. The `.masal` file is actually encrypted with AES-256-GCM and scrypt, and every download is logged. Downloads require an active session; no public or reusable download link is created. Downloaded files cannot be remotely expired.

To decrypt for an authorized recipient, provide `MASAL_EXPORT_PASSWORD` through the environment and run `node scripts/decrypt-return.mjs input.masal output.json`. The command refuses to overwrite an existing output. The resulting JSON contains plaintext PINs and must be handled accordingly. A provider-specific exchange format still requires agreement with that provider.

## Permissions and encryption

Only the owner can create/edit staff. Server-side permissions separately cover catalog, inventory viewing/import/approval/state management, cost/profit, PIN access/export, returns, sales/manual payments, reports, provider settings/sales, store settings and customers. Editing or disabling a staff account terminates its sessions. Hiding a control is not the authorization boundary.

PINs, pending purchase rows, extra imported metadata, provider credentials, reservation tokens, provider replies and returned codes are encrypted at rest with AES-256-GCM. Normal lists never include PINs or provider credentials. Staff passwords use salted scrypt hashes. Action keys store request fingerprints rather than sensitive request bodies; audit entries do not copy PINs or credentials.

`INVENTORY_KEY` may supply a 32-byte base64 key. Otherwise the server creates `<DB_PATH>.key` with restrictive creation permissions. Back up the database and its key separately and protect access to both. Losing the key makes ciphertext unrecoverable. Startup migrates legacy plaintext codes atomically and checkpoints/vacuums old SQLite pages when plaintext records are detected. Revisions, existing links and persistent IDs are preserved. The database, WAL and key are excluded from Git.

## Provider adapter boundary

The consoles save encrypted account settings and local service mappings, distinguish unknown costs and unavailable balance, normalize/confirm Iraqi phones, and collect only configured Premium fields. Drafts can be saved before connection. Live purchase remains unavailable without credentials, a documented contract reference and an installed matching adapter.

Set `PROVIDER_ADAPTER_MODULE` to a trusted local ES module exporting `{topup, rabia}`. Each adapter implements the actual contract in server code; no guessed endpoints are supplied here. Credentials never go to the browser. Example normalized method interfaces:

- `quote(context)` -> `{available, costMinor, currency, expiresAt}`.
- `purchase(context)` -> `{success, reference, costMinor?, currency?, phone?, externalId?, cardId?, code?, serial?, activationComplete?, activationReceipt?, definitiveFailure?}`.
- Fourth Stars additionally requires `reserve(context)` -> `{token, cardId, costMinor, currency, expiresAt}`. The reservation is saved before purchase, and cost cannot exceed the approved quote.
- Optional `check(context)` is a read-only provider status inquiry. It must never perform a purchase. Only use it if the contract actually supports it, including code recovery when documented.
- Optional `balance(context)` supplies a current provider balance and its currency. No balance endpoint is assumed.

Context contains stable `requestId`, service ID, normalized phone/province, required fields, server credentials, base URL and reservation where applicable. Adapters must implement contract timeouts, response parsing, beneficiary/card identity checks, and any supported idempotency/status capabilities. Tests inject mock adapters; the app cannot enable real APIs merely by entering a token.

The engine persists an attempt before network I/O, keeps no database transaction open over the network, saves raw responses encrypted before interpretation, and never retries an unknown financial POST. Restart turns interrupted attempts into review or finalizes an already-saved response without another purchase. A confirmed purchase without PIN is `purchased_code_missing`; Premium remains pending until activation and its receipt are confirmed. Provider cards belong to their original customer order and never become local available stock automatically. Documenting a provider return, requesting one from the provider, and refunding the customer are separate operations.

## Outstanding inputs and boundaries

1. Exact Dinars import screen/file-format parity requires its actual sample files or a walkthrough. The documented generic workflow is implemented, not a claim of pixel or undocumented parser parity.
2. Missing denomination artwork still needs correct supplied images. Upload and persistence are implemented; unrelated artwork is not substituted.
3. Actual top-up/Fourth Stars/Premium connectivity, catalog/province synchronization, balances, webhooks, refunds and code-recovery capabilities require contracts and accounts. They remain disabled where not documented.
4. Qi/ZainCash verification needs actual gateway accounts/contracts and verified server webhooks. Manual entries are labelled manual.
5. External accounting/printer systems, multiple warehouses, and device enrollment were not present; they are not presented as existing integrations. Current ledger and browser printing work locally.

## Validation

`npm run check`, `npm test`, and `npm run build` cover baseline behavior plus multi-file/Arabic mapping, source lines, XLSX formulas/dates, duplicate identity, approvals and stale edits, exact allocations, concurrent reservation rejection, expiry/late payments, issuance/refunds, ownership, receipt repeat/print behavior, rejected-return state restoration, encrypted export/replacements, staff denial/revocation, at-rest encryption and restart. Provider tests use mocks only for one-purchase semantics, unknown responses, missing PIN, Premium activation, and independent supplier/customer returns. Local UI review exercises draft creation, approval preview, receipt access and visible unconnected provider settings.
