"""Quick feasibility test: pretrained YOLOv8 on one football frame.

Finds people, splits them into teams by kit color, and draws a ring under the
lowest (nearest) player. Usage:

    pip install ultralytics opencv-python
    python vision_test.py frame.png out.jpg
"""
import sys

import cv2
import numpy as np
from ultralytics import YOLO

src, dst = sys.argv[1], sys.argv[2]
img = cv2.imread(src)
result = YOLO("yolov8s.pt").predict(img, conf=0.15, imgsz=1920, verbose=False)[0]

people = []
for box, cls in zip(result.boxes.xyxy.tolist(), result.boxes.cls.tolist()):
    if result.names[int(cls)] != "person":
        continue
    x1, y1, x2, y2 = map(int, box)
    h, w = y2 - y1, x2 - x1
    torso = img[y1 + int(h * 0.18): y1 + int(h * 0.5), x1 + int(w * 0.2): x2 - int(w * 0.2)]
    if torso.size == 0:
        continue
    px = torso.reshape(-1, 3).astype(int)
    hsv = cv2.cvtColor(torso, cv2.COLOR_BGR2HSV).reshape(-1, 3)
    white = float(((px.min(1) > 150) & (hsv[:, 1] < 60)).mean())
    blue = float(((hsv[:, 0] > 95) & (hsv[:, 0] < 130) & (hsv[:, 1] > 70)).mean())
    green = float(((hsv[:, 0] > 40) & (hsv[:, 0] < 90) & (hsv[:, 1] > 120) & (hsv[:, 2] > 90)).mean())
    team = "gk" if green > 0.25 else ("white" if white > blue else "dark")
    people.append({"box": (x1, y1, x2, y2), "team": team})

colors = {"white": (245, 245, 245), "dark": (235, 130, 40), "gk": (60, 220, 60)}
selected = max(people, key=lambda p: p["box"][3])
out = img.copy()
for p in people:
    x1, y1, x2, y2 = p["box"]
    cx, w = (x1 + x2) // 2, x2 - x1
    if p is selected:
        cv2.ellipse(out, (cx, y2), (int(w * 1.65), int(w * 0.57)), 0, 0, 360, (255, 229, 57), 4, cv2.LINE_AA)
    else:
        cv2.ellipse(out, (cx, y2), (int(w * 0.9), int(w * 0.3)), 0, 0, 360, colors[p["team"]], 3, cv2.LINE_AA)
cv2.imwrite(dst, out)
counts = {t: sum(p["team"] == t for p in people) for t in colors}
print(f"people={len(people)} teams={counts}")
