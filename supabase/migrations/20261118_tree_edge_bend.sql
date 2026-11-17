-- 父子连线可拖弯：偏移量存在子节点上
alter table public.tree_nodes
  add column if not exists link_bend_x double precision not null default 0,
  add column if not exists link_bend_y double precision not null default 0;

comment on column public.tree_nodes.link_bend_x is '与父节点连线的弯曲偏移（水平）';
comment on column public.tree_nodes.link_bend_y is '与父节点连线的弯曲偏移（垂直）';
