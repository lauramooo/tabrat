-- In-app "Roadmap" board: submitted ideas/bugs, visible to every signed-in account (not just the
-- submitter — this is the one table in the schema that's intentionally shared, not own-data-only),
-- with upvoting. Status (under_review/planned/in_progress/done) is changed by the app owner via
-- the Supabase dashboard (service role bypasses RLS) — there's deliberately no client update
-- policy, so a submitter can't rewrite their own item's status or anyone's vote count.

create table public.feedback_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('idea', 'bug')),
  title text not null,
  description text,
  image_url text,
  status text not null default 'under_review' check (status in ('under_review', 'planned', 'in_progress', 'done', 'declined')),
  vote_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.feedback_votes (
  item_id uuid not null references public.feedback_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index on public.feedback_items (status);
create index on public.feedback_items (user_id);
create index on public.feedback_votes (user_id);

alter table public.feedback_items enable row level security;
alter table public.feedback_votes enable row level security;

create policy "any signed-in account can view" on public.feedback_items for select using (auth.uid() is not null);
create policy "insert own" on public.feedback_items for insert with check (auth.uid() = user_id);
create policy "delete own" on public.feedback_items for delete using (auth.uid() = user_id);

create policy "any signed-in account can view votes" on public.feedback_votes for select using (auth.uid() is not null);
create policy "vote as self" on public.feedback_votes for insert with check (auth.uid() = user_id);
create policy "remove own vote" on public.feedback_votes for delete using (auth.uid() = user_id);

-- Keep vote_count denormalized on the item row (via trigger, not a client update) so the board can
-- just order by it directly instead of joining/counting feedback_votes on every read.
create function public.bump_feedback_vote_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.feedback_items set vote_count = vote_count + 1 where id = new.item_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.feedback_items set vote_count = vote_count - 1 where id = old.item_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger feedback_votes_after_insert after insert on public.feedback_votes
  for each row execute function public.bump_feedback_vote_count();
create trigger feedback_votes_after_delete after delete on public.feedback_votes
  for each row execute function public.bump_feedback_vote_count();

-- Screenshot uploads: public read (the board shows them to every account), upload restricted to
-- signed-in accounts. No per-user folder scoping needed — these aren't sensitive, and there's no
-- client update/delete policy on the bucket so one account can't tamper with another's upload.
insert into storage.buckets (id, name, public) values ('feedback-images', 'feedback-images', true)
  on conflict (id) do nothing;

create policy "feedback images are publicly readable" on storage.objects for select
  using (bucket_id = 'feedback-images');
create policy "signed-in accounts can upload feedback images" on storage.objects for insert
  with check (bucket_id = 'feedback-images' and auth.role() = 'authenticated');
