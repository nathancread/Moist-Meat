#!/usr/bin/env python3
"""
Plotly-based RTDB client

Fetches sensor data from Firebase Realtime Database and writes modern interactive
plots (HTML) to the `plots/` directory. Attempts to also export PNGs (requires
`kaleido`). Designed to work in WSL (headless) by producing HTML files you can
open in a browser.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

import argparse
import typing
import firebase_admin
from firebase_admin import credentials, db
from dateutil import tz
import pandas as pd
import plotly.express as px
import plotly.io as pio

# Configuration - adjust this DB path if yours differs
DB_REF_PATH = "/sensors/device1"
SERVICE_ACCOUNT = "moist-meat-monitor-firebase-adminsdk-fbsvc-a2be73f4d8.json"
DATABASE_URL = "https://moist-meat-monitor-default-rtdb.firebaseio.com/"


def init_firebase():
    """Initialize Firebase if no default app exists.

    This function intentionally initializes only when `firebase_admin._apps`
    is empty. The script will not reinitialize an existing default app.
    """
    if not os.path.exists(SERVICE_ACCOUNT):
        print(f"Service account not found: {SERVICE_ACCOUNT} (skipping init)")
        return

    cred = credentials.Certificate(SERVICE_ACCOUNT)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred, {"databaseURL": DATABASE_URL})


VERBOSE = False


def fetch_data(start_dt: typing.Optional[datetime] = None, end_dt: typing.Optional[datetime] = None, apply_filter: bool = True) -> pd.DataFrame:
    ref = db.reference(DB_REF_PATH)
    raw = ref.get()
    if not raw:
        print("No data returned from the database.")
        return pd.DataFrame()

    rows = []
    skipped_old_count = 0
    for key, entry in raw.items():
        if not isinstance(entry, dict):
            continue
        ts = entry.get("timestamp")
        if ts is None:
            continue
        # Robust timestamp parsing: support seconds or milliseconds (common on devices)
        ts_dt = None
        # Robust timestamp parsing: support seconds or milliseconds (common on devices)
        ts_dt = None
        parsed_ok = False
        # First try numeric (int/float) timestamps, including strings like '1767760276.0'
        try:
            ts_num = float(ts)
            # seconds since epoch are ~1e9; milliseconds are ~1e12. Use threshold to detect ms.
            if ts_num > 1e11:
                ts_dt = datetime.fromtimestamp(ts_num / 1000.0, tz=timezone.utc)
            else:
                ts_dt = datetime.fromtimestamp(ts_num, tz=timezone.utc)
            parsed_ok = True
        except Exception:
            # fallback to pandas datetime parsing (ISO strings, etc.) with UTC
            try:
                pdt = pd.to_datetime(ts, utc=True)
                # If pandas returned NaT, consider it a parse failure
                if pd.isna(pdt):
                    parsed_ok = False
                else:
                    ts_dt = pdt.to_pydatetime()
                    parsed_ok = True
            except Exception:
                parsed_ok = False

        if not parsed_ok:
            # Skip entries we can't parse
            continue

        # Skip obviously-bad timestamps (device counters or malformed values)
        # e.g., any year before 2000 is considered invalid for our dataset
        try:
            if ts_dt.year < 2000:
                skipped_old_count += 1
                continue
        except Exception:
            # If ts_dt has no year attribute for some reason, skip it
            continue

        rows.append({
            "key": key,
            "timestamp": ts_dt,
            "temperature": entry.get("temperature"),
            "humidity": entry.get("humidity"),
        })

    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df = df.sort_values("timestamp")

    # Show fetched summary only in verbose mode
    try:
        first = df["timestamp"].min()
        last = df["timestamp"].max()
        if VERBOSE:
            print(f"Fetched {len(df)} rows. Range: {first} -> {last}")
            print(f"Skipped {skipped_old_count} entries with implausible timestamps (year < 2000)")
            head_sample = df["timestamp"].head(10).tolist()
            tail_sample = df["timestamp"].tail(10).tolist()
            print("Sample parsed timestamps (first 10):")
            for s in head_sample:
                print(f"  {s}")
            print("Sample parsed timestamps (last 10):")
            for s in tail_sample:
                print(f"  {s}")
    except Exception:
        pass

    now = datetime.now(timezone.utc)
    # Optionally apply filtering based on provided start_dt/end_dt. If none provided, default to last 24 hours.
    if apply_filter:
        if start_dt is None and end_dt is None:
            start_dt = now - timedelta(days=1)
            end_dt = now

        if start_dt is not None:
            df = df[df["timestamp"] >= start_dt]
        if end_dt is not None:
            df = df[df["timestamp"] <= end_dt]

    # Show filtered counts only in verbose mode
    if VERBOSE:
        print(f"Rows after filtering: {len(df)} (start={start_dt}, end={end_dt})")
        try:
            if not df.empty:
                print(f"Filtered range: {df['timestamp'].min()} -> {df['timestamp'].max()}")
        except Exception:
            pass
    # In verbose mode, also print the filtered readings (timestamp, temperature, humidity)
    if VERBOSE and not df.empty:
        print("Filtered readings:")
        cnt = len(df)
        # if small, print all; otherwise print first 10 and last 10
        def _print_row(ts, temp, hum):
            try:
                ts_str = ts.isoformat()
            except Exception:
                ts_str = str(ts)
            print(f"  {ts_str} | temp={temp} | hum={hum}")

        if cnt <= 50:
            for _, row in df.iterrows():
                _print_row(row['timestamp'], row['temperature'], row['humidity'])
        else:
            for _, row in df.head(10).iterrows():
                _print_row(row['timestamp'], row['temperature'], row['humidity'])
            print(f"  ... ({cnt - 20} more rows) ...")
            for _, row in df.tail(10).iterrows():
                _print_row(row['timestamp'], row['temperature'], row['humidity'])

    return df


def ensure_plots_dir():
    out = "plots"
    os.makedirs(out, exist_ok=True)
    return out


def save_fig(fig, base_path: str, save_png: bool = True):
    html_path = f"{base_path}.html"
    fig.write_html(html_path, include_plotlyjs="cdn")
    print(f"Saved interactive plot: {html_path}")
    if save_png:
        try:
            pio.write_image(fig, f"{base_path}.png", scale=2)
            print(f"Saved static image: {base_path}.png")
        except Exception:
            print("PNG export failed — install `kaleido` to enable PNG export: pip install kaleido")


def make_plots(df: pd.DataFrame, plots_dir: str, display_tz: str = 'UTC'):
    if df.empty:
        print("No data to plot.")
        return
    # Convert timestamps to pandas tz-aware Series and then to display timezone
    try:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        # ensure tz-aware (they should be UTC already), then convert
        if df['timestamp'].dt.tz is None:
            df['timestamp'] = df['timestamp'].dt.tz_localize('UTC')
        df['timestamp'] = df['timestamp'].dt.tz_convert(display_tz)
    except Exception:
        # if conversion fails, continue with original timestamps
        print(f"Warning: failed to convert timestamps to display timezone '{display_tz}'. Showing raw timestamps.")
    # Temperature
    fig_t = px.line(
        df,
        x="timestamp",
        y="temperature",
        title="Temp",
        labels={"temperature": "Temperature (°C)", "timestamp": "Time"},
        template="plotly_white",
    )
    fig_t.update_traces(mode="lines+markers")
    fig_t.update_layout(hovermode="x unified")
    save_fig(fig_t, os.path.join(plots_dir, "temperature"))

    # Humidity
    fig_h = px.line(
        df,
        x="timestamp",
        y="humidity",
        title="Humidity",
        labels={"humidity": "Humidity (%)", "timestamp": "Time"},
        template="plotly_white",
    )
    fig_h.update_traces(mode="lines+markers")
    fig_h.update_layout(hovermode="x unified")
    save_fig(fig_h, os.path.join(plots_dir, "humidity"))


def main():
    parser = argparse.ArgumentParser(description="Fetch sensor data and generate Plotly graphs.")
    parser.add_argument("--start", "-s", help="Start timestamp (epoch seconds, epoch ms, or ISO datetime)")
    parser.add_argument("--end", "-e", help="End timestamp (epoch seconds, epoch ms, or ISO datetime)")
    parser.add_argument("--debug", "-d", action="store_true", help="Print the latest reading (t0) and exit")
    parser.add_argument("--tz", help="Timezone for naive CLI timestamps (IANA name, e.g. America/Chicago or short name like CST). Defaults to America/Chicago.", default="America/Chicago")
    parser.add_argument("--display-tz", help="Timezone to display on the plot x-axis (IANA name, e.g. America/Chicago). Defaults to America/Chicago.", default="America/Chicago")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show debug/diagnostic output")
    parser.add_argument("--hours", type=float, help="Use a relative timeframe: last N hours (overrides --start/--end if provided)")
    args = parser.parse_args()

    # parse CLI timestamps into datetimes
    def _parse_input(ts_str: typing.Optional[str], tz_name: typing.Optional[str] = None) -> typing.Optional[datetime]:
        if not ts_str:
            return None
        # try integer epoch
        try:
            ival = int(ts_str)
            if ival > 1e11:
                return datetime.fromtimestamp(ival / 1000.0, tz=timezone.utc)
            return datetime.fromtimestamp(ival, tz=timezone.utc)
        except Exception:
            pass
        # try pandas parsing. If the parsed datetime is naive, localize to tz_name if provided,
        # otherwise treat as UTC.
        try:
            pdt = pd.to_datetime(ts_str)
            if pdt.tzinfo is None:
                if tz_name:
                    tzinfo = tz.gettz(tz_name)
                    if tzinfo is None:
                        print(f"Warning: unknown timezone '{tz_name}'. Treating naive time as UTC.")
                        pdt = pdt.tz_localize(timezone.utc)
                    else:
                        pdt = pdt.tz_localize(tzinfo)
                else:
                    pdt = pdt.tz_localize(timezone.utc)
            # convert to UTC for internal comparisons
            pdt = pdt.tz_convert('UTC')
            return pdt.to_pydatetime()
        except Exception:
            print(f"Unable to parse timestamp: {ts_str}")
            return None
    start_dt = _parse_input(args.start, tz_name=args.tz)
    end_dt = _parse_input(args.end, tz_name=args.tz)
    # set global verbose flag
    global VERBOSE
    VERBOSE = bool(args.verbose)

    # If --hours is provided, compute start/end as last N hours using the CLI timezone (args.tz)
    if args.hours is not None:
        # Determine tzinfo from args.tz (defaults already set to America/Chicago)
        tzname = args.tz if args.tz else None
        tzinfo = tz.gettz(tzname) if tzname else timezone.utc
        now_local = datetime.now(tzinfo)
        now_utc = now_local.astimezone(timezone.utc)
        # base window
        end_dt = now_utc
        start_dt = now_utc - timedelta(hours=float(args.hours))
        # apply buffer of 30 minutes on both ends to account for slow sensor polling
        buffer = timedelta(minutes=30)
        start_dt = start_dt - buffer
        end_dt = end_dt + buffer
        if VERBOSE:
            print(f"Computed start/end (UTC) from --hours {args.hours} and tz={tzname} with 30min buffer: {start_dt} -> {end_dt}")
    init_firebase()

    if args.debug:
        # Print the latest reading (t0) and exit
        def _get_latest():
            ref = db.reference(DB_REF_PATH)
            raw = ref.get()
            if not raw:
                print("No data returned from the database.")
                return None
            latest = None
            latest_dt = None
            for key, entry in raw.items():
                if not isinstance(entry, dict):
                    continue
                ts = entry.get("timestamp")
                if ts is None:
                    continue
                # parse ts like fetch_data
                try:
                    ts_val = int(ts)
                    if ts_val > 1e11:
                        ts_dt = datetime.fromtimestamp(ts_val / 1000.0)
                    else:
                        ts_dt = datetime.fromtimestamp(ts_val)
                except Exception:
                    try:
                        ts_dt = pd.to_datetime(ts).to_pydatetime()
                    except Exception:
                        continue

                if latest_dt is None or ts_dt > latest_dt:
                    latest_dt = ts_dt
                    latest = (key, entry, ts_dt)
            return latest

        latest = _get_latest()
        if latest is None:
            sys.exit(0)
        key, entry, ts_dt = latest
        print("Latest reading (t0):")
        print(f"  key: {key}")
        print(f"  timestamp (raw): {entry.get('timestamp')}")
        print(f"  timestamp (parsed): {ts_dt}")
        print(f"  temperature: {entry.get('temperature')}")
        print(f"  humidity: {entry.get('humidity')}")
        sys.exit(0)

    df = fetch_data(start_dt=start_dt, end_dt=end_dt, apply_filter=True)

    # If filtering produced no rows but the user supplied explicit start/end,
    # try interpreting the CLI timestamps as local time (instead of UTC) and
    # re-run the fetch. This commonly fixes mismatches when users supply
    # naive local datetimes.
    if df.empty and (args.start or args.end):
        print("No rows after initial filtering — retrying by interpreting CLI datetimes as local time...")

        def _parse_input_local(ts_str: typing.Optional[str]) -> typing.Optional[datetime]:
            if not ts_str:
                return None
            # try numeric epoch first
            try:
                ival = int(ts_str)
                if ival > 1e11:
                    return datetime.fromtimestamp(ival / 1000.0, tz=timezone.utc)
                return datetime.fromtimestamp(ival, tz=timezone.utc)
            except Exception:
                pass
            # parse with pandas without forcing UTC, then localize to specified tz or system tz
            try:
                pdt = pd.to_datetime(ts_str)
                if pdt.tzinfo is None:
                    if args.tz:
                        tzinfo = tz.gettz(args.tz)
                        if tzinfo is None:
                            print(f"Warning: unknown timezone '{args.tz}'. Using system local timezone for fallback.")
                            pdt = pdt.tz_localize(tz.tzlocal())
                        else:
                            pdt = pdt.tz_localize(tzinfo)
                    else:
                        pdt = pdt.tz_localize(tz.tzlocal())
                pdt = pdt.tz_convert('UTC')
                return pdt.to_pydatetime()
            except Exception:
                print(f"Unable to parse (local) timestamp: {ts_str}")
                return None

        # parse again assuming local timezone
        start_local = _parse_input_local(args.start) if args.start else None
        end_local = _parse_input_local(args.end) if args.end else None
        if start_local or end_local:
            df = fetch_data(start_dt=start_local, end_dt=end_local, apply_filter=True)
            if not df.empty:
                print("Success: rows found when interpreting CLI timestamps as local time.")

    # If still empty, exit with error (no fallback)
    if df.empty:
        print("No data matched the requested time range. Exiting.")
        sys.exit(1)
    plots_dir = ensure_plots_dir()
    # determine display timezone: prefer explicit --display-tz, then --tz, else UTC
    display_tz = args.display_tz or args.tz or 'UTC'
    make_plots(df, plots_dir, display_tz=display_tz)


if __name__ == "__main__":
    main()