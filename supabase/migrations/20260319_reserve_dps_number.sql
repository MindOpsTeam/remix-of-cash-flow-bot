-- Atomic function to reserve the next DPS number (prevents race conditions)
CREATE OR REPLACE FUNCTION reserve_next_dps_number(config_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  current_num BIGINT;
BEGIN
  UPDATE nfse_config
  SET proximo_numero_dps = proximo_numero_dps + 1
  WHERE id = config_id
  RETURNING proximo_numero_dps - 1 INTO current_num;

  RETURN current_num;
END;
$$;
