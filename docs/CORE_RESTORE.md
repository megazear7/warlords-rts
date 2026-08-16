# Core file restore

`src/core/Simulation.ts` is large (~42 KB). The repository keeps:

1. The full `src/core/Simulation.ts` on `main` (preferred).
2. A gzip+base64 payload split into `Simulation.ts.gz.b64.part1` … `partN` as a recovery path.
3. `scripts/restore-simulation.cjs` which reconstructs the file if it is missing or smaller than 10 KB.

`npm run predev` / `prebuild` automatically runs the restore script.

To regenerate the payload after editing Simulation.ts:

```bash
# from repo root (Python 3)
python3 -c '
import gzip, base64, io, os
with open("src/core/Simulation.ts", "rb") as f: data = f.read()
buf = io.BytesIO()
with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9) as gz: gz.write(data)
b64 = base64.b64encode(buf.getvalue()).decode("ascii")
part_size = 1500
parts = [b64[i:i+part_size] for i in range(0, len(b64), part_size)]
for i in range(1, 20):
    p = f"src/core/Simulation.ts.gz.b64.part{i}"
    if os.path.exists(p): os.remove(p)
for i, p in enumerate(parts, 1):
    open(f"src/core/Simulation.ts.gz.b64.part{i}", "w").write(p)
open("src/core/Simulation.ts.gz.b64", "w").write(b64)
print(len(parts), "parts written")
'
node scripts/restore-simulation.cjs   # optional verification (with file temporarily removed)
```

Authoritative copies also live in the Grok project artifacts folder.
