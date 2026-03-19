CREATE OR REPLACE FUNCTION public.reserve_next_dps_number(config_id UUID)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE current_num BIGINT;
BEGIN
  UPDATE nfse_config SET proximo_numero_dps = proximo_numero_dps + 1
  WHERE id = config_id
  RETURNING proximo_numero_dps - 1 INTO current_num;
  RETURN current_num;
END; $$;