#!/usr/bin/env python3
"""
Plotly-based RTDB client

Fetches sensor data from Firebase Realtime Database and writes modern interactive
plots (HTML) to the `plots/` directory. Attempts to also export PNGs (requires
`kaleido`). Designed to work in WSL (headless) by producing HTML files you can
open in a browser.
"""

import argparse
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import cast

import firebase_admin
from firebase_admin import credentials, db
from dateutil import tz
import plotly.graph_objects as go
import plotly.io as pio

DB_REF_PATH = "/sensors/device1"
SERVICE_ACCOUNT = "moist-meat-monitor-firebase-adminsdk-fbsvc-a2be73f4d8.json"
DATABASE_URL = "https://moist-meat-monitor-default-rtdb.firebaseio.com/"


@dataclass
class Reading:
    key: str
    timestamp: datetime
    temperature: float | None
    humidity: float | None


def init_firebase():
    if not os.path.exists(SERVICE_ACCOUNT):
        print(f"Service account not found: {SERVICE_ACCOUNT} (skipping init)")
        return
    cred = credentials.Certificate(SERVICE_ACCOUNT)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})


def parse_timestamp(ts: str) -> datetime | None:
    """Parse timestamp from epoch (s/ms) or ISO format."""
    try:
        ts_num = float(ts)
        if ts_num > 1e11:
            return datetime.fromtimestamp(ts_num / 1000.0, tz=timezone.utc)
        return datetime.fromtimestamp(ts_num, tz=timezone.utc)
    except ValueError:
        pass

    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        pass

    try:
        return datetime.strptime(ts, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def parse_cli_timestamp(
    ts_str: str | None, tz_name: str | None = None
) -> datetime | None:
    """Parse CLI timestamp, applying timezone if naive."""
    if not ts_str:
        return None

    ts_dt = parse_timestamp(ts_str)
    if ts_dt is None:
        print(f"Unable to parse timestamp: {ts_str}")
        return None

    if ts_dt.tzinfo is None:
        tzinfo = tz.gettz(tz_name) if tz_name else timezone.utc
        ts_dt = ts_dt.replace(tzinfo=tzinfo or timezone.utc)

    return ts_dt.astimezone(timezone.utc)


def fetch_data(
    start_dt: datetime | None = None,
    end_dt: datetime | None = None,
    verbose: bool = False,
) -> list[Reading]:
    """Fetch sensor data from Firebase, optionally filtered by time range."""
    ref = db.reference(DB_REF_PATH)
    raw = cast(dict, ref.get())
    if not raw:
        print("No data returned from the database.")
        return []

    rows: list[Reading] = []
    skipped = 0

    for key, entry in raw.items():
        if not isinstance(entry, dict):
            continue

        ts = entry.get("timestamp")
        if ts is None:
            continue

        ts_dt = parse_timestamp(str(ts))
        if ts_dt is None or ts_dt.year < 2000:
            skipped += 1
            continue

        rows.append(
            Reading(
                key=key,
                timestamp=ts_dt,
                temperature=entry.get("temperature"),
                humidity=entry.get("humidity"),
            )
        )

    if not rows:
        return []

    rows.sort(key=lambda r: r.timestamp)

    if verbose:
        first, last = rows[0].timestamp, rows[-1].timestamp
        print(f"Fetched {len(rows)} rows. Range: {first} -> {last}")
        print(f"Skipped {skipped} entries with invalid timestamps")

    if start_dt is None and end_dt is None:
        now = datetime.now(timezone.utc)
        start_dt = now - timedelta(days=1)
        end_dt = now

    if start_dt is not None:
        rows = [r for r in rows if r.timestamp >= start_dt]
    if end_dt is not None:
        rows = [r for r in rows if r.timestamp <= end_dt]

    if verbose:
        print(f"Rows after filtering: {len(rows)}")
        if rows:
            print(f"Filtered range: {rows[0].timestamp} -> {rows[-1].timestamp}")

    return rows


def get_latest_reading() -> tuple | None:
    """Get the most recent sensor reading."""
    ref = db.reference(DB_REF_PATH)
    raw = cast(dict, ref.get())
    if not raw:
        return None

    latest = None
    latest_dt = None

    for key, entry in raw.items():
        if not isinstance(entry, dict):
            continue
        ts = entry.get("timestamp")
        if ts is None:
            continue
        ts_dt = parse_timestamp(str(ts))
        if ts_dt is None:
            continue
        if latest_dt is None or ts_dt > latest_dt:
            latest_dt = ts_dt
            latest = (key, entry, ts_dt)

    return latest


def ensure_plots_dir():
    os.makedirs("plots", exist_ok=True)
    return "plots"


def save_fig(fig, base_path: str, save_png: bool = True):
    html_path = f"{base_path}.html"
    fig.write_html(html_path, include_plotlyjs="cdn")
    print(f"Saved interactive plot: {html_path}")
    if save_png:
        try:
            pio.write_image(fig, f"{base_path}.png", scale=2)
            print(f"Saved static image: {base_path}.png")
        except Exception:
            print("PNG export failed — install `kaleido`: pip install kaleido")


def make_plots(rows: list[Reading], plots_dir: str, display_tz: str = "UTC"):
    if not rows:
        print("No data to plot.")
        return

    timestamps = [r.timestamp for r in rows]
    temperatures = [r.temperature for r in rows]
    humidities = [r.humidity for r in rows]

    fig_t = go.Figure(
        go.Scatter(
            x=timestamps, y=temperatures, mode="lines+markers", name="Temperature"
        )
    )
    fig_t.update_layout(
        title="Temperature",
        xaxis_title="Time",
        yaxis_title="Temperature (°C)",
        template="plotly_white",
        hovermode="x unified",
    )
    save_fig(fig_t, os.path.join(plots_dir, "temperature"))

    fig_h = go.Figure(
        go.Scatter(x=timestamps, y=humidities, mode="lines+markers", name="Humidity")
    )
    fig_h.update_layout(
        title="Humidity",
        xaxis_title="Time",
        yaxis_title="Humidity (%)",
        template="plotly_white",
        hovermode="x unified",
    )
    save_fig(fig_h, os.path.join(plots_dir, "humidity"))


def main():
    parser = argparse.ArgumentParser(
        description="Fetch sensor data and generate Plotly graphs."
    )
    parser.add_argument("--start", "-s", help="Start timestamp (epoch or ISO datetime)")
    parser.add_argument("--end", "-e", help="End timestamp (epoch or ISO datetime)")
    parser.add_argument(
        "--debug", "-d", action="store_true", help="Show latest reading and exit"
    )
    parser.add_argument(
        "--tz", default="America/Chicago", help="Timezone for CLI timestamps"
    )
    parser.add_argument(
        "--display-tz", default="America/Chicago", help="Timezone for plot x-axis"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Show debug output"
    )
    parser.add_argument("--hours", type=float, help="Relative timeframe: last N hours")
    args = parser.parse_args()

    start_dt = parse_cli_timestamp(args.start, args.tz)
    end_dt = parse_cli_timestamp(args.end, args.tz)

    if args.hours is not None:
        tzinfo = tz.gettz(args.tz) or timezone.utc
        now = datetime.now(tzinfo).astimezone(timezone.utc)
        buffer = timedelta(minutes=30)
        start_dt = now - timedelta(hours=args.hours) - buffer
        end_dt = now + buffer

    init_firebase()

    if args.debug:
        latest = get_latest_reading()
        if latest is None:
            print("No data available.")
            sys.exit(0)
        key, entry, ts_dt = latest
        print("Latest reading:")
        print(f"  key: {key}")
        print(f"  timestamp: {ts_dt}")
        print(f"  temperature: {entry.get('temperature')}")
        print(f"  humidity: {entry.get('humidity')}")
        sys.exit(0)

    rows = fetch_data(start_dt, end_dt, verbose=args.verbose)

    if not rows and (args.start or args.end):
        print("Retrying with local timezone interpretation...")
        start_dt = parse_cli_timestamp(args.start, None)
        end_dt = parse_cli_timestamp(args.end, None)
        rows = fetch_data(start_dt, end_dt, verbose=args.verbose)

    if not rows:
        print("No data matched the requested time range.")
        sys.exit(1)

    make_plots(rows, ensure_plots_dir(), args.display_tz or args.tz)


if __name__ == "__main__":
    main()
