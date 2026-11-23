-- Bar Bon Gust: prenotazioni tavoli, accorpamento e preordini da ritirare.
-- Tutte le tabelle hanno RLS attiva: il pubblico legge solo tavoli, carta e impostazioni.
-- Prenotazioni e ordini (con nomi e telefoni) passano solo dalle funzioni qui sotto.
-- La password del personale NON è in questo file: si imposta con
--   update bg_staff set pass_hash = extensions.crypt('PASSWORD', extensions.gen_salt('bf'));

create table if not exists public.bg_settings (key text primary key, value jsonb not null);

create table if not exists public.bg_tables (
  id int primary key,
  seats int not null default 4,
  zone text not null,          -- tavoli della stessa zona con posizioni consecutive si possono unire
  zone_ord int not null,
  pos int not null,
  label text,
  x real not null, y real not null   -- posizione sulla piantina (0..100)
);

create table if not exists public.bg_menu (
  id text primary key,
  cat text not null,
  name text not null,
  name_en text not null default '',
  descr text not null default '',
  price numeric(6,2) not null check (price >= 0),
  half numeric(6,2) check (half is null or half >= 0),   -- prezzo del mezzo bocadillo
  extras boolean not null default false,                -- ammette i supplementi (queso, cebolla, pimiento)
  tags text[] not null default '{}',
  available boolean not null default true,
  preorder boolean not null default true,
  sort int not null default 0
);

create table if not exists public.bg_bookings (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  day date not null,
  start_min int not null,
  end_min int not null,
  people int not null check (people between 1 and 44),
  tables int[] not null,
  name text not null check (length(name) between 2 and 80),
  phone text not null check (length(phone) between 6 and 30),
  email text check (email is null or length(email) <= 120),
  notes text check (notes is null or length(notes) <= 500),
  source text not null default 'web',
  status text not null default 'confirmed' check (status in ('confirmed','seated','done','cancelled','noshow')),
  created_at timestamptz not null default now()
);
create index if not exists bg_bookings_day on public.bg_bookings(day);

create table if not exists public.bg_orders (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  day date not null,
  pickup_min int not null,
  name text not null check (length(name) between 2 and 80),
  phone text not null check (length(phone) between 6 and 30),
  company text check (company is null or length(company) <= 80),
  items jsonb not null,
  total numeric(7,2) not null,
  notes text check (notes is null or length(notes) <= 500),
  status text not null default 'new' check (status in ('new','preparing','ready','picked','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists bg_orders_day on public.bg_orders(day);

create table if not exists public.bg_staff (id int primary key default 1 check (id = 1), pass_hash text not null);

alter table public.bg_settings enable row level security;
alter table public.bg_tables   enable row level security;
alter table public.bg_menu     enable row level security;
alter table public.bg_bookings enable row level security;
alter table public.bg_orders   enable row level security;
alter table public.bg_staff    enable row level security;

drop policy if exists bg_settings_read on public.bg_settings;
create policy bg_settings_read on public.bg_settings for select using (true);
drop policy if exists bg_tables_read on public.bg_tables;
create policy bg_tables_read on public.bg_tables for select using (true);
drop policy if exists bg_menu_read on public.bg_menu;
create policy bg_menu_read on public.bg_menu for select using (true);

-- ---------- funzioni di servizio (non esposte) ----------

create or replace function public.bg_hm(t text) returns int language sql immutable set search_path = public as
$$ select split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int $$;

create or replace function public.bg_now() returns timestamp language sql stable set search_path = public as
$$ select now() at time zone 'Europe/Madrid' $$;

create or replace function public.bg_digits(t text) returns text language sql immutable set search_path = public as
$$ select regexp_replace(coalesce(t, ''), '[^0-9]', '', 'g') $$;

create or replace function public.bg_new_code(prefix text, is_order boolean) returns text
language plpgsql set search_path = public as $$
declare c text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
begin
  loop
    c := prefix;
    for i in 1..4 loop c := c || substr(alphabet, 1 + floor(random() * 32)::int, 1); end loop;
    if is_order then
      exit when not exists (select 1 from bg_orders where code = c);
    else
      exit when not exists (select 1 from bg_bookings where code = c);
    end if;
  end loop;
  return c;
end $$;

-- tavoli occupati in un intervallo (minuti dalla mezzanotte)
create or replace function public.bg_busy(p_day date, s int, e int, p_except uuid default null) returns int[]
language sql stable set search_path = public as $$
  select coalesce(array_agg(distinct t), '{}')
  from bg_bookings b, unnest(b.tables) t
  where b.day = p_day and b.status in ('confirmed','seated')
    and b.start_min < e and b.end_min > s
    and (p_except is null or b.id <> p_except)
$$;

-- tavoli uniti: stessa zona e posizioni consecutive
create or replace function public.bg_is_run(p_tables int[]) returns boolean
language sql stable set search_path = public as $$
  select count(*) = cardinality(p_tables)
     and count(distinct zone) = 1
     and max(pos) - min(pos) + 1 = count(*)
  from bg_tables where id = any(p_tables)
$$;

-- sceglie il gruppo di tavoli vicini più adatto (il primo libero, zona per zona)
create or replace function public.bg_pick(p_day date, s int, e int, p_people int) returns int[]
language plpgsql stable set search_path = public as $$
declare busy int[] := bg_busy(p_day, s, e); k int := ceil(p_people / 4.0); r record; run int[];
begin
  for r in select * from bg_tables order by zone_ord, pos loop
    select array_agg(id order by pos) into run from bg_tables
      where zone = r.zone and pos between r.pos and r.pos + k - 1;
    if cardinality(run) = k and not (run && busy)
       and (select sum(seats) from bg_tables where id = any(run)) >= p_people then
      return run;
    end if;
  end loop;
  return null;
end $$;

create or replace function public.bg_book_core(p jsonb, staff boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  cfg jsonb := (select value from bg_settings where key = 'config');
  d date := (p->>'day')::date;
  s int := bg_hm(p->>'time');
  ppl int := (p->>'people')::int;
  dur int := coalesce((p->>'duration')::int, (cfg->>'dur')::int, 90);
  e int; tbl int[]; dayc jsonb; ok boolean := false; rng jsonb; c text; nowl timestamp := bg_now();
begin
  perform pg_advisory_xact_lock(hashtext('bg_book:' || d::text));
  if ppl is null or ppl < 1 or ppl > 44 then raise exception 'bg:people'; end if;
  e := s + dur;
  if not staff then
    if ppl > coalesce((cfg->>'max_online')::int, 16) then raise exception 'bg:too_many'; end if;
    if d > nowl::date + 60 then raise exception 'bg:too_far'; end if;
    if d + make_interval(mins => s) < nowl + make_interval(mins => coalesce((cfg->>'book_lead')::int, 30)) then
      raise exception 'bg:past';
    end if;
    dayc := cfg->'days'->(extract(isodow from d)::int)::text;
    if dayc is null or jsonb_typeof(dayc) = 'null' then raise exception 'bg:closed'; end if;
    for rng in select * from jsonb_array_elements(dayc->'book') loop
      if s between bg_hm(rng->>0) and bg_hm(rng->>1) and (s - bg_hm(rng->>0)) % 30 = 0 then ok := true; end if;
    end loop;
    if not ok then raise exception 'bg:slot'; end if;
    if exists (select 1 from bg_bookings where day = d and bg_digits(phone) = bg_digits(p->>'phone')
               and status = 'confirmed' and start_min < e and end_min > s) then
      raise exception 'bg:duplicate';
    end if;
  end if;

  if p ? 'tables' and jsonb_array_length(p->'tables') > 0 then
    select array_agg(x::int order by x::int) into tbl from jsonb_array_elements_text(p->'tables') x;
    if (select count(*) from bg_tables where id = any(tbl)) <> cardinality(tbl) then raise exception 'bg:tables'; end if;
    if not staff and not bg_is_run(tbl) then raise exception 'bg:not_adjacent'; end if;
    if not staff and (select sum(seats) from bg_tables where id = any(tbl)) < ppl then raise exception 'bg:too_small'; end if;
    if not staff and (select sum(seats) from bg_tables where id = any(tbl)) - ppl >= 4 then raise exception 'bg:too_big'; end if;
    if tbl && bg_busy(d, s, e) then raise exception 'bg:taken'; end if;
  else
    tbl := bg_pick(d, s, e, ppl);
    if tbl is null then raise exception 'bg:full'; end if;
  end if;

  c := bg_new_code('R', false);
  insert into bg_bookings(code, day, start_min, end_min, people, tables, name, phone, email, notes, source)
  values (c, d, s, e, ppl, tbl, trim(p->>'name'), trim(p->>'phone'), nullif(trim(p->>'email'), ''),
          nullif(trim(p->>'notes'), ''), case when staff then 'staff' else 'web' end);
  return jsonb_build_object('code', c, 'day', d, 'start', s, 'end', e, 'tables', to_jsonb(tbl), 'people', ppl);
end $$;

-- ---------- funzioni pubbliche ----------

create or replace function public.bg_availability(p_day date) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('s', start_min, 'e', end_min, 't', tables)), '[]'::jsonb)
  from bg_bookings where day = p_day and status in ('confirmed','seated')
$$;

create or replace function public.bg_book(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin return bg_book_core(p, false); end $$;

create or replace function public.bg_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb := (select value from bg_settings where key = 'config');
  nowl timestamp := bg_now();
  d date := coalesce((p->>'day')::date, nowl::date);
  t int := bg_hm(p->>'time');
  dayc jsonb := cfg->'days'->(extract(isodow from d)::int)::text;
  it jsonb; m bg_menu; q int; lines jsonb := '[]'; tot numeric := 0; c text;
  hf boolean; ex jsonb; unit numeric; sup numeric := coalesce((cfg->>'extra_price')::numeric, 0.70);
begin
  if dayc is null or jsonb_typeof(dayc) = 'null' then raise exception 'bg:closed'; end if;
  if d > nowl::date + 7 then raise exception 'bg:too_far'; end if;
  if d + make_interval(mins => t) < nowl + make_interval(mins => coalesce((cfg->>'order_lead')::int, 15)) then
    raise exception 'bg:past';
  end if;
  if t < bg_hm(dayc->>'open') + 15 or t > bg_hm(dayc->>'close') - 15 then raise exception 'bg:slot'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]')) = 0 or jsonb_array_length(p->'items') > 30 then
    raise exception 'bg:items';
  end if;
  for it in select * from jsonb_array_elements(p->'items') loop
    select * into m from bg_menu where id = it->>'id' and available and preorder;
    if m.id is null then raise exception 'bg:unavailable:%', it->>'id'; end if;
    q := (it->>'qty')::int;
    if q is null or q < 1 or q > 20 then raise exception 'bg:items'; end if;
    hf := coalesce((it->>'half')::boolean, false) and m.half is not null;
    select coalesce(jsonb_agg(x), '[]') into ex from jsonb_array_elements_text(coalesce(it->'extras', '[]')) x
      where m.extras and x in (select jsonb_array_elements_text(cfg->'extras'));
    unit := case when hf then m.half else m.price end + sup * jsonb_array_length(ex);
    lines := lines || jsonb_build_object('id', m.id, 'name', m.name, 'price', unit, 'qty', q, 'half', hf,
                                         'extras', ex, 'note', left(nullif(trim(it->>'note'), ''), 120));
    tot := tot + unit * q;
  end loop;
  c := bg_new_code('P', true);
  insert into bg_orders(code, day, pickup_min, name, phone, company, items, total, notes)
  values (c, d, t, trim(p->>'name'), trim(p->>'phone'), nullif(trim(p->>'company'), ''), lines, tot,
          nullif(trim(p->>'notes'), ''));
  return jsonb_build_object('code', c, 'day', d, 'time', t, 'total', tot, 'items', lines);
end $$;

-- consultare o annullare con codice + telefono
create or replace function public.bg_lookup(p_code text, p_phone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bg_bookings; o bg_orders;
begin
  select * into b from bg_bookings where code = upper(trim(p_code)) and bg_digits(phone) = bg_digits(p_phone);
  if b.id is not null then
    return jsonb_build_object('kind','booking','code',b.code,'day',b.day,'start',b.start_min,'end',b.end_min,
      'people',b.people,'tables',to_jsonb(b.tables),'name',b.name,'status',b.status);
  end if;
  select * into o from bg_orders where code = upper(trim(p_code)) and bg_digits(phone) = bg_digits(p_phone);
  if o.id is not null then
    return jsonb_build_object('kind','order','code',o.code,'day',o.day,'time',o.pickup_min,'items',o.items,
      'total',o.total,'name',o.name,'status',o.status);
  end if;
  return null;
end $$;

create or replace function public.bg_cancel(p_code text, p_phone text) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update bg_bookings set status = 'cancelled'
   where code = upper(trim(p_code)) and bg_digits(phone) = bg_digits(p_phone) and status = 'confirmed';
  get diagnostics n = row_count;
  if n = 0 then
    update bg_orders set status = 'cancelled'
     where code = upper(trim(p_code)) and bg_digits(phone) = bg_digits(p_phone) and status = 'new';
    get diagnostics n = row_count;
  end if;
  return n > 0;
end $$;

-- stato di un ordine (solo codice: nessun dato personale)
create or replace function public.bg_order_status(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select status from bg_orders where code = upper(trim(p_code))
$$;

-- ---------- pannello del personale ----------

create or replace function public.bg_admin(p_pass text, p_action text, p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare h text := (select pass_hash from bg_staff where id = 1); d date; r jsonb; b bg_bookings; tbl int[];
begin
  if h is null or crypt(coalesce(p_pass, ''), h) <> h then
    perform pg_sleep(1);
    raise exception 'bg:auth';
  end if;

  if p_action = 'login' then
    return jsonb_build_object('ok', true);

  elsif p_action = 'day' then
    d := (p->>'day')::date;
    return jsonb_build_object(
      'bookings', (select coalesce(jsonb_agg(to_jsonb(x) order by x.start_min, x.created_at), '[]') from bg_bookings x where x.day = d),
      'orders',   (select coalesce(jsonb_agg(to_jsonb(x) order by x.pickup_min, x.created_at), '[]') from bg_orders x where x.day = d));

  elsif p_action = 'book' then
    return bg_book_core(p, true);

  elsif p_action = 'booking' then
    select * into b from bg_bookings where id = (p->>'id')::uuid for update;
    if b.id is null then raise exception 'bg:not_found'; end if;
    if p ? 'tables' then
      select array_agg(x::int order by x::int) into tbl from jsonb_array_elements_text(p->'tables') x;
      perform pg_advisory_xact_lock(hashtext('bg_book:' || b.day::text));
      if tbl && bg_busy(b.day, b.start_min, b.end_min, b.id) then raise exception 'bg:taken'; end if;
      update bg_bookings set tables = tbl where id = b.id;
    end if;
    if p ? 'status' then update bg_bookings set status = p->>'status' where id = b.id; end if;
    if p ? 'people' then update bg_bookings set people = (p->>'people')::int where id = b.id; end if;
    return (select to_jsonb(x) from bg_bookings x where id = b.id);

  elsif p_action = 'order' then
    update bg_orders set status = p->>'status' where id = (p->>'id')::uuid returning to_jsonb(bg_orders.*) into r;
    return r;

  elsif p_action = 'menu' then
    insert into bg_menu(id, cat, name, name_en, descr, price, half, extras, tags, available, preorder, sort)
    values (p->>'id', p->>'cat', p->>'name', coalesce(p->>'name_en',''), coalesce(p->>'descr',''), (p->>'price')::numeric,
            nullif(p->>'half','')::numeric, coalesce((p->>'extras')::boolean, false),
            coalesce((select array_agg(x) from jsonb_array_elements_text(p->'tags') x), '{}'),
            coalesce((p->>'available')::boolean, true), coalesce((p->>'preorder')::boolean, true),
            coalesce((p->>'sort')::int, 0))
    on conflict (id) do update set cat = excluded.cat, name = excluded.name, name_en = excluded.name_en, descr = excluded.descr,
      price = excluded.price, half = excluded.half, extras = excluded.extras, tags = excluded.tags, available = excluded.available,
      preorder = excluded.preorder, sort = excluded.sort;
    return (select to_jsonb(x) from bg_menu x where id = p->>'id');

  elsif p_action = 'menu_delete' then
    delete from bg_menu where id = p->>'id';
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'bg:action';
end $$;

-- solo le funzioni pubbliche sono chiamabili dal sito
revoke all on function public.bg_book_core(jsonb, boolean) from public, anon, authenticated;
revoke all on function public.bg_new_code(text, boolean) from public, anon, authenticated;
revoke all on function public.bg_pick(date, int, int, int) from public, anon, authenticated;
revoke all on function public.bg_busy(date, int, int, uuid) from public, anon, authenticated;
grant execute on function public.bg_availability(date) to anon, authenticated;
grant execute on function public.bg_book(jsonb) to anon, authenticated;
grant execute on function public.bg_order(jsonb) to anon, authenticated;
grant execute on function public.bg_lookup(text, text) to anon, authenticated;
grant execute on function public.bg_cancel(text, text) to anon, authenticated;
grant execute on function public.bg_order_status(text) to anon, authenticated;
grant execute on function public.bg_admin(text, text, jsonb) to anon, authenticated;
