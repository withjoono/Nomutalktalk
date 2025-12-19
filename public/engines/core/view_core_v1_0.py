"""view_core_v1_0
-------------------
Viewport and coordinate helpers: convert between pt and data units,
configure aspect ratio and margins, and provide small utilities used by
axis_core, dim_core, and label_core when reasoning in screen space.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Tuple, Optional, Sequence

import numpy as np
import matplotlib.pyplot as plt

PT_PER_IN = 72.0


def _pt_to_data(ax: plt.Axes, pt: float, axis: str) -> float:
    """
    주어진 pt 길이를 data 좌표계의 x 또는 y 방향 길이로 변환한다.

    axis == 'x' 이면 수평, 'y' 이면 수직 방향 기준.
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


@dataclass(frozen=True)
class ViewModeSpec:
    """
    viewport 모드별 설정 값.

    - margin_pt : bbox 바깥쪽에 둘 기본 여백(pt)
    - extra_top_pt : 위쪽 방향으로만 추가로 더 줄 여백(pt, 문제 지문 등을 위해 사용)
    - lock_aspect : True 이면 aspect="equal" 로 고정
    """

    margin_pt: float = 10.0
    extra_top_pt: float = 0.0
    lock_aspect: bool = True


DEFAULT_VIEW_MODES = {
    "problem": ViewModeSpec(margin_pt=12.0, extra_top_pt=6.0, lock_aspect=True),
    "solution": ViewModeSpec(margin_pt=14.0, extra_top_pt=10.0, lock_aspect=True),
    "tight": ViewModeSpec(margin_pt=6.0, extra_top_pt=0.0, lock_aspect=True),
}


def combine_bboxes(bboxes: Sequence[Tuple[float, float, float, float]]) -> Tuple[float, float, float, float]:
    """
    여러 개의 (xmin, xmax, ymin, ymax) bbox 를 받아
    전체를 포함하는 최소 bbox 를 반환한다.
    """
    if not bboxes:
        raise ValueError("bboxes 가 비어 있습니다.")
    xs_min = [b[0] for b in bboxes]
    xs_max = [b[1] for b in bboxes]
    ys_min = [b[2] for b in bboxes]
    ys_max = [b[3] for b in bboxes]
    return min(xs_min), max(xs_max), min(ys_min), max(ys_max)


def bbox_from_points(points: Iterable[Tuple[float, float]]) -> Tuple[float, float, float, float]:
    """
    점들의 집합으로부터 (xmin, xmax, ymin, ymax) 형태의 bbox 를 계산한다.
    """
    xs: list[float] = []
    ys: list[float] = []
    for x, y in points:
        xs.append(float(x))
        ys.append(float(y))
    if not xs or not ys:
        raise ValueError("points 가 비어 있습니다.")
    return min(xs), max(xs), min(ys), max(ys)


def lock_viewport(
    ax: plt.Axes,
    bbox: Tuple[float, float, float, float],
    mode: str = "problem",
    custom_mode: Optional[ViewModeSpec] = None,
    extra_points: Optional[Iterable[Tuple[float, float]]] = None,
) -> ViewModeSpec:
    """
    주어진 bbox 를 기준으로 viewport 를 잠그고, 모드에 맞는 여백을 적용한다.

    Args:
        ax: Matplotlib Axes 객체
        bbox: (xmin, xmax, ymin, ymax) in data coordinates
        mode: "problem" | "solution" | "tight" 등 DEFAULT_VIEW_MODES key
        custom_mode: 직접 ViewModeSpec 을 지정하고 싶을 때 사용

    Returns:
        적용된 ViewModeSpec (실제 사용된 모드 설정)
    """
    spec = custom_mode or DEFAULT_VIEW_MODES.get(mode, DEFAULT_VIEW_MODES["problem"])

    xmin, xmax, ymin, ymax = bbox

    if extra_points:
        for x, y in extra_points:
            x = float(x)
            y = float(y)
            xmin = min(xmin, x)
            xmax = max(xmax, x)
            ymin = min(ymin, y)
            ymax = max(ymax, y)
    if xmax <= xmin or ymax <= ymin:
        raise ValueError("bbox 가 유효하지 않습니다.")

    dx_margin = _pt_to_data(ax, spec.margin_pt, axis="x")
    dy_margin = _pt_to_data(ax, spec.margin_pt, axis="y")
    dy_top_extra = _pt_to_data(ax, spec.extra_top_pt, axis="y") if spec.extra_top_pt > 0 else 0.0

    xmin_v = xmin - dx_margin
    xmax_v = xmax + dx_margin
    ymin_v = ymin - dy_margin
    ymax_v = ymax + dy_margin + dy_top_extra

    ax.set_xlim(xmin_v, xmax_v)
    ax.set_ylim(ymin_v, ymax_v)

    if spec.lock_aspect:
        ax.set_aspect("equal")

    return spec


__all__ = [
    "ViewModeSpec",
    "DEFAULT_VIEW_MODES",
    "bbox_from_points",
    "combine_bboxes",
    "lock_viewport",
]
