"""dim_core_v1_0
-----------------
Dimension engine for straight and curved dimension lines, including
arrowheads, ticks, witness lines, and automatic height adjustment so
that dimension labels keep a safe, visually uniform distance from the
base segment.
"""
import numpy as np
import matplotlib.patches as patches
import matplotlib.path as mpath

from .font_core_v1_0 import FontCore
from .rc_core_v1_0 import LINE_PT_SPEC
from .axis_core_v1_0 import AxisStyle as _AxisStyleForDim
from .view_core_v1_0 import _pt_to_data as _pt_to_data_view


class DimensionLabeler:
    """
    Core dimension engine.

    기능 범위 (엔진 규칙 요약)
    ------------------------
    - 직선 치수선:
      * 항상 **실선**으로 그리고, 양쪽 끝에 화살촉을 붙인다.
      * 치수선과 같은 방향의 기준 변(p1–p2)에 수직인 짧은 틱(tick)을
        양 끝에 그려 시작/끝을 표시한다.
      * 치수선은 기준 변으로부터 최소 `MIN_CENTER_DIST_PT` pt 만큼 떨어지며,
        라벨의 흰색 마스크가 도형 테두리를 가리지 않도록 보정한다.

    - 곡선(Bezier) 치수선:
      * 항상 **점선**으로 그리고, 기본적으로 화살촉은 사용하지 않는다.

    - 원호/타원형 치수선:
      * `mode="solid"` / `"dashed"` 로 실선/점선을 선택한다.
    """

    def __init__(
        self,
        ax,
        font_engine=None,
        polygon=None,
        orientation: str = "auto",
        edge_side_default: str = "outer",
        boundary_circle=None,
    ):
        self.ax = ax
        self.font_engine = font_engine if font_engine else FontCore()
        self.edge_side_default = edge_side_default

        # Line styles (thickness from rc_core.LINE_PT_SPEC)
        self.DASH_STYLE = (0, (1.2, 1.2))
        self.SOLID_STYLE = "-"
        self.LINE_WIDTH_SOLID = LINE_PT_SPEC["dim_solid"]
        self.LINE_WIDTH_DASHED = LINE_PT_SPEC["dim_dashed"]

        # Arrow style (re-use axis core settings)
        _axis_style = _AxisStyleForDim()
        self.ARROW_TEXT = _axis_style.arrow_text
        self.ARROW_FONTSIZE = _axis_style.arrow_fontsize * 0.5

        # Minimum distance between dimension label centre and base segment (pt).
        self.MIN_INK_GAP_PT = 8.0
        base_font_size = getattr(self.font_engine, "font_size", 8.0)
        self.MIN_CENTER_DIST_PT = 0.5 * base_font_size + self.MIN_INK_GAP_PT

        # Tick length for linear dimensions (pt, total length).
        self.TICK_LEN_PT = 6.0

        # Optional polygon info for edge dimensions.
        self.polygon = list(polygon) if polygon is not None else None
        self.orientation = 0  # +1: CCW, -1: CW, 0: unknown
        if self.polygon and len(self.polygon) >= 3:
            if orientation.lower() == "ccw":
                self.orientation = 1
            elif orientation.lower() == "cw":
                self.orientation = -1
            else:
                self.orientation = self._compute_orientation(self.polygon)

        # Optional boundary circle constraint (cx, cy, R)
        self.boundary_circle = boundary_circle

        # Dimension-level collision management (bbox-based).
        self._dim_bboxes: list[tuple[float, float, float, float]] = []
        self.DIM_COLLISION_MAX_ITERS: int = 4
        self.DIM_COLLISION_MARGIN: float = 0.0

    # ------------------------------------------------------------------
    # Basic helpers
    # ------------------------------------------------------------------
    def _measure_text_box_pt(self, text: str, category: str) -> tuple[float, float]:
        """
        주어진 텍스트의 대략적인 너비/높이를 pt 단위로 측정한다.

        - FontCore + mathtext 렌더러를 직접 이용하므로, label_core 의
          휴리스틱과 달리 실제 폰트 메트릭에 기반한다.
        - 위치에는 의존하지 않으므로 (0,0)에 보이지 않는 텍스트를
          한 번 그리고, window_extent 로 크기만 얻는다.
        """
        if not text:
            return 1.0, 1.0

        styled, prop = self.font_engine.style_text(text, category=category)
        fig = self.ax.figure

        tmp = self.ax.text(
            0.0,
            0.0,
            styled,
            fontdict=prop,
            ha="center",
            va="center",
            visible=False,
        )
        fig.canvas.draw()
        renderer = fig.canvas.get_renderer()
        bbox = tmp.get_window_extent(renderer=renderer)
        tmp.remove()

        w_pt = bbox.width * 72.0 / fig.dpi
        h_pt = bbox.height * 72.0 / fig.dpi
        return max(w_pt, 1.0), max(h_pt, 1.0)

    def _compute_label_bbox_px(
        self, center_xy: tuple[float, float], w_pt: float, h_pt: float
    ) -> tuple[float, float, float, float]:
        """
        데이터 좌표상의 중심점(center_xy)와 pt 단위의 폭/높이가 주어졌을 때,
        화면(pixel) 좌표계에서의 axis-aligned bounding box (l, b, r, t)를 구한다.
        """
        fig = self.ax.figure
        dpi = fig.dpi
        w_px = w_pt * dpi / 72.0
        h_px = h_pt * dpi / 72.0

        cx_px, cy_px = self.ax.transData.transform(center_xy)
        half_w = 0.5 * w_px
        half_h = 0.5 * h_px
        l = cx_px - half_w
        r = cx_px + half_w
        b = cy_px - half_h
        t = cy_px + half_h
        return l, b, r, t

    def _check_dim_bbox_collision(
        self, bbox_px: tuple[float, float, float, float]
    ) -> bool:
        """
        주어진 라벨 bbox (pixel 좌표)가 기존에 등록된 치수선 라벨들과
        겹치는지 여부를 반환한다.
        """
        l, b, r, t = bbox_px
        if not self._dim_bboxes:
            return False

        margin = self.DIM_COLLISION_MARGIN
        l -= margin
        b -= margin
        r += margin
        t += margin

        for el, eb, er, et in self._dim_bboxes:
            if not (r < el or er < l or t < eb or et < b):
                return True
        return False

    def _register_dim_bbox(
        self,
        center_xy: tuple[float, float],
        w_pt: float,
        h_pt: float,
    ) -> None:
        """
        최종 확정된 치수선 라벨의 중심 위치와 pt 단위 폭/높이를 전달받아
        내부 bbox 리스트에 등록한다.
        """
        bbox_px = self._compute_label_bbox_px(center_xy, w_pt, h_pt)
        self._dim_bboxes.append(bbox_px)

    @staticmethod
    def _compute_orientation(poly) -> int:
        """Return +1 for CCW, -1 for CW polygon orientation."""
        area = 0.0
        n = len(poly)
        for i in range(n):
            x1, y1 = poly[i]
            x2, y2 = poly[(i + 1) % n]
            area += x1 * y2 - x2 * y1
        return 1 if area > 0 else -1

    def _edge_normal(self, p1, p2):
        """
        For an edge (p1, p2) of `self.polygon`, return the outward normal
        vector (unit length). If polygon info is unavailable, return None.
        """
        if not self.polygon or self.orientation == 0:
            return None

        poly = self.polygon
        n = len(poly)
        for i in range(n):
            q1 = poly[i]
            q2 = poly[(i + 1) % n]
            if (q1 == p1 and q2 == p2) or (q1 == p2 and q2 == p1):
                x1, y1 = q1
                x2, y2 = q2
                dx, dy = x2 - x1, y2 - y1
                L = np.hypot(dx, dy)
                if L == 0:
                    return None
                nx, ny = -dy / L, dx / L
                # Ensure "outer" side according to polygon orientation.
                if self.orientation < 0:
                    nx, ny = -nx, -ny
                # If edge specified as (p2,p1) instead of (p1,p2), flip.
                if q1 == p2 and q2 == p1:
                    nx, ny = -nx, -ny
                return nx, ny
        return None

    def _dist_pt_point_to_segment(self, P, A, B) -> float:
        """
        Distance between point P and segment AB in pt units (screen space).
        """
        fig = self.ax.figure
        Pxy = self.ax.transData.transform(P)
        Axy = self.ax.transData.transform(A)
        Bxy = self.ax.transData.transform(B)

        px, py = Pxy
        ax_, ay_ = Axy
        bx, by = Bxy

        vx, vy = bx - ax_, by - ay_
        wx, wy = px - ax_, py - ay_
        vv = vx * vx + vy * vy
        if vv == 0.0:
            dx, dy = px - ax_, py - ay_
            d_pix = (dx * dx + dy * dy) ** 0.5
        else:
            t = max(0.0, min(1.0, (wx * vx + wy * wy) / vv))
            cx, cy = ax_ + t * vx, ay_ + t * vy
            dx, dy = px - cx, py - cy
            d_pix = (dx * dx + dy * dy) ** 0.5

        return d_pix * 72.0 / fig.dpi

    # ------------------------------------------------------------------
    # 1. Linear dimensions
    # ------------------------------------------------------------------
    def add_linear_dimension(
        self,
        p1,
        p2,
        text,
        offset: float = 0.3,
        no_witness: bool = False,
        arrows: bool = True,
        category: str = "number",
        mode: str = "internal",  # "edge" | "internal"
        edge_side: str | None = None,  # "outer" | "inner" | None
    ):
        """
        Draw a straight (linear) dimension between p1 and p2.

        Rules:
        - Always drawn as a solid line with arrowheads at both ends.
        - Perpendicular tick marks are drawn at each end.
        - Dimension line is pushed away from the base segment so that the
          label centre keeps at least `MIN_CENTER_DIST_PT` pt of clearance.
        """
        x1, y1 = p1
        x2, y2 = p2

        w_pt, h_pt = self._measure_text_box_pt(str(text), category)
        dx, dy = x2 - x1, y2 - y1
        L = np.hypot(dx, dy)
        if L == 0:
            return

        if edge_side is None:
            edge_side = self.edge_side_default

        if mode == "edge":
            n = self._edge_normal(p1, p2)
            if n is None:
                nx, ny = -dy / L, dx / L
            else:
                nx, ny = n
        else:
            nx, ny = -dy / L, dx / L

        if mode == "edge" and edge_side == "inner":
            nx, ny = -nx, -ny

        # Base offset in data units.
        extra_push = 0.0
        if text and len(str(text)) > 3:
            extra_push = min(len(str(text)) * 0.03, 1.0)
        final_offset = offset + (extra_push if offset > 0 else -extra_push)

        # Ensure minimum gap in screen space, but cap growth per step
        for _ in range(self.DIM_COLLISION_MAX_ITERS):
            txs, tys = x1 + nx * final_offset, y1 + ny * final_offset
            txe, tye = x2 + nx * final_offset, y2 + ny * final_offset
            cx_mid, cy_mid = (txs + txe) / 2.0, (tys + tye) / 2.0
            dist_pt = self._dist_pt_point_to_segment((cx_mid, cy_mid), p1, p2)
            if dist_pt >= self.MIN_CENTER_DIST_PT:
                break
            raw_factor = self.MIN_CENTER_DIST_PT / max(dist_pt, 1e-3)
            factor = min(1.5, raw_factor)
            final_offset *= factor

        txs, tys = x1 + nx * final_offset, y1 + ny * final_offset
        txe, tye = x2 + nx * final_offset, y2 + ny * final_offset

        # Main linear dimension line: solid.
        self.ax.plot(
            [txs, txe],
            [tys, tye],
            color="black",
            lw=self.LINE_WIDTH_SOLID,
            ls=self.SOLID_STYLE,
            zorder=1,
        )

        # Perpendicular tick marks at both ends.
        try:
            tick_len = _pt_to_data_view(self.ax, self.TICK_LEN_PT, "y")
        except Exception:
            tick_len = 0.0
        if tick_len > 0.0:
            nx_tick, ny_tick = -dy / L, dx / L
            nlen = float(np.hypot(nx_tick, ny_tick))
            if nlen != 0.0:
                nx_tick /= nlen
                ny_tick /= nlen
                half = 0.5 * tick_len
                for cx, cy in ((txs, tys), (txe, tye)):
                    self.ax.plot(
                        [cx - nx_tick * half, cx + nx_tick * half],
                        [cy - ny_tick * half, cy + ny_tick * half],
                        color="black",
                        lw=self.LINE_WIDTH_SOLID,
                        zorder=1,
                    )

        # Witness lines from base segment up to the dimension line.
        if not no_witness:
            gap = 0.05
            self.ax.plot(
                [x1 + nx * gap, txs],
                [y1 + ny * gap, tys],
                "k-",
                lw=LINE_PT_SPEC["guide"],
            )
            self.ax.plot(
                [x2 + nx * gap, txe],
                [y2 + ny * gap, tye],
                "k-",
                lw=LINE_PT_SPEC["guide"],
            )

        # Label at the centre of the dimension line.
        cx_lbl, cy_lbl = (txs + txe) / 2.0, (tys + tye) / 2.0
        self._place_text(cx_lbl, cy_lbl, dx, dy, text, category)
        self._register_dim_bbox((cx_lbl, cy_lbl), w_pt, h_pt)

        # Arrowheads at both ends.
        if arrows:
            ang = np.arctan2(dy, dx)
            self._add_arrow_tip(txs, tys, ang, True)
            self._add_arrow_tip(txe, tye, ang, False)

    # ------------------------------------------------------------------
    # 2. Bezier curved dimensions
    # ------------------------------------------------------------------
    def add_smart_curve_dimension(
        self,
        p1,
        p2,
        text,
        convexity: float = 1.0,
        arrows: bool = False,
        avoid_points=None,
        category: str = "number",
        mode: str = "internal",  # "edge" | "internal"
        edge_side: str | None = None,  # "outer" | "inner" | None
    ):
        """
        Bezier-based curved dimension between p1 and p2.

        Always drawn as a dashed curve; mainly used when the original
        exam figure used a curved dimension line.
        """
        x1, y1 = p1
        x2, y2 = p2
        mx, my = (x1 + x2) / 2.0, (y1 + y2) / 2.0
        dx, dy = x2 - x1, y2 - y1
        dist = np.hypot(dx, dy)
        if dist == 0:
            return

        w_pt, h_pt = self._measure_text_box_pt(str(text), category)

        base_nx, base_ny = -dy / dist, dx / dist

        edge_side_specified = edge_side is not None
        if edge_side is None:
            edge_side = self.edge_side_default

        if mode == "edge":
            n = self._edge_normal(p1, p2)
            if n is None:
                nx, ny = base_nx, base_ny
            else:
                nx, ny = n
        else:
            nx, ny = base_nx, base_ny

        # Base height for the curved dimension.
        min_height_data = _pt_to_data_view(self.ax, self.MIN_CENTER_DIST_PT, "y")
        base_from_length = 0.05 * dist
        base_height_data = max(base_from_length, min_height_data)
        h = base_height_data * convexity

        # Optional boundary circle handling preserved in a simplified way.
        if self.boundary_circle is not None and not edge_side_specified:
            cx_c, cy_c, R = self.boundary_circle
            cpx_out = mx + nx * (2 * h)
            cpy_out = my + ny * (2 * h)
            d_out = np.hypot(cpx_out - cx_c, cpy_out - cy_c)

            cpx_in = mx - nx * (2 * h)
            cpy_in = my - ny * (2 * h)
            d_in = np.hypot(cpx_in - cx_c, cpy_in - cy_c)

            if d_out <= R and d_in > R:
                edge_side = "outer"
            elif d_in <= R and d_out > R:
                edge_side = "inner"

        if mode == "edge" and edge_side == "inner":
            nx, ny = -nx, -ny

        cpx, cpy = mx + nx * (2 * h), my + ny * (2 * h)
        verts = [(x1, y1), (cpx, cpy), (x2, y2)]
        codes = [mpath.Path.MOVETO, mpath.Path.CURVE3, mpath.Path.CURVE3]
        patch = patches.PathPatch(
            mpath.Path(verts, codes),
            facecolor="none",
            edgecolor="black",
            lw=self.LINE_WIDTH_DASHED,
            ls=self.DASH_STYLE,
            zorder=1,
        )
        self.ax.add_patch(patch)

        mid_x = 0.25 * x1 + 0.5 * cpx + 0.25 * x2
        mid_y = 0.25 * y1 + 0.5 * cpy + 0.25 * y2

        # Ensure minimum distance from the base segment AND from existing
        # dimension labels. As in the linear case, cap per-step growth so
        # that the height does not explode.
        for _ in range(self.DIM_COLLISION_MAX_ITERS):
            need_more = False

            dist_pt = self._dist_pt_point_to_segment((mid_x, mid_y), p1, p2)
            if dist_pt < self.MIN_CENTER_DIST_PT:
                need_more = True

            bbox_px = self._compute_label_bbox_px((mid_x, mid_y), w_pt, h_pt)
            if self._check_dim_bbox_collision(bbox_px):
                need_more = True

            if not need_more:
                break

            if dist_pt < self.MIN_CENTER_DIST_PT:
                target_factor = self.MIN_CENTER_DIST_PT / max(dist_pt, 1e-3)
                factor = min(1.35, max(1.05, target_factor))
            else:
                factor = 1.05
            h *= factor
            cpx, cpy = mx + nx * (2 * h), my + ny * (2 * h)
            verts = [(x1, y1), (cpx, cpy), (x2, y2)]
            patch.set_path(mpath.Path(verts, codes))
            mid_x = 0.25 * x1 + 0.5 * cpx + 0.25 * x2
            mid_y = 0.25 * y1 + 0.5 * cpy + 0.25 * y2

        self._place_text(mid_x, mid_y, dx, dy, text, category)
        final_bbox_px = self._compute_label_bbox_px((mid_x, mid_y), w_pt, h_pt)
        self._dim_bboxes.append(final_bbox_px)

        if arrows:
            self._add_arrow_tip(x1, y1, np.arctan2(cpy - y1, cpx - x1), True)
            self._add_arrow_tip(x2, y2, np.arctan2(y2 - cpy, x2 - cpx), False)

    # ------------------------------------------------------------------
    # 3. Circular / elliptical arc dimensions
    # ------------------------------------------------------------------
    def add_circular_arc_dimension(
        self,
        center,
        radius,
        angle_start,
        angle_end,
        text,
        mode: str = "solid",  # "solid" | "dashed"
        arrows: bool = True,
        aspect_ratio: float = 1.0,
        category: str = "variable",
    ):
        cx, cy = center
        w = radius * 2
        h = (radius * aspect_ratio) * 2

        if mode == "solid":
            style = self.SOLID_STYLE
            lw = self.LINE_WIDTH_SOLID
        else:
            style = self.DASH_STYLE
            lw = self.LINE_WIDTH_DASHED

        arc = patches.Arc(
            center,
            w,
            h,
            angle=0,
            theta1=angle_start,
            theta2=angle_end,
            color="black",
            lw=lw,
            ls=style,
            zorder=1,
        )
        self.ax.add_patch(arc)

        mid_rad = np.radians((angle_start + angle_end) / 2.0)
        rx, ry = w / 2.0, h / 2.0
        lx = cx + rx * np.cos(mid_rad)
        ly = cy + ry * np.sin(mid_rad)

        tan_dx = -rx * np.sin(mid_rad)
        tan_dy = ry * np.cos(mid_rad)

        self._place_text(lx, ly, tan_dx, tan_dy, text, category)

        if arrows:
            self._add_arrow_elliptical(cx, cy, rx, ry, np.radians(angle_start), True)
            self._add_arrow_elliptical(cx, cy, rx, ry, np.radians(angle_end), False)

    # ------------------------------------------------------------------
    # 4. Edge helper: choose curved vs straight dimension
    # ------------------------------------------------------------------
    def add_edge_dimension(
        self,
        p1,
        p2,
        text,
        side: str | None = None,
        curved: bool = True,
        category: str = "number",
    ):
        """
        Convenience wrapper for dimensions attached to polygon edges.

        - `curved=True`  -> Bezier curved, dashed dimension.
        - `curved=False` -> Straight, solid dimension with arrowheads.
        """
        if curved:
            self.add_smart_curve_dimension(
                p1,
                p2,
                text,
                convexity=1.0,
                arrows=False,
                avoid_points=None,
                category=category,
                mode="edge",
                edge_side=side,
            )
        else:
            self.add_linear_dimension(
                p1,
                p2,
                text,
                offset=0.3,
                no_witness=False,
                arrows=True,
                category=category,
                mode="edge",
                edge_side=side,
            )

    # ------------------------------------------------------------------
    # 5. Text & arrow utilities
    # ------------------------------------------------------------------
    def _place_text(self, x, y, dx, dy, text, category):
        if not text:
            return

        styled, prop = self.font_engine.style_text(text, category=category)

        self.ax.text(
            x,
            y,
            styled,
            fontdict=prop,
            rotation=0.0,
            rotation_mode="anchor",
            ha="center",
            va="center",
            bbox=dict(boxstyle="square,pad=0.05", fc="white", ec="none", alpha=1.0),
            zorder=2,
        )

    def _add_arrow_tip(self, x, y, rad, backward):
        rot = np.degrees(rad) + (180 if backward else 0)
        arrow_text = getattr(self, "ARROW_TEXT", ">")
        fontsize = getattr(self, "ARROW_FONTSIZE", 5)
        self.ax.text(
            x,
            y,
            arrow_text,
            fontsize=fontsize,
            rotation=rot,
            ha="center",
            va="center",
            zorder=2,
        )

    def _add_arrow_elliptical(self, cx, cy, rx, ry, rad, backward):
        x = cx + rx * np.cos(rad)
        y = cy + ry * np.sin(rad)
        tx = -rx * np.sin(rad)
        ty = ry * np.cos(rad)
        base_rot = np.degrees(np.arctan2(ty, tx))
        rot = base_rot + 90 + (180 if backward else 0)
        arrow_text = getattr(self, "ARROW_TEXT", ">")
        fontsize = getattr(self, "ARROW_FONTSIZE", 5)
        self.ax.text(
            x,
            y,
            arrow_text,
            fontsize=fontsize,
            rotation=rot,
            ha="center",
            va="center",
            zorder=2,
        )


__all__ = ["DimensionLabeler"]
