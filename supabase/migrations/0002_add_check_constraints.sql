-- Defense-in-depth: bound monetary/count columns to non-negative values so a client bug (or a
-- user poking at devtools) can't write nonsensical data. RLS already confines any such write to
-- the user's own rows — these constraints are about data integrity, not cross-user access.

alter table public.trips
  add constraint trips_budget_non_negative check (budget is null or budget >= 0),
  add constraint trips_group_budget_non_negative check (group_budget is null or group_budget >= 0);

alter table public.split_records
  add constraint split_records_total_non_negative check (total >= 0),
  add constraint split_records_tax_non_negative check (tax is null or tax >= 0),
  add constraint split_records_tip_non_negative check (tip is null or tip >= 0),
  add constraint split_records_item_count_non_negative check (item_count >= 0);

alter table public.trip_payments
  add constraint trip_payments_amount_non_negative check (amount >= 0);

alter table public.home_payments
  add constraint home_payments_amount_non_negative check (amount >= 0);
