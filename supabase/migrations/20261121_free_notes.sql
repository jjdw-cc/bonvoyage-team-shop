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
