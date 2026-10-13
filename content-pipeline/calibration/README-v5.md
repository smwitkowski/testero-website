# V5 offline replay

See `../PROCESS.md` for operator flow, calibration limits, thresholds and exact
next commands. Run `uv run pytest -q tests/test_pipeline_v5.py` from the pipeline.

No fresh model calls or DB writes were made. Batch7/8 replay catches one known
pair among 153; it does not prove a general semantic duplicate detector. Argon
review projection/blind replay is test-only, not production gate provenance.
