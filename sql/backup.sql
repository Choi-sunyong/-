-- 싯다르타 자동 백업: 학생 생기부(students)와 학생 학습지 답안(worksheet_submissions)이
-- 바뀌거나 지워지기 "직전" 내용을 sdt_history에 자동으로 남김. (같은 칸은 10분에 한 번, 내용이 확 줄면 바로, 60일 보관)
-- Supabase → SQL Editor에 통째로 붙여넣고 Run 한 번이면 끝. 여러 번 실행해도 안전.

create table if not exists public.sdt_history(
  id bigserial primary key,
  tbl text not null,
  row_id text not null,
  owner uuid,
  op text not null,
  data jsonb not null,
  at timestamptz not null default now()
);
create index if not exists sdt_history_row on public.sdt_history(tbl,row_id,at desc);
create index if not exists sdt_history_owner on public.sdt_history(owner,at desc);

alter table public.sdt_history enable row level security;
drop policy if exists sdt_history_read on public.sdt_history;
create policy sdt_history_read on public.sdt_history for select using (owner = auth.uid());

create or replace function public.sdt_hist() returns trigger
language plpgsql security definer set search_path = public as $$
declare own uuid; rid text;
begin
  rid := OLD.id::text;
  if TG_OP = 'UPDATE' and to_jsonb(OLD) = to_jsonb(NEW) then return NEW; end if;
  if TG_TABLE_NAME = 'students' then own := OLD.user_id;
  else select w.user_id into own from worksheets w where w.id = OLD.worksheet_id; end if;
  -- 평소엔 10분에 한 번만 남기되, 내용이 확 줄어드는 저장(덮어쓰기·지움)은 무조건 바로 남김
  if TG_OP = 'UPDATE'
     and length(to_jsonb(NEW)::text) >= length(to_jsonb(OLD)::text) * 0.7
     and exists(select 1 from sdt_history h where h.tbl = TG_TABLE_NAME and h.row_id = rid and h.at > now() - interval '10 minutes') then
    return NEW;
  end if;
  insert into sdt_history(tbl,row_id,owner,op,data) values(TG_TABLE_NAME,rid,own,TG_OP,to_jsonb(OLD));
  if random() < 0.01 then delete from sdt_history where at < now() - interval '60 days'; end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

drop trigger if exists sdt_hist_students on public.students;
create trigger sdt_hist_students before update or delete on public.students
  for each row execute function public.sdt_hist();
drop trigger if exists sdt_hist_subs on public.worksheet_submissions;
create trigger sdt_hist_subs before update or delete on public.worksheet_submissions
  for each row execute function public.sdt_hist();
