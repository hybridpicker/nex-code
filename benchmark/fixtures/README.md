# Benchmark Fixtures

This directory is the preferred home for reproducible real-life benchmark
fixtures.

Rules:
- Store sanitized project snapshots here when a benchmark task depends on
  external source material.
- Keep fixture paths stable so `sourceProject` values in
  `scripts/benchmark-reallife-tasks.js` remain portable across machines.
- Use `NEX_BENCHMARK_FIXTURES_DIR=/abs/path` to test an alternate fixture set.

Resolution order for benchmark fixtures:
1. `NEX_BENCHMARK_FIXTURES_DIR`
2. `benchmark/fixtures`
3. `~/Coding` fallback for local legacy runs
