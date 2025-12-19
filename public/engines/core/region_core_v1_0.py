"""region_core_v1_0
---------------------
Utilities for drawing shaded regions (filled polygons, vertical or
horizontal strips, curve-under-region fills) with consistent hatch and
alpha, used by many exam figures.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Tuple, Optional, Dict

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon as MplPolygon

from .font_core_v1_0 import FontCore
from .rc_core_v1_0 import SHADING_SPEC


@dataclass(frozen=True)
class RegionStyle:
    """
    영역 음영/테두리 스타일.

    - facecolor  : 영역 내부 채움 색상
    - edgecolor  : 테두리 색상 (None 이면 테두리 없음)
    - alpha      : 채움 투명도
    - hatch      : hatch 패턴 (None 이면 사용 안 함)
    - zorder_fill: 채움 zorder
    - zorder_edge: 테두리 zorder (None 이면 fill 과 동일)
    """

    facecolor: str
    edgecolor: Optional[str]
    alpha: float = 1.0
    hatch: Optional[str] = None
    zorder_fill: int = 1
    zorder_edge: Optional[int] = None


REGION_MODES: Dict[str, RegionStyle] = {
    "exam_shade": RegionStyle(
        facecolor=str(SHADING_SPEC.get("facecolor_shaded", "#D3D3D3")),
        edgecolor=None,
        alpha=1.0,
        hatch=None,
        zorder_fill=1,
        zorder_edge=None,
    ),
    "preview_shade": RegionStyle(
        facecolor=str(SHADING_SPEC.get("facecolor_shaded", "#D3D3D3")),
        edgecolor=str(SHADING_SPEC.get("edgecolor_default", "black")),
        alpha=0.8,
        hatch=None,
        zorder_fill=1,
        zorder_edge=2,
    ),
    "highlight": RegionStyle(
        facecolor=str(SHADING_SPEC.get("facecolor_base", "white")),
        edgecolor=str(SHADING_SPEC.get("edgecolor_default", "black")),
        alpha=1.0,
        hatch="//",
        zorder_fill=1,
        zorder_edge=3,
    ),
}


class RegionLabeler:
    """
    Flood-fill 방식의 영역 음영 및 라벨링 엔진.

    - 영역 경계는 다각형(points) 또는 마스크(mask)로 전달받는다.
    - 스타일은 REGION_MODES 에서 선택하거나 직접 RegionStyle 을 넘겨서 지정한다.
    """

    def __init__(self, ax: plt.Axes, font_engine: Optional[FontCore] = None):
        self.ax = ax
        self.font_engine = font_engine or FontCore()

    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    def shade_polygon(
        self,
        points: Iterable[Tuple[float, float]],
        mode: str = "exam_shade",
        style: Optional[RegionStyle] = None,
        label: Optional[str] = None,
        label_category: str = "variable",
    ) -> None:
        """
        다각형(points)을 flood-fill 하듯 한 번에 채우고,
        필요하면 중심에 라벨을 추가한다.

        Args:
            points: [(x0, y0), (x1, y1), ...] 형태의 꼭짓점 리스트
            mode: REGION_MODES 의 키. style 이 지정되면 무시된다.
            style: 직접 RegionStyle 을 지정하고 싶을 때 사용
            label: None 이 아니면 영역 중심에 텍스트를 배치
            label_category: FontCore.style_text 에 전달할 category
        """
        pts = np.asarray(list(points), dtype=float)
        if pts.size == 0:
            return

        used_style = style or REGION_MODES.get(mode, REGION_MODES["exam_shade"])

        patch = MplPolygon(
            pts,
            closed=True,
            facecolor=used_style.facecolor,
            edgecolor=used_style.edgecolor if used_style.edgecolor else "none",
            alpha=used_style.alpha,
            hatch=used_style.hatch,
            linewidth=0.0 if not used_style.edgecolor else 0.5,
            zorder=used_style.zorder_fill,
        )
        self.ax.add_patch(patch)

        if used_style.edgecolor and used_style.zorder_edge is not None:
            edge_patch = MplPolygon(
                pts,
                closed=True,
                fill=False,
                edgecolor=used_style.edgecolor,
                linewidth=0.5,
                zorder=used_style.zorder_edge,
            )
            self.ax.add_patch(edge_patch)

        if label:
            cx = float(pts[:, 0].mean())
            cy = float(pts[:, 1].mean())
            styled, prop = self.font_engine.style_text(label, category=label_category)
            self.ax.text(
                cx,
                cy,
                styled,
                fontdict=prop,
                ha="center",
                va="center",
                zorder=(used_style.zorder_edge or used_style.zorder_fill) + 1,
            )


__all__ = ["RegionStyle", "REGION_MODES", "RegionLabeler"]
