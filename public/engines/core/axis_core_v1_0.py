"""axis_core_v1_0
-----------------
Drawing true coordinate axes with V-notch arrowheads, setting axis
styling (thickness, arrow glyphs), and exposing arrow tip positions so
that label_core can place axis / origin labels consistently.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Tuple, Optional
import math

import matplotlib.pyplot as plt
from matplotlib.path import Path
from matplotlib.patches import PathPatch

from .font_core_v1_0 import FontCore
from .rc_core_v1_0 import LINE_PT_SPEC
from .label_core_v1_0 import PointLabeler


PT_PER_IN = 72.0

VNOTCH_ARROW_SIZE_PT: float = 8.0
# How far the axis line overlaps into the arrow body, as a fraction of the
# local scale length S (0 < overlap_ratio < 0.5 recommended).
VNOTCH_OVERLAP_RATIO: float = 0.46


def _pt_to_data(ax: plt.Axes, pt: float, axis: str) -> float:
    """
    Convert a length in points to data coordinates along the given axis.

    axis == 'x'  → convert along the x‑direction
    axis == 'y'  → convert along the y‑direction
    """
    fig = ax.figure
    pix = pt * fig.dpi / PT_PER_IN
    trans = ax.transData
    inv = trans.inverted()

    x0, y0 = trans.transform((0.0, 0.0))

    if axis == "x":
        x1, _ = inv.transform((x0 + pix, y0))
        x0d, _ = inv.transform((x0, y0))
        return abs(x1 - x0d)
    else:
        _, y1 = inv.transform((x0, y0 + pix))
        _, y0d = inv.transform((x0, y0))
        return abs(y1 - y0d)


@dataclass
class AxisStyle:
    """
    Style configuration for Cartesian axes.

    - axis_width, tick_width are taken from rc_core_v1_0.LINE_PT_SPEC
    - arrow_text / arrow_fontsize are still exposed for DimensionLabeler
    """

    axis_width: float = LINE_PT_SPEC["base"]
    tick_width: float = LINE_PT_SPEC["guide"]

    # Kept for compatibility with DimensionLabeler (text-based arrows).
    arrow_text: str = "▶"
    arrow_fontsize: float = 6.0

    tip_margin_pt: float = 3.0   # margin between axis tip and figure edge
    label_offset_pt: float = 6.0  # offset of axis labels from axes
    tick_length_pt: float = 3.0   # tick length in pt

    arrow_size_pt: float = VNOTCH_ARROW_SIZE_PT
    overlap_ratio: float = VNOTCH_OVERLAP_RATIO


class AxisCore:
    """
    Helper for drawing Cartesian axes with consistent styling.

    Example
    -------
        axis = AxisCore(ax, font_engine)
        axis.draw_cartesian_axes(xlim=(0, 10), ylim=(0, 6))
    """

    def __init__(
        self,
        ax: plt.Axes,
        font_engine: Optional[FontCore] = None,
        style: Optional[AxisStyle] = None,
    ) -> None:
        self.ax = ax
        self.font_engine = font_engine or FontCore()
        self.style = style or AxisStyle()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def draw_cartesian_axes(
        self,
        xlim: Tuple[float, float],
        ylim: Tuple[float, float],
        origin: Tuple[float, float] = (0.0, 0.0),
        show_x: bool = True,
        show_y: bool = True,
        labels: Tuple[Optional[str], Optional[str]] = ("x", "y"),
        ticks_x: Optional[Iterable[float]] = None,
        ticks_y: Optional[Iterable[float]] = None,
    ) -> None:
        """
        Draw x, y axes with arrowheads and optional labels / ticks.
        """
        ox, oy = origin

        # conversions for arrow geometry so that physical sizes are
        # consistent with the final viewport.
        self.ax.set_xlim(xlim)
        self.ax.set_ylim(ylim)

        if show_x:
            self._draw_axis_x(xlim, oy, ticks=ticks_x)

        if show_y:
            self._draw_axis_y(ylim, ox, ticks=ticks_y)

        # Axis labels are delegated to LabelCore (PointLabeler) so that
        # placement rules are centralized. When labels are None they are
        # omitted.
        x_label, y_label = labels
        if x_label is not None or y_label is not None:
            plabeler = PointLabeler(self.ax, font_engine=self.font_engine)
            plabeler.set_axis_labels(
                x_text=x_label if x_label is not None else "",
                y_text=y_label if y_label is not None else "",
                position="tip",
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _draw_vnotch_arrow(
        self,
        tip: Tuple[float, float],
        direction: Tuple[float, float],
    ) -> Tuple[Tuple[float, float], float, Tuple[float, float]]:
        """
        Draw a V‑notch (seagull-shaped) arrowhead.

        Parameters
        ----------
        tip:
            Arrow tip in data coordinates.
        direction:
            Direction vector of the arrow (e.g., (1, 0) for +x, (0, 1) for +y).

        Returns
        -------
        (base_point, S, (ux, uy))
            base_point : approximate point where the arrow body begins
            S          : local scale length derived from arrow_size_pt
            (ux, uy)   : unit direction vector
        """
        ux, uy = direction
        n = math.hypot(ux, uy)
        if n == 0:
            return tip, 0.0, (0.0, 0.0)
        ux /= n
        uy /= n

        # Use the vertical scale ('y') for both arrows so that the
        # behaviour.
        S = _pt_to_data(self.ax, self.style.arrow_size_pt / 3.0, axis="y")
        L = 2.5 * S

        nx = tip[0] - L * ux
        ny = tip[1] - L * uy

        P = [
            (0.0, 0.5),
            (0.6, 0.2),
            (2.0, 0.05),
            (2.5, 0.0),
            (0.0, -0.5),
            (0.6, -0.2),
            (2.0, -0.05),
        ]
        U = [(x * S, y * S) for (x, y) in P[:4]]
        Lw = [(x * S, y * S) for (x, y) in P[4:] + [P[3]]]

        def _R(a: float, b: float) -> Tuple[float, float]:
            return (nx + a * ux - b * uy, ny + a * uy + b * ux)

        pts = [
            _R(*U[0]),
            _R(*U[1]),
            _R(*U[2]),
            _R(*U[3]),
            _R(*Lw[2]),
            _R(*Lw[1]),
            _R(*Lw[0]),
            (nx + 0.5 * S * ux, ny + 0.5 * S * uy),
        ]

        path = Path(
            pts + [pts[0]],
            [Path.MOVETO] + [Path.CURVE4] * 6 + [Path.LINETO] + [Path.CLOSEPOLY],
        )
        patch = PathPatch(path, facecolor="black", edgecolor="black", lw=0.0, zorder=3)
        self.ax.add_patch(patch)

        return (nx, ny), S, (ux, uy)

    def _draw_axis_x(
        self,
        xlim: Tuple[float, float],
        y: float,
        ticks: Optional[Iterable[float]],
    ) -> None:
        x0, x1 = xlim
        if x1 <= x0:
            return

        # Place arrow tip slightly inside the visible range.
        margin = _pt_to_data(self.ax, self.style.tip_margin_pt, axis="x")
        tip_x = x1 - margin
        tip = (tip_x, y)
        # Expose tip position for LabelCore so that axis labels
        # can be kept within the arrowhead.
        setattr(self.ax, "_axiscore_x_tip", tip_x)

        base_point, S, (ux, uy) = self._draw_vnotch_arrow(tip, (1.0, 0.0))
        eps = min(self.style.overlap_ratio, 0.4999) * S
        # Small extra overlap to remove any visible gap while staying
        # far from the tip of the arrow.
        extra = 0.02 * S

        line_end_x = base_point[0] + (eps + extra) * ux
        line_end_y = base_point[1] + (eps + extra) * uy

        self.ax.plot(
            [x0, line_end_x],
            [y, line_end_y],
            color="black",
            lw=self.style.axis_width,
            zorder=1,
        )

        # Ticks
        if ticks is not None:
            tick_len = _pt_to_data(self.ax, self.style.tick_length_pt, axis="y")
            for t in ticks:
                if x0 <= t <= x1:
                    self.ax.plot(
                        [t, t],
                        [y - tick_len / 2.0, y + tick_len / 2.0],
                        color="black",
                        lw=self.style.tick_width,
                        zorder=1,
                    )

    def _draw_axis_y(
        self,
        ylim: Tuple[float, float],
        x: float,
        ticks: Optional[Iterable[float]],
    ) -> None:
        y0, y1 = ylim
        if y1 <= y0:
            return

        margin = _pt_to_data(self.ax, self.style.tip_margin_pt, axis="y")
        tip_y = y1 - margin
        tip = (x, tip_y)
        # Expose tip position for LabelCore.
        setattr(self.ax, "_axiscore_y_tip", tip_y)

        base_point, S, (ux, uy) = self._draw_vnotch_arrow(tip, (0.0, 1.0))
        eps = min(self.style.overlap_ratio, 0.4999) * S
        extra = 0.02 * S

        line_top_x = base_point[0] + (eps + extra) * ux
        line_top_y = base_point[1] + (eps + extra) * uy

        self.ax.plot(
            [x, line_top_x],
            [y0, line_top_y],
            color="black",
            lw=self.style.axis_width,
            zorder=1,
        )

        # Ticks
        if ticks is not None:
            tick_len = _pt_to_data(self.ax, self.style.tick_length_pt, axis="x")
            for t in ticks:
                if y0 <= t <= y1:
                    self.ax.plot(
                        [x - tick_len / 2.0, x + tick_len / 2.0],
                        [t, t],
                        color="black",
                        lw=self.style.tick_width,
                        zorder=1,
                    )

        # Axis labels are handled by LabelCore.set_axis_labels.


__all__ = ["AxisStyle", "AxisCore"]
