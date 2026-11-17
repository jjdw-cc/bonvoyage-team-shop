-- 节点文件投票：每人每个文件一票
create table if not exists public.node_file_votes (
  id          uuid primary key default gen_random_uuid(),
  file_id     uuid not null references public.node_files(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (file_id, user_id)
);

create index if not exists node_file_votes_file_idx on public.node_file_votes (file_id);

alter table public.node_file_votes enable row level security;
drop policy if exists node_file_votes_auth on public.node_file_votes;
create policy node_file_votes_auth on public.node_file_votes for all to authenticated using (true) with check (true);

comment on table public.node_file_votes is '节点附件投票，票数最高的可以入库到项目文件';
