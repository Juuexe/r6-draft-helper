"""Convert Ubisoft's one-row-per-player CSV dump into one row per round."""
import argparse
from pathlib import Path

import duckdb


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("input", help="Path to the downloaded raw CSV")
    p.add_argument("--output", default="data/rounds.csv")
    p.add_argument("--sample", type=int, default=0, help="Optional maximum rounds, randomly sampled for a quick first model")
    p.add_argument("--sample-fraction", type=float, default=0.1, help="When --sample is used, first filter a deterministic random fraction of rounds while scanning (default 0.1)")
    p.add_argument("--memory-limit", default="6GB", help="DuckDB memory limit; lower this if your computer runs out of memory")
    args = p.parse_args()
    source = str(Path(args.input).resolve()).replace("'", "''")
    output = str(Path(args.output).resolve()).replace("'", "''")
    if not 0 < args.sample_fraction <= 1:
        raise SystemExit("--sample-fraction must be greater than 0 and no greater than 1")
    Path("work/duckdb_temp").mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute(f"SET memory_limit='{args.memory_limit}'")
    con.execute("SET temp_directory='work/duckdb_temp'")
    # Ubisoft's dump uses one player per row. We aggregate five operators per side.
    # Grouping by platform as well as matchid avoids collisions across platforms.
    sample_filter = f"WHERE hash(matchid, roundnumber) % {max(1, round(1 / args.sample_fraction))} = 0" if args.sample else ""
    query = f"""
      COPY (
        WITH players AS (
          SELECT * FROM read_csv_auto('{source}', sample_size=200000)
          {sample_filter}
        )
        SELECT platform, matchid, roundnumber,
          string_agg(DISTINCT upper(regexp_extract(operator, '[^-]+$', 0)), '|' ORDER BY upper(regexp_extract(operator, '[^-]+$', 0))) FILTER (WHERE lower(role) IN ('att','attack','attacker')) AS attack_ops,
          string_agg(DISTINCT upper(regexp_extract(operator, '[^-]+$', 0)), '|' ORDER BY upper(regexp_extract(operator, '[^-]+$', 0))) FILTER (WHERE lower(role) IN ('def','defense','defender')) AS defense_ops,
          CASE WHEN lower(max(winrole)) IN ('att','attack','attacker') THEN 1 ELSE 0 END AS attack_won
        FROM players
        GROUP BY platform, matchid, roundnumber
        HAVING count(DISTINCT upper(regexp_extract(operator, '[^-]+$', 0))) FILTER (WHERE lower(role) IN ('att','attack','attacker')) = 5
           AND count(DISTINCT upper(regexp_extract(operator, '[^-]+$', 0))) FILTER (WHERE lower(role) IN ('def','defense','defender')) = 5
        {f'ORDER BY hash(matchid, roundnumber) LIMIT {args.sample}' if args.sample else ''}
      ) TO '{output}' (HEADER, DELIMITER ',')
    """
    con.execute(query)
    print(f"Wrote round-level data to {output}")


if __name__ == "__main__":
    main()

