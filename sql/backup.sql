-- 싯다르타 자동 백업 (전체): public 스키마의 모든 표에서, 줄이 바뀌거나 지워지기 "직전" 내용을 sdt_history에 남김.
-- 같은 줄은 10분에 한 번, 내용이 확 줄어드는 저장(덮어쓰기·지움)은 바로. 60일 보관.
-- Supabase → SQL Editor에 통째로 붙여넣고 Run 한 번이면 끝. 여러 번 실행해도 안전하고, 새 표가 생기면 다시 Run 하면 그 표도 들어감.

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
declare o jsonb; n jsonb; own uuid; rid text;
begin
  o := to_jsonb(OLD);
  if TG_OP = 'UPDATE' then n := to_jsonb(NEW); if o = n then return NEW; end if; end if;
  rid := coalesce(o->>'id', o->>'key', md5(o::text));
  -- 누구 것인지: user_id / teacher_id / owner_id 칸, 프로필은 id, 학습지 답안은 학습지 주인
  begin
    own := coalesce(nullif(o->>'user_id','')::uuid, nullif(o->>'teacher_id','')::uuid, nullif(o->>'owner_id','')::uuid,
                    case when TG_TABLE_NAME = 'profiles' then nullif(o->>'id','')::uuid end);
  exception when others then own := null; end;
  if own is null and o ? 'worksheet_id' then
    begin select w.user_id into own from worksheets w where w.id::text = o->>'worksheet_id'; exception when others then own := null; end;
  end if;
  if TG_OP = 'UPDATE'
     and length(n::text) >= length(o::text) * 0.7
     and exists(select 1 from sdt_history h where h.tbl = TG_TABLE_NAME and h.row_id = rid and h.at > now() - interval '10 minutes') then
    return NEW;
  end if;
  insert into sdt_history(tbl,row_id,owner,op,data) values(TG_TABLE_NAME,rid,own,TG_OP,o);
  if random() < 0.01 then delete from sdt_history where at < now() - interval '60 days'; end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;

-- 예전 버전에서 만든 개별 트리거 정리
drop trigger if exists sdt_hist_students on public.students;
drop trigger if exists sdt_hist_subs on public.worksheet_submissions;
drop trigger if exists sdt_hist_ws on public.worksheets;

-- public의 모든 표(백업 표 자신 빼고)에 붙임
do $$
declare t record;
begin
  for t in select table_name from information_schema.tables
           where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'sdt_history'
  loop
    execute format('drop trigger if exists sdt_hist_all on public.%I', t.table_name);
    execute format('create trigger sdt_hist_all before update or delete on public.%I for each row execute function public.sdt_hist()', t.table_name);
  end loop;
end $$;

-- 확인용: 백업이 붙은 표 목록
select event_object_table as "백업 중인 표" from information_schema.triggers
where trigger_name = 'sdt_hist_all' group by 1 order by 1;
