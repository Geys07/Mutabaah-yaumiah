do $$
declare
  v_definition text;
  v_old text := 'WHERE link.activity_id=a.id AND p.starts_on <= p_end_date AND p.ends_on >= p_start_date';
  v_new text := 'WHERE link.activity_id=a.id AND p.starts_on <= p_end_date AND p.ends_on >= greatest(p_start_date,v_calc_start)';
begin
  v_definition := pg_get_functiondef('public.get_mutabaah_bonus_counts(uuid,date,date)'::regprocedure);
  if position(v_old in v_definition) = 0 then
    raise exception 'Bonus Ramadan date condition not found; refusing partial patch';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$$;
