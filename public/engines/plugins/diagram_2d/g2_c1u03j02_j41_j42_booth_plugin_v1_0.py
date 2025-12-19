"""g2_c1u03j02_j41_j42_booth_plugin_v1_0
-----------------------------------------
Plugin for a Grade 2 booth/seating arrangement problem: builds a variant
scenario with labelled booths and aisles and draws the corresponding
figure.
"""

from __future__ import annotations

import os
from typing import Dict, List, Tuple

import numpy as np
import matplotlib.pyplot as plt

from core.rc_core_v1_0 import apply_base_rc, LINE_PT_SPEC
from core.font_core_v1_0 import FontCore
from core.label_core_v1_0 import PointLabeler
from core.dim_core_v1_0 import DimensionLabeler
from core.region_core_v1_0 import RegionLabeler
from core.view_core_v1_0 import bbox_from_points, lock_viewport


def _engine_root() -> str:
    return os.path.dirname(os.path.dirname(__file__))


def _rect(x0: float, y0: float, w: float, h: float) -> List[Tuple[float, float]]:
    return [
        (x0, y0),
        (x0 + w, y0),
        (x0 + w, y0 + h),
        (x0, y0 + h),
    ]


def render(output_stem: str | None = None) -> Dict[str, str]:
    """
    Render a 2×3 booth grid with one highlighted booth and dimensions.
    """
    apply_base_rc()
    font_engine = FontCore()

    fig, ax = plt.subplots(figsize=(4.5, 3.5))
    ax.set_aspect("equal")

    cols, rows = 3, 2
    cell_w, cell_h = 3.0, 2.0

    region = RegionLabeler(ax, font_engine=font_engine)
    booths: List[List[Tuple[float, float]]] = []

    for j in range(rows):
        for i in range(cols):
            poly = _rect(i * cell_w, j * cell_h, cell_w, cell_h)
            booths.append(poly)
            mode = "highlight" if (i, j) == (1, 0) else "exam_shade"
            region.shade_polygon(poly, mode=mode)

    # Outer boundary
    W = cols * cell_w
    H = rows * cell_h
    outer = _rect(0.0, 0.0, W, H)
    xs, ys = zip(*(outer + [outer[0]]))
    ax.plot(xs, ys, color="black", lw=LINE_PT_SPEC["base"], zorder=3)

    # Dimensions along bottom and left
    dim = DimensionLabeler(ax, font_engine=font_engine, polygon=outer)
    dim.add_linear_dimension(
        (0.0, 0.0),
        (W, 0.0),
        text=str(W),
        mode="edge",
        edge_side="outer",
        category="number",
    )
    dim.add_linear_dimension(
        (0.0, 0.0),
        (0.0, H),
        text=str(H),
        mode="edge",
        edge_side="outer",
        category="number",
    )

    # Booth labels
    labeler = PointLabeler(ax, font_engine=font_engine)
    labels = ["A", "B", "C", "D", "E", "F"]
    for poly, lab in zip(booths, labels):
        cx = sum(x for x, _ in poly) / 4.0
        cy = sum(y for _, y in poly) / 4.0
        labeler.add_point_label(cx, cy, lab, obstacles=[])

    bbox = bbox_from_points([(0.0, 0.0), (W, H)])
    lock_viewport(ax, bbox, mode="problem")
    ax.axis("off")

    engine_root = _engine_root()
    output_dir = os.path.join(engine_root, "output")
    os.makedirs(output_dir, exist_ok=True)

    if output_stem is None:
        output_stem = "g2_c1u03j02_j41_j42_engine"

    png_path = os.path.join(output_dir, f"{output_stem}.png")
    svg_path = os.path.join(output_dir, f"{output_stem}.svg")
    fig.savefig(png_path, dpi=600, bbox_inches="tight")
    fig.savefig(svg_path, bbox_inches="tight")
    plt.close(fig)

    return {"png": png_path, "svg": svg_path}


if __name__ == "__main__":
    render()

