-- =========================================================
-- profiles: extiende auth.users con nombre, rol y estado.
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role_id uuid not null references public.roles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_role_id on public.profiles (role_id);

-- Cuando se crea un usuario en auth.users (Supabase Auth), se crea
-- automaticamente su fila en profiles con el rol de menor privilegio
-- (Consulta) como valor seguro por defecto. Un Administrador debe
-- entrar despues a Configuracion > Usuarios y asignarle el rol correcto.
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_role_id uuid;
begin
  select id into v_default_role_id from public.roles where name = 'Consulta';

  insert into public.profiles (id, full_name, email, role_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    v_default_role_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function public.fn_handle_new_user();
