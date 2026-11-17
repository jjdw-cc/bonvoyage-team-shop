-- 跨树连线可弯曲：记录相对中点的偏移量
alter table public.tree_links
  add column if not exists bend_x double precision not null default 0,
  add column if not exists bend_y double precision not null default 0;

comment on column public.tree_links.bend_x is '连线中点的水平偏移，拖动连线时写入';
comment on column public.tree_links.bend_y is '连线中点的垂直偏移，拖动连线时写入';
