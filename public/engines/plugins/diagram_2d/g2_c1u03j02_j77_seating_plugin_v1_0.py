"""g2_c1u03j02_j77_seating_plugin_v1_0
---------------------------------------
Plugin for a Grade 2 seating/row combinatorics problem, generating a
variant statement and a diagram of seats and labels on a coordinate-like
layout.
"""

from __future__ import annotations

import os
from typing import Dict, List, Tuple

import matplotlib.pyplot as plt

from core.rc_core_v1_0 import apply_base_rc, LINE_PT_SPEC
from core.font_core_v1_0 import FontCore
from core.label_core_v1_0 import PointLabeler
from core.region_core_v1_0 import RegionLabeler
from core.view_core_v1_0 import bbox_from_points, lock_viewport


def _engine_root() -> str:
    return os.path.dirname(os.path.dirname(__file__))


def render(output_stem: str | None = None) -> Dict[str, str]:
    """
    Render a 3×3 seating arrangement with the middle row highlighted.
    """
    apply_base_rc()
    font_engine = FontCore()

    fig, ax = plt.subplots(figsize=(4.5, 4.0))
    ax.set_aspect("equal")

    cols, rows = 3, 3
    cell_w, cell_h = 1.8, 1.8

    region = RegionLabeler(ax, font_engine=font_engine)
    labeler = PointLabeler(ax, font_engine=font_engine)

    seats: List[Tuple[float, float, float, float]] = []
    for j in range(rows):
        for i in range(cols):
            x0 = i * cell_w
            y0 = j * cell_h
            seats.append((x0, y0, cell_w, cell_h))
            poly = [
                (x0, y0),
                (x0 + cell_w, y0),
                (x0 + cell_w, y0 + cell_h),
                (x0, y0 + cell_h),
            ]
            mode = "highlight" if j == 1 else "exam_shade"
            region.shade_polygon(poly, mode=mode)

            cx = x0 + cell_w / 2.0
            cy = y0 + cell_h / 2.0
            labeler.add_point_label(cx, cy, f"{j+1}{chr(ord('A') + i)}", obstacles=[])

    # Outer frame
    total_w = cols * cell_w
    total_h = rows * cell_h
    ax.plot(
        [0.0, total_w, total_w, 0.0, 0.0],
        [0.0, 0.0, total_h, total_h, 0.0],
        color="black",
        lw=LINE_PT_SPEC["base"],
        zorder=3,
    )

    bbox = bbox_from_points([(0.0, 0.0), (total_w, total_h)])
    lock_viewport(ax, bbox, mode="problem")
    ax.axis("off")

    engine_root = _engine_root()
    output_dir = os.path.join(engine_root, "output")
    os.makedirs(output_dir, exist_ok=True)

    if output_stem is None:
        output_stem = "g2_c1u03j02_j77_engine"

    png_path = os.path.join(output_dir, f"{output_stem}.png")
    svg_path = os.path.join(output_dir, f"{output_stem}.svg")
    fig.savefig(png_path, dpi=600, bbox_inches="tight")
    fig.savefig(svg_path, bbox_inches="tight")
    plt.close(fig)

    return {"png": png_path, "svg": svg_path}


if __name__ == "__main__":
    render()

