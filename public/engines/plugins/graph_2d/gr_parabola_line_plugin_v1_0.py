"""gr_parabola_line_plugin_v1_0
---------------------------------
Prototype plugin for a parabola and line intersection figure: draws one
quadratic graph, a line, intersection points and shaded regions for
basic coordinate-geometry questions.
"""

from __future__ import annotations

import os
from typing import Dict

import numpy as np
import matplotlib.pyplot as plt

from core.rc_core_v1_0 import apply_base_rc, LINE_PT_SPEC
from core.font_core_v1_0 import FontCore
from core.axis_core_v1_0 import AxisCore
from core.label_core_v1_0 import PointLabeler
from core.dim_core_v1_0 import DimensionLabeler
from core.view_core_v1_0 import bbox_from_points, lock_viewport


def _engine_root() -> str:
    return os.path.dirname(os.path.dirname(__file__))


def render(output_stem: str | None = None) -> Dict[str, str]:
    """
    Render a simple parabola y = x^2/8 and a secant line.
    """
    apply_base_rc()
    font_engine = FontCore()

    fig, ax = plt.subplots(figsize=(4.5, 4.0))

    # Axes via AxisCore.
    axis_core = AxisCore(ax, font_engine=font_engine)
    axis_core.draw_cartesian_axes(xlim=(-4.0, 4.0), ylim=(-1.0, 4.0))

    # Parabola and line
    xs = np.linspace(-3.0, 3.0, 200)
    ys = (xs**2) / 8.0
    ax.plot(xs, ys, color="black", lw=LINE_PT_SPEC["base"], zorder=2)

    line_xs = np.array([-3.0, 3.0])
    line_ys = 0.5 * line_xs + 1.0
    ax.plot(line_xs, line_ys, color="black", lw=LINE_PT_SPEC["base"], zorder=2)

    # Intersection points (approximate)
    A = (-2.0, (-2.0**2) / 8.0)
    B = (2.0, (2.0**2) / 8.0)

    labeler = PointLabeler(ax, font_engine=font_engine)
    labeler.add_point_label(A[0], A[1], "A", obstacles=[])
    labeler.add_point_label(B[0], B[1], "B", obstacles=[])

    # Dimension along the x-axis between projections of A and B.
    dim = DimensionLabeler(ax, font_engine=font_engine)
    dim.add_linear_dimension(
        (A[0], 0.0),
        (B[0], 0.0),
        text="a",
        mode="internal",
        edge_side=None,
        category="variable",
    )

    # Viewport should also include the full axis range (-4, 4) so that
    bbox = bbox_from_points([(-4.0, -0.5), (4.0, 3.5)])
    lock_viewport(ax, bbox, mode="problem")
    ax.axis("off")

    engine_root = _engine_root()
    output_dir = os.path.join(engine_root, "output")
    os.makedirs(output_dir, exist_ok=True)

    if output_stem is None:
        output_stem = "gr_parabola_line_engine"

    png_path = os.path.join(output_dir, f"{output_stem}.png")
    svg_path = os.path.join(output_dir, f"{output_stem}.svg")
    fig.savefig(png_path, dpi=600, bbox_inches="tight")
    fig.savefig(svg_path, bbox_inches="tight")
    plt.close(fig)

    return {"png": png_path, "svg": svg_path}


if __name__ == "__main__":
    render()
