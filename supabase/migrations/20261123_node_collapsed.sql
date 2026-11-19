-- 节点功能块的折叠状态（所有人共享）
alter table public.tree_nodes
  add column if not exists collapsed jsonb default '{}'::jsonb;

comment on column public.tree_nodes.collapsed is '功能块折叠状态：{"notes":true,"files":false}';
