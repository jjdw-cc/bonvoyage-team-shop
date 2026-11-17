-- 知识树 / 记忆节点图
-- 在 Supabase Dashboard → SQL Editor 执行一次，幂等。

-- 节点：kind = root（主根）| node（分支）
create table if not exists public.tree_nodes (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  parent_id   uuid references public.tree_nodes(id) on delete cascade,
  title       text not null default '未命名节点',
  shape       text not null default 'rect',       -- rect | pill | hex | diamond
  x           double precision not null default 0,
  y           double precision not null default 0,
  kind        text not null default 'node',
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 跨树连线：不同主根下的节点可以互连
create table if not exists public.tree_links (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  from_node   uuid not null references public.tree_nodes(id) on delete cascade,
  to_node     uuid not null references public.tree_nodes(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- 节点里每个人写的想法
create table if not exists public.node_notes (
  id          uuid primary key default gen_random_uuid(),
  node_id     uuid not null references public.tree_nodes(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  content     text not null,
  created_at  timestamptz not null default now()
);

-- 节点文件：允许同名，靠 author_id 区分是谁传的；status = pending | approved
create table if not exists public.node_files (
  id          uuid primary key default gen_random_uuid(),
  node_id     uuid not null references public.tree_nodes(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  name        text not null,
  path        text not null,
  url         text not null,
  size        bigint not null default 0,
  type        text,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);

create index if not exists tree_nodes_project_idx on public.tree_nodes (project_id);
create index if not exists tree_links_project_idx on public.tree_links (project_id);
create index if not exists node_notes_node_idx on public.node_notes (node_id);
create index if not exists node_files_node_idx on public.node_files (node_id);

-- RLS：三人团队，登录用户共享读写
alter table public.tree_nodes enable row level security;
alter table public.tree_links enable row level security;
alter table public.node_notes enable row level security;
alter table public.node_files enable row level security;

drop policy if exists tree_nodes_auth on public.tree_nodes;
drop policy if exists tree_links_auth on public.tree_links;
drop policy if exists node_notes_auth on public.node_notes;
drop policy if exists node_files_auth on public.node_files;

create policy tree_nodes_auth on public.tree_nodes for all to authenticated using (true) with check (true);
create policy tree_links_auth on public.tree_links for all to authenticated using (true) with check (true);
create policy node_notes_auth on public.node_notes for all to authenticated using (true) with check (true);
create policy node_files_auth on public.node_files for all to authenticated using (true) with check (true);

comment on table public.tree_nodes is '项目知识树的节点；kind=root 为主根，shape 控制形状';
comment on table public.node_files is '节点附件，可同名；author_id 标识上传者；approved 后可并入项目文件';
