"""geom_core_v1_0
------------------
GeometryRegistry and helpers for registering points, segments, rays,
polygons, circles, and curves so that the labeling engine can infer
"actual rays" at each point and know which objects a label refers to.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple

import numpy as np
import matplotlib.pyplot as plt


@dataclass
class _Curve:
    name: str
    xs: np.ndarray
    ys: np.ndarray


@dataclass
class _Segment:
    name: str
    p1: Tuple[float, float]
    p2: Tuple[float, float]


@dataclass
class _Point:
    name: str
    xy: Tuple[float, float]


class GeometryRegistry:
    """
    Geometry registry attached to a single Matplotlib Axes.

    PointLabeler uses this to infer "real rays" around a point when
    computing the maximum empty-angle bisector for label placement.
    """

    def __init__(self, ax: plt.Axes) -> None:
        self.ax = ax
        self._curves: List[_Curve] = []
        self._segments: List[_Segment] = []
        self._points: List[_Point] = []

    # ------------------------------------------------------------------
    # Registration API
    # ------------------------------------------------------------------
    def add_curve(self, name: str, xs, ys) -> str:
        xs_arr = np.asarray(xs, dtype=float)
        ys_arr = np.asarray(ys, dtype=float)
        self._curves.append(_Curve(name=name, xs=xs_arr, ys=ys_arr))
        return name

    def add_segment(self, name: str, p1: Tuple[float, float], p2: Tuple[float, float]) -> str:
        self._segments.append(
            _Segment(
                name=name,
                p1=(float(p1[0]), float(p1[1])),
                p2=(float(p2[0]), float(p2[1])),
            )
        )
        return name

    def add_point(self, name: str, xy: Tuple[float, float]) -> str:
        self._points.append(_Point(name=name, xy=(float(xy[0]), float(xy[1]))))
        return name

    # ------------------------------------------------------------------
    # Ray extraction
    # ------------------------------------------------------------------
    def get_rays_for_point(
        self,
        x: float,
        y: float,
        delta: float | None = None,
    ) -> List[Tuple[float, float]]:
        """
        From the registered geometry, extract neighbour points that
        represent **geometric rays** starting at (x, y).

        The return value is suitable for PointLabeler.add_point_label
        as the `neighbors` parameter:

            [(x1, y1), (x2, y2), ...]

        where each neighbour encodes one actual ray drawn in the figure.
        """
        if delta is None:
            xL, xR = self.ax.get_xlim()
            yB, yT = self.ax.get_ylim()
            # Use ~5% of the larger span as a base step in data units.
            delta = 0.05 * max(abs(xR - xL), abs(yT - yB))

        p = np.array([float(x), float(y)], dtype=float)
        rays: List[Tuple[float, float]] = []

        # Tolerances relative to the current viewport diagonal.
        xL, xR = self.ax.get_xlim()
        yB, yT = self.ax.get_ylim()
        diag = float(np.hypot(xR - xL, yT - yB))
        eps_curve = diag * 1e-4
        eps_segment = diag * 1e-4

        # Curves: find the closest sample index and use the tangent
        # direction there. Interior points (both sides of the curve
        # actually continues along the drawn curve.
        for c in self._curves:
            xs = c.xs
            ys = c.ys
            if xs.size < 2:
                continue
            d2 = (xs - x) ** 2 + (ys - y) ** 2
            idx = int(np.argmin(d2))
            d_min = float(np.sqrt(d2[idx]))
            if d_min > eps_curve:
                continue

            if idx == 0:
                idx0, idx1 = 0, 1
            elif idx == xs.size - 1:
                idx0, idx1 = xs.size - 2, xs.size - 1
            else:
                idx0, idx1 = idx - 1, idx + 1

            dx = float(xs[idx1] - xs[idx0])
            dy = float(ys[idx1] - ys[idx0])
            v = np.array([dx, dy], dtype=float)
            n = float(np.linalg.norm(v))
            if n == 0.0:
                continue
            u = v / n

            if idx == 0:
                # Start of the sampled curve: only the forward branch.
                rays.append((x + delta * u[0], y + delta * u[1]))
            elif idx == xs.size - 1:
                # End of the sampled curve: only the backward branch.
                rays.append((x - delta * u[0], y - delta * u[1]))
            else:
                # Interior sample: curve continues on both sides.
                rays.append((x + delta * u[0], y + delta * u[1]))
                rays.append((x - delta * u[0], y - delta * u[1]))

        # Segments: project point onto each segment and keep those for
        # which the closest point is within eps_segment.
        # - If the closest point lies strictly inside the segment, that
        #   segment contributes two rays (both directions).
        # - If the closest point is an end point, only the inward
        #   direction is considered a real ray.
        for s in self._segments:
            p1 = np.array(s.p1, dtype=float)
            p2 = np.array(s.p2, dtype=float)
            v = p2 - p1
            len2 = float(np.dot(v, v))
            if len2 == 0.0:
                continue
            t = float(np.dot(p - p1, v) / len2)
            t_clamped = max(0.0, min(1.0, t))
            closest = p1 + t_clamped * v
            d_min = float(np.linalg.norm(closest - p))
            if d_min > eps_segment:
                continue

            u = v / np.sqrt(len2)

            if abs(t_clamped) < 1.0e-6:
                # Near p1 end point: use p1 -> p2 direction only.
                rays.append((x + delta * u[0], y + delta * u[1]))
            elif abs(t_clamped - 1.0) < 1.0e-6:
                # Near p2 end point: use p2 -> p1 direction only.
                rays.append((x - delta * u[0], y - delta * u[1]))
            else:
                # Interior point: segment continues on both sides.
                rays.append((x + delta * u[0], y + delta * u[1]))
                rays.append((x - delta * u[0], y - delta * u[1]))

        # Deduplicate almost-parallel rays so that a single geometric
        # direction is not counted multiple times.
        if not rays:
            return rays

        dirs: List[float] = []
        unique_rays: List[Tuple[float, float]] = []
        for rx, ry in rays:
            vx, vy = rx - x, ry - y
            norm = float(np.hypot(vx, vy))
            if norm == 0.0:
                continue
            ux, uy = vx / norm, vy / norm
            ang = float(np.degrees(np.arctan2(uy, ux)) % 360.0)
            if any(abs(ang - a) < 1e-3 or abs(abs(ang - a) - 360.0) < 1e-3 for a in dirs):
                continue
            dirs.append(ang)
            unique_rays.append((rx, ry))

        return unique_rays


__all__ = ["GeometryRegistry"]

