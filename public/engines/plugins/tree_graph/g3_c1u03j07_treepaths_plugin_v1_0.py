"""g3_c1u03j07_treepaths_plugin_v1_0
--------------------------------------
Plugin for a Grade 3 tree/paths counting problem: builds the underlying
graph (nodes and edges), labels them, and renders the tree diagram for
path-count questions.
"""

from __future__ import annotations

import os
from typing import Dict, List, Tuple

import matplotlib.pyplot as plt

from core.rc_core_v1_0 import apply_base_rc, LINE_PT_SPEC
from core.font_core_v1_0 import FontCore
from core.label_core_v1_0 import PointLabeler
from core.angle_core_v1_0 import AngleLabeler
from core.view_core_v1_0 import bbox_from_points, lock_viewport


def _engine_root() -> str:
    return os.path.dirname(os.path.dirname(__file__))


def render(output_stem: str | None = None) -> Dict[str, str]:
    """
    Render a simple tree-like graph with angle labels at the root.
    """
    apply_base_rc()
    font_engine = FontCore()

    fig, ax = plt.subplots(figsize=(4.5, 4.0))
    ax.set_aspect("equal")

    # Root and three levels of branches.
    root = (0.0, 0.0)
    level1: List[Tuple[float, float]] = [(-2.0, 2.0), (0.0, 2.5), (2.0, 2.0)]
    level2: List[Tuple[float, float]] = [(-3.0, 4.0), (-1.0, 4.2), (1.0, 4.2), (3.0, 4.0)]

    edges: List[Tuple[Tuple[float, float], Tuple[float, float]]] = []
    for p in level1:
        edges.append((root, p))
    edges.extend(
        [
            (level1[0], level2[0]),
            (level1[0], level2[1]),
            (level1[2], level2[2]),
            (level1[2], level2[3]),
        ]
    )

    for p, q in edges:
        ax.plot(
            [p[0], q[0]],
            [p[1], q[1]],
            color="black",
            lw=LINE_PT_SPEC["base"],
            zorder=1,
        )

    labeler = PointLabeler(ax, font_engine=font_engine)
    labeler.add_point_label(*root, "O", obstacles=[])
    for idx, p in enumerate(level1, start=1):
        labeler.add_point_label(p[0], p[1], f"P_{idx}", obstacles=[])
    for idx, p in enumerate(level2, start=1):
        labeler.add_point_label(p[0], p[1], f"Q_{idx}", obstacles=[])

    # Angle between two branches at the root.
    angle_core = AngleLabeler(ax, font_engine=font_engine)
    angle_core.add_angle_marker(
        center=root,
        radius=1.0,
        angle_start=60.0,
        angle_end=120.0,
        text="θ",
        is_right_angle=False,
        arc_count=1,
        tick_count=0,
        arrow=False,
        linestyle="solid",
        color="black",
        text_offset_scale=1.4,
        text_rotation_mode="horizontal",
    )

    all_points = [root] + level1 + level2
    bbox = bbox_from_points(all_points)
    lock_viewport(ax, bbox, mode="problem")
    ax.axis("off")

    engine_root = _engine_root()
    output_dir = os.path.join(engine_root, "output")
    os.makedirs(output_dir, exist_ok=True)

    if output_stem is None:
        output_stem = "g3_c1u03j07_treepaths_engine"

    png_path = os.path.join(output_dir, f"{output_stem}.png")
    svg_path = os.path.join(output_dir, f"{output_stem}.svg")
    fig.savefig(png_path, dpi=600, bbox_inches="tight")
    fig.savefig(svg_path, bbox_inches="tight")
    plt.close(fig)

    return {"png": png_path, "svg": svg_path}


if __name__ == "__main__":
    render()

