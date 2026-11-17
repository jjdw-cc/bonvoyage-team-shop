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
