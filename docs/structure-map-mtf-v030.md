# Structure Map 0.3.0 per-chart timeframe release

The user explicitly requested independent signals, reference levels and tracking per chart timeframe. Execution data now comes from the chart timeframe, with mapped closed-bar context (M1/M15, M5/H1, M15-M30/H4, H1-H4/D1, D1/W1, W1-MN1/MN1). Durations and labels are parameterized. M5's 131,498 recent-two-year closed-bar states and reference values match the prior core. This is a compatibility check, not a new performance qualification.

Per-symbol/period/context/instance snapshots retain plans and records. Corrupt snapshots are rejected; write failure is visible. Confirmed frozen levels survive history corrections. When history is temporarily unavailable, saved plans remain visible with a HISTORY WAIT status and the model actively retries. New candidates remain cancellable under existing candidate conditions. Monthly close times use calendar boundaries.

Mail subjects identify execution timeframe; event deduplication includes timeframe. Loading/returning does not replay historical email. One attached instance runs the current chart timeframe; simultaneous monitoring requires separate charts. No actual orders or real emails were sent during testing. Native MT4/MT5 functional harnesses passed 86 checks each; actual binary M5/H1/M15/M5 reloads preserve the M5 plan. These are isolated historical-data checks.

Public source changes include website text, private artifact metadata and contracts only. Indicator source, EX4/EX5, customer ZIPs, state snapshots and glyph resources are private and are not added to this repository. Performance-qualified remains false.
