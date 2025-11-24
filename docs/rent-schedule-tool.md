# compute_lease_rent_schedule tool

This tool exposes the rent escalation logic that mirrors the original Excel workbook. It can be invoked by the AI platform through function calling.

## Parameters

- `start_date` / `end_date`: ISO dates defining the lease window.
- `payment_frequency`: `monthly` or `quarterly`. All monetary inputs are expressed per period.
- `base_index_value`: Reference index at lease start (e.g. ILAT).
- `known_index_points`: Optional list of `{ effective_date, index_value }` to drive index changes. Values after the last known point are extrapolated with TCAM.
- `charges_growth_rate`: Annual inflation for charges and taxes (decimal, e.g. `0.02`).
- `office_rent_ht`, `parking_rent_ht`, `charges_ht`, `taxes_ht`, `other_costs_ht`: Base HT amounts per payment period.
- `deposit_months`: Months multiplier for the security deposit (uses base monthly rents + charges + taxes).
- `franchise_months`: Number of rent-free months (applied on indexed office + parking rents, prorated per period).
- `incentive_amount`: One-shot incentive (positive numbers are treated as concessions).
- `horizon_years`: Projection horizon from `start_date` (defaults to 3 years if omitted).

## Sample invocation

```json
{
  "name": "compute_lease_rent_schedule",
  "arguments": {
    "start_date": "2024-03-06",
    "end_date": "2027-03-05",
    "payment_frequency": "quarterly",
    "base_index_value": 130.64,
    "known_index_points": [
      { "effective_date": "2025-01-01", "index_value": 136.45 },
      { "effective_date": "2026-01-01", "index_value": 137.15 }
    ],
    "charges_growth_rate": 0.02,
    "office_rent_ht": 3000,
    "parking_rent_ht": 500,
    "charges_ht": 300,
    "taxes_ht": 200,
    "deposit_months": 3,
    "franchise_months": 6,
    "incentive_amount": 4000,
    "horizon_years": 4
  }
}
```

## Output

The tool returns:

- `summary`: deposit amount, computed TCAM, and yearly totals (`baseRentHT`, `chargesHT`, `taxesHT`, `franchiseHT`, `incentivesHT`, `netRentHT`).
- `schedule`: chronological periods (`period_start`, `period_end`, `period_type`, `year`, `quarter` or `month`) with indexed rents, prorated charges/taxes, franchise allocation, incentives, and the final `net_rent_ht`.

Net values always equal the sum of their components so downstream consumers can trust the aggregation.\*\*\*
