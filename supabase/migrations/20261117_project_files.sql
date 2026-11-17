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
