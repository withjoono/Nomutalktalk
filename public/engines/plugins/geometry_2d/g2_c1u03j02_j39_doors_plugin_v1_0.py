"""g2_c1u03j02_j39_doors_plugin_v1_0
-------------------------------------
Plugin for a Grade 2 unit 3 door-arrangement combinatorics problem:
constructs the variant statement and renders the plan view with doors
and labels according to the core engine rules.
"""

from __future__ import annotations

import os
from typing import Dict

import numpy as np
import matplotlib.pyplot as plt

from core.rc_core_v1_0 import apply_base_rc, LINE_PT_SPEC
from core.font_core_v1_0 import FontCore
from core.label_core_v1_0 import PointLabeler
from core.dim_core_v1_0 import DimensionLabeler
from core.view_core_v1_0 import bbox_from_points, lock_viewport


def _engine_root() -> str:
    return os.path.dirname(os.path.dirname(__file__))


def render(output_stem: str | None = None) -> Dict[str, str]:
    """
    Render a circular hall with evenly spaced doors.

    Returns a dict with keys ``png`` and ``svg`` pointing to the files.
    """
    apply_base_rc()
    font_engine = FontCore()

    fig, ax = plt.subplots(figsize=(4, 4))
    ax.set_aspect("equal")

    # Base circle (exhibition hall boundary).
    R = 4.0
    theta = np.linspace(0.0, 2.0 * np.pi, 400)
    ax.plot(
        R * np.cos(theta),
        R * np.sin(theta),
        color="black",
        lw=LINE_PT_SPEC["base"],
        zorder=1,
    )

    # Dimension-style arc segments that play the role of door markers.
    dim = DimensionLabeler(ax, font_engine=font_engine)
    num_doors = 8
    door_span_deg = 18.0  # each door arc span
    centers = np.linspace(40.0, 320.0, num_doors)

    for idx, c in enumerate(centers, start=1):
        start = c - door_span_deg / 2.0
        end = c + door_span_deg / 2.0
        dim.add_circular_arc_dimension(
            center=(0.0, 0.0),
            radius=R + 0.15,
            angle_start=start,
            angle_end=end,
            text=str(idx),
            mode="dashed",
            arrows=False,
            aspect_ratio=1.0,
            category="number",
        )

    # Simple title label above the circle.
    labeler = PointLabeler(ax, font_engine=font_engine)
    labeler.add_point_label(0.0, R + 0.9, "출입구 배치", obstacles=[])

    bbox = bbox_from_points(
        [(R, 0.0), (-R, 0.0), (0.0, R + 1.2), (0.0, -(R + 0.3))]
    )
    lock_viewport(ax, bbox, mode="problem")
    ax.axis("off")

    engine_root = _engine_root()
    output_dir = os.path.join(engine_root, "output")
    os.makedirs(output_dir, exist_ok=True)

    if output_stem is None:
        output_stem = "g2_c1u03j02_j39_engine"

    png_path = os.path.join(output_dir, f"{output_stem}.png")
    svg_path = os.path.join(output_dir, f"{output_stem}.svg")
    fig.savefig(png_path, dpi=600, bbox_inches="tight")
    fig.savefig(svg_path, bbox_inches="tight")
    plt.close(fig)

    return {"png": png_path, "svg": svg_path}


if __name__ == "__main__":
    render()

