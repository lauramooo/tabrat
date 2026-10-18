-- Trip/home expenses can span several days (picked on the same start/end range calendar as trip
-- dates). Null/empty means a single-day expense on receipt_date.
alter table public.split_records add column if not exists receipt_end_date text;
