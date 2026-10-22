import sys, os, time
from playwright.sync_api import sync_playwright

out = sys.argv[1] if len(sys.argv) > 1 else "frames"
only = [int(x) for x in sys.argv[2].split(",")] if len(sys.argv) > 2 else None
os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file://" + os.path.abspath("index.html"))
    pg.wait_for_function("window.NFRAMES !== undefined", timeout=60000)
    n = pg.evaluate("window.NFRAMES")
    frames = only if only else range(n)
    t0 = time.time()
    for i in frames:
        pg.evaluate(f"window.renderFrame({i})")
        pg.screenshot(path=f"{out}/{i:04d}.png")
    print("frames", len(list(frames)), "secs", round(time.time() - t0, 1), "errors", errs[:5])
    b.close()
