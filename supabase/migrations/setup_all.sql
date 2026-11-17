-- 三人协作 · 数据库一键初始化
-- Supabase Dashboard → SQL Editor → 整段粘贴 → Run；幂等，可重复执行。

-- ─────────────────────────────────────────────
-- 20261117_project_files.sql
-- ─────────────────────────────────────────────
-- 项目文件（类似 GitHub 仓库里的文件）
-- 在 Supabase Dashboard → SQL Editor 里执行一次即可，幂等，可重复运行。

-- 1) 给 files 表挂上所属项目与上传者
alter table public.files
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null;

-- 2) 项目详情按 project_id 过滤，建个索引
create index if not exists files_project_id_idx on public.files (project_id);
create index if not exists files_created_at_idx on public.files (created_at desc);

-- 3) 说明
--    · project_id 为 null 表示「未归属项目」，仍会出现在全局文件库里
--    · 删除项目时只把 project_id 置空，不会连带删除文件和对象存储里的文件
--    · 现有 RLS 策略按行生效，新加的两列自动继承，无需额外策略
comment on column public.files.project_id is '所属项目；null 表示仅存在于全局文件库';
comment on column public.files.uploaded_by is '上传者 user id';

-- ─────────────────────────────────────────────
-- 20261118_project_tree.sql
-- ─────────────────────────────────────────────
-- 知识树 / 记忆节点图
-- 在 Supabase Dashboard → SQL Editor 执行一次，幂等。·

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

-- ─────────────────────────────────────────────
-- 20261118_tree_node_style.sql
-- ─────────────────────────────────────────────
-- 节点样式：大小与颜色
-- 在 20261118_project_tree.sql 之后执行；幂等。

alter table public.tree_nodes
  add column if not exists width  double precision not null default 196,
  add column if not exists height double precision not null default 66,
  add column if not exists color  text not null default 'plain';

comment on column public.tree_nodes.width  is '节点宽度（画布逻辑像素）';
comment on column public.tree_nodes.height is '节点高度（画布逻辑像素）';
comment on column public.tree_nodes.color  is '配色 key：plain / indigo / sky / emerald / amber / rose / slate';

-- ─────────────────────────────────────────────
-- 20261118_tree_link_bend.sql
-- ─────────────────────────────────────────────
-- 跨树连线可弯曲：记录相对中点的偏移量
alter table public.tree_links
  add column if not exists bend_x double precision not null default 0,
  add column if not exists bend_y double precision not null default 0;

comment on column public.tree_links.bend_x is '连线中点的水平偏移，拖动连线时写入';
comment on column public.tree_links.bend_y is '连线中点的垂直偏移，拖动连线时写入';

-- ─────────────────────────────────────────────
-- 20261118_tree_edge_bend.sql
-- ─────────────────────────────────────────────
-- 父子连线可拖弯：偏移量存在子节点上
alter table public.tree_nodes
  add column if not exists link_bend_x double precision not null default 0,
  add column if not exists link_bend_y double precision not null default 0;

comment on column public.tree_nodes.link_bend_x is '与父节点连线的弯曲偏移（水平）';
comment on column public.tree_nodes.link_bend_y is '与父节点连线的弯曲偏移（垂直）';

-- ─────────────────────────────────────────────
-- 20261118_note_color.sql
-- ─────────────────────────────────────────────
-- 便签：颜色 + 内容支持高亮 / 图片
alter table public.node_notes
  add column if not exists color text not null default 'yellow';

comment on column public.node_notes.color is '便签纯色：yellow / pink / blue / green / purple / orange';

-- ─────────────────────────────────────────────
-- 20261119_node_file_votes.sql
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 20261120_note_canvas.sql
-- ─────────────────────────────────────────────
-- 便签变成画布上的自由卡片：位置 + 尺寸
alter table public.node_notes
  add column if not exists x double precision,
  add column if not exists y double precision,
  add column if not exists width double precision not null default 200,
  add column if not exists height double precision not null default 150;

comment on column public.node_notes.x is '便签在画布上的横坐标（逻辑像素）';
comment on column public.node_notes.y is '便签在画布上的纵坐标（逻辑像素）';
comment on column public.node_notes.width is '便签宽度';
comment on column public.node_notes.height is '便签高度';

-- ─────────────────────────────────────────────
-- 20261121_free_notes.sql
-- ─────────────────────────────────────────────
-- 便签可以脱离节点：自由便签 + 项目归属
alter table public.node_notes
  add column if not exists project_id uuid references public.projects(id) on delete cascade;

alter table public.node_notes
  alter column node_id drop not null;

-- 老数据回填项目
update public.node_notes n
set project_id = t.project_id
from public.tree_nodes t
where n.node_id = t.id and n.project_id is null;

notify pgrst, 'reload schema';
