"""g2_c1u03j06_regions_plugin_v1_0
------------------------------------
Plugin for a Grade 2 unit 3 regions problem: constructs line segments,
regions and labels, and uses region_core to shade the appropriate
subregions.
"""

from __future__ import annotations

import os
from typing import Dict, List, Tuple

import matplotlib.pyplot as plt

from core.rc_core_v1_0 import apply_base_rc, LINE_PT_SPEC
from core.font_core_v1_0 import FontCore
from core.region_core_v1_0 import RegionLabeler
from core.view_core_v1_0 import bbox_from_points, lock_viewport


def _engine_root() -> str:
    return os.path.dirname(os.path.dirname(__file__))


def render(output_stem: str | None = None) -> Dict[str, str]:
    """
    Render a polygon subdivided into a few regions with different modes.
    """
    apply_base_rc()
    font_engine = FontCore()

    fig, ax = plt.subplots(figsize=(4.5, 4.0))
    ax.set_aspect("equal")

    region = RegionLabeler(ax, font_engine=font_engine)

    outer: List[Tuple[float, float]] = [
        (0.0, 0.0),
        (5.0, 0.5),
        (5.5, 3.0),
        (3.5, 4.0),
        (1.0, 3.5),
        (-0.3, 1.5),
    ]

    # Simple subdivision into three regions.
    region_a = [outer[0], outer[1], (2.2, 1.6), (0.2, 1.7)]
    region_b = [(0.2, 1.7), (2.2, 1.6), (3.2, 2.6), (1.0, 3.4)]
    region_c = [(2.2, 1.6), outer[1], outer[2], outer[3], (3.2, 2.6)]

    region.shade_polygon(region_a, mode="exam_shade", label="1")
    region.shade_polygon(region_b, mode="preview_shade", label="2")
    region.shade_polygon(region_c, mode="highlight", label="3")

    # Outer boundary on top.
    xs, ys = zip(*(outer + [outer[0]]))
    ax.plot(xs, ys, color="black", lw=LINE_PT_SPEC["base"], zorder=4)

    bbox = bbox_from_points(outer)
    lock_viewport(ax, bbox, mode="problem")
    ax.axis("off")

    engine_root = _engine_root()
    output_dir = os.path.join(engine_root, "output")
    os.makedirs(output_dir, exist_ok=True)

    if output_stem is None:
        output_stem = "g2_c1u03j06_regions_engine"

    png_path = os.path.join(output_dir, f"{output_stem}.png")
    svg_path = os.path.join(output_dir, f"{output_stem}.svg")
    fig.savefig(png_path, dpi=600, bbox_inches="tight")
    fig.savefig(svg_path, bbox_inches="tight")
    plt.close(fig)

    return {"png": png_path, "svg": svg_path}


if __name__ == "__main__":
    render()

