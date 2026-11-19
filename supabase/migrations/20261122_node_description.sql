-- 节点功能简述
alter table public.tree_nodes
  add column if not exists description text;

comment on column public.tree_nodes.description is '节点功能简述，只有创建人可以编辑';
