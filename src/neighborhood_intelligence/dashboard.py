from __future__ import annotations

from datetime import date
import json
from pathlib import Path
from urllib.parse import parse_qs
from wsgiref.simple_server import make_server

from .db import connect, migrate
from .observations import latest_observations_as_of


PAGE = """<!doctype html>
<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">
<title>Neighborhood Investment Intelligence</title>
<style>body{font:16px system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#172033;background:#f7f8fa}h1{margin-bottom:.25rem}.sub{color:#536171}form{display:flex;gap:.75rem;flex-wrap:wrap;background:white;padding:1rem;border-radius:.6rem;margin:1.5rem 0}label{display:grid;gap:.25rem;font-weight:600}input,select,button{font:inherit;padding:.45rem}button{background:#175cd3;color:white;border:0;border-radius:.3rem;align-self:end;cursor:pointer}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:left;padding:.6rem;border-bottom:1px solid #e5e7eb}th{background:#eef4ff}#status{min-height:1.5rem;color:#536171}.badge{font-size:.8rem;border-radius:1rem;padding:.15rem .45rem;background:#edf2f7;white-space:nowrap}</style>
</head><body><h1>Neighborhood Investment Intelligence</h1><p class=\"sub\">Observed source vintages first. Nowcasts and forecasts are explicitly labeled and never overwrite observed data.</p>
<form id=\"query\"><label>Geography<select name=\"geography_type\"><option value=\"tract\">Census tract</option><option value=\"county\">County</option></select></label><label>GEOID<input name=\"geography_id\" required placeholder=\"e.g. 11001006202\"></label><label>As-of date<input name=\"as_of\" type=\"date\" required></label><button>Load latest known values</button></form>
<p id=\"status\"></p><table><thead><tr><th>Metric</th><th>Value</th><th>Reference period</th><th>Source / resolution</th><th>Type</th></tr></thead><tbody id=\"rows\"></tbody></table>
<script>document.querySelector('[name=as_of]').value=new Date().toISOString().slice(0,10);const form=document.querySelector('#query'),status=document.querySelector('#status'),body=document.querySelector('#rows');form.addEventListener('submit',async e=>{e.preventDefault();body.innerHTML='';status.textContent='Loading…';const q=new URLSearchParams(new FormData(form));const r=await fetch('/api/observations?'+q);const data=await r.json();if(!r.ok){status.textContent=data.error||'Request failed';return}status.textContent=`${data.count} latest values known on ${q.get('as_of')}`;for(const x of data.items){const row=document.createElement('tr');row.innerHTML=`<td>${x.metric_id}</td><td>${x.value==null?'—':Number(x.value).toLocaleString()}</td><td>${x.reference_period_start} – ${x.reference_period_end}</td><td>${x.source_id} <span class=\"badge\">${x.geographic_resolution}</span></td><td><span class=\"badge\">${x.observation_type}</span></td>`;body.append(row)}});</script></body></html>"""


def _json_response(start_response, status: str, payload: object):
    encoded = json.dumps(payload, default=str).encode()
    start_response(status, [("Content-Type", "application/json; charset=utf-8"), ("Content-Length", str(len(encoded)))])
    return [encoded]


def dashboard_app(database_path: Path):
    """Create a local, read-only WSGI dashboard application."""

    def app(environ, start_response):
        path = environ.get("PATH_INFO", "/")
        if path == "/":
            body = PAGE.encode()
            start_response("200 OK", [("Content-Type", "text/html; charset=utf-8"), ("Content-Length", str(len(body)))])
            return [body]
        if path != "/api/observations":
            return _json_response(start_response, "404 Not Found", {"error": "Not found"})

        query = parse_qs(environ.get("QUERY_STRING", ""))
        geography_type = query.get("geography_type", [""])[0]
        geography_id = query.get("geography_id", [""])[0]
        as_of_raw = query.get("as_of", [""])[0]
        if geography_type not in {"tract", "county"} or not geography_id:
            return _json_response(start_response, "400 Bad Request", {"error": "Provide a geography type and GEOID."})
        try:
            as_of = date.fromisoformat(as_of_raw)
        except ValueError:
            return _json_response(start_response, "400 Bad Request", {"error": "Use an ISO as-of date."})

        conn = connect(database_path, read_only=True)
        try:
            rows = latest_observations_as_of(conn, as_of, geography_type, [geography_id])
        finally:
            conn.close()
        keys = ["source_id", "geography_type", "geography_id", "metric_id", "reference_period_start", "reference_period_end", "available_at", "observation_type", "geographic_resolution", "value", "lower_bound", "upper_bound", "source_vintage", "method_version", "ingestion_run_id"]
        return _json_response(start_response, "200 OK", {"count": len(rows), "items": [dict(zip(keys, row, strict=True)) for row in rows]})

    return app


def serve_dashboard(database_path: Path, host: str = "127.0.0.1", port: int = 8787) -> None:
    """Serve the local dashboard without exposing the warehouse to the network by default."""
    # Apply migrations before opening a read-only connection for request handling.
    conn = connect(database_path)
    try:
        migrate(conn, Path("migrations/duckdb"))
    finally:
        conn.close()
    with make_server(host, port, dashboard_app(database_path)) as server:
        print(f"Dashboard available at http://{host}:{port}")
        server.serve_forever()
