# Moist Meat Monitor — Plotly Client

This repository contains `test_client.py`, a small script that fetches sensor
data from a Firebase Realtime Database and writes attractive interactive plots
using Plotly. The script saves HTML files (interactive) to the `plots/`
directory and attempts to save static PNGs (requires `kaleido`).

Quick start
1. Create a virtual environment and install requirements:
```bash
python3 -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\Activate.ps1 on Windows PowerShell
pip install -r requirements.txt
```

2. Make sure the service account JSON is present in the repo root and named:
```
moist-meat-monitor-firebase-adminsdk-fbsvc-a2be73f4d8.json
```

3. Run the script (in WSL or native Windows Python):
```bash
python3 test_client.py
```

Outputs
- `plots/temperature.html` — interactive temperature plot
- `plots/humidity.html` — interactive humidity plot
- `plots/temp_humidity.html` — combined interactive plot

WSL notes
- The script works in headless WSL by producing HTML files you can open in a
  browser on the Windows host. If you want native GUI windows from WSL instead,
  install an X server on Windows (e.g. VcXsrv), set the `DISPLAY` environment
  variable in WSL to your Windows host (see WSL docs), and install a GUI
  toolkit in WSL (e.g. `python3-tk` or `pyqt5`). Plotly HTML files do not need
  an X server — simply open them in your browser.

PNG export
- To export PNGs automatically, install `kaleido`:
```bash
pip install kaleido
```

Troubleshooting
- If Firebase auth fails, ensure the service account JSON is correct and the
  Realtime Database URL is accurate in `test_client.py`.
- If plots are empty, check that your RTDB path (`/sensors/device1`) contains
  entries with `timestamp`, `temperature`, and `humidity` fields.
