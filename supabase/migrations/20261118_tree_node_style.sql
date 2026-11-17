-- 节点样式：大小与颜色
-- 在 20261118_project_tree.sql 之后执行；幂等。

alter table public.tree_nodes
  add column if not exists width  double precision not null default 196,
  add column if not exists height double precision not null default 66,
  add column if not exists color  text not null default 'plain';

comment on column public.tree_nodes.width  is '节点宽度（画布逻辑像素）';
comment on column public.tree_nodes.height is '节点高度（画布逻辑像素）';
comment on column public.tree_nodes.color  is '配色 key：plain / indigo / sky / emerald / amber / rose / slate';
