---
name: Kifayat CSV lifecycle
description: Durable rules for keeping confirmed-order and admin-finalization CSV behavior identical
---

Both customer email confirmation and admin finalization must create the same confirmed/finalized PreOrder and one MainOrderCSVData queue record from the same shipping and item data. The operation must be retry-safe and preserve an existing queue row's exported state.

**Why:** These paths feed the same fulfilment exports; divergent records cause missing rows, duplicate pre-orders, or incorrect re-exports.

**How to apply:** Keep record creation centralized, enforce one PreOrder per order, use idempotent queue upserts, and only delete the source Order/ShippingDetail after both records exist.