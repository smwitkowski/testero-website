-- Read-only counts. Run with psql -X -v ON_ERROR_STOP=1 --csv -t -f this_file.
-- Only counts are printed, never user rows. Record BEFORE and AFTER for every old table.
SELECT format('SELECT %L AS schema_name,%L AS table_name,count(*) AS row_count FROM %I.%I;',
 n.nspname,c.relname,n.nspname,c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','archive','vecs','vector') AND c.relkind='r'
ORDER BY n.nspname,c.relname
\gexec
