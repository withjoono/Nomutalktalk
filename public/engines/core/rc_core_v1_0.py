"""rc_core_v1_0
-----------------
Matplotlib rcParams and line-style presets shared across the engine,
plus LINE_PT_SPEC which defines stroke thicknesses for axes, guides,
curves, regions, and dimensions.
"""

from __future__ import annotations

from typing import Dict

import matplotlib as mpl
from matplotlib import cycler


BASE_RC: Dict[str, object] = {
    "figure.facecolor": "white",
    "savefig.facecolor": "white",
    "axes.facecolor": "white",
    "axes.edgecolor": "black",
    "axes.prop_cycle": cycler(color=["black"]),
    "text.color": "black",
    "axes.labelcolor": "black",
    "patch.edgecolor": "black",
    "patch.facecolor": "white",
    "lines.solid_joinstyle": "miter",
    "lines.solid_capstyle": "butt",
}

SHADING_SPEC: Dict[str, object] = {
    "facecolor_base": "white",
    "facecolor_shaded": "#D3D3D3",
    "edgecolor_default": "black",
}

LINE_PT_SPEC: Dict[str, float] = {
    "base": 0.5,
    "dotted": 0.35,
    "label": 8.0,
    "guide": 0.3,
    "angle": 0.3,
    "dim_solid": 0.3,
    "dim_dashed": 0.35,
    "leader": 0.3,
    "projection": 0.5,
}

DOTTED_LINE_STYLE = (0, (1.0, 1.0))   # on 1pt, off 1pt

BW_HARDEN_RC: Dict[str, object] = {
    "image.cmap": "gray",
    "image.interpolation": "none",
    "path.snap": True,
    "lines.solid_joinstyle": "miter",
    "lines.solid_capstyle": "butt",
}


def apply_base_rc() -> None:
    """폰트 이외의 공통 rc 기본값을 적용한다."""
    mpl.rcParams.update(BASE_RC)


def apply_bw_harden() -> None:
    """흑백 출력에 특화된 rc 설정을 추가로 적용한다."""
    mpl.rcParams.update(BW_HARDEN_RC)


__all__ = [
    "BASE_RC",
    "LINE_PT_SPEC",
    "DOTTED_LINE_STYLE",
    "SHADING_SPEC",
    "BW_HARDEN_RC",
    "apply_base_rc",
    "apply_bw_harden",
]
