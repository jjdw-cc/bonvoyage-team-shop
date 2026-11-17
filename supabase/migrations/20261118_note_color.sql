-- 便签：颜色 + 内容支持高亮 / 图片
alter table public.node_notes
  add column if not exists color text not null default 'yellow';

comment on column public.node_notes.color is '便签纯色：yellow / pink / blue / green / purple / orange';
