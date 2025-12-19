"""angle_core_v1_0
------------------
Helpers for angle objects: constructing rays, computing angle measures,
marking right/isosceles angles, and registering angular geometry in the
GeometryRegistry so that point labels can see the correct "actual rays".
"""
import numpy as np
import matplotlib.patches as patches

class AngleLabeler:
    """
    [LabelCore - Angle Module Final]
    
    중고등학교 수학/과학 문제 생성 엔진을 위한 각도 표시 모듈입니다.
    
    [주요 기능]
    - 기본 각도 아크, 이중 아크, 직각 표시
    - 3D 투영을 고려한 타원형 아크 (aspect_ratio)
    - 흑백 인쇄를 고려한 패턴 채우기 (hatch)
    - 치수선 및 방향 표시를 위한 양방향 화살표 (arrow_heads)
    - 좁은 각도 처리를 위한 자동 가이드선 (straight/curved)
    - 점(Dot)을 이용한 각도 표시
    """
    
    def __init__(self, ax, font_engine=None):
        """
        :param ax: Matplotlib Axes 객체
        :param font_engine: 폰트 스타일링을 담당하는 외부 엔진 인스턴스 (style_text 메서드 보유 필수)
        """
        self.ax = ax
        self.font_engine = font_engine
        
        from . import rc_core_v1_0 as rc_core
        from .label_core_v1_0 import PointLabeler
        self.LINE_WIDTH_GUIDE = rc_core.LINE_PT_SPEC["guide"]
        self.LINE_WIDTH_ARC = rc_core.LINE_PT_SPEC["angle"]
        self.DEFAULT_COLOR = 'black'

        self._point_labeler = PointLabeler(self.ax, font_engine=self.font_engine)

    def add_angle_marker(self, center, radius, angle_start, angle_end, 
                         text=None, 
                         is_right_angle=False, 
                         arc_count=1,          
                         tick_count=0,         
                         arrow=False,
                         arrow_direction='ccw', # 'ccw'(반시계) or 'cw'(시계)
                         arrow_heads='end',     # 'end', 'start', 'both'
                         filled=False,         
                         fill_color='lightgray',
                         hatch=None,            # None, '/', '.', 'x' 등 패턴
                         linestyle='solid',
                         color=None,
                         text_offset_scale=1.6,
                         text_rotation_mode='horizontal', # 'horizontal', 'tangent', 'radial'
                         dot=False,             
                         dot_radius=0.05,
                         aspect_ratio=1.0,      # 1.0=정원, <1.0=타원 (3D 효과)
                         guide_style='auto'     # 'auto', 'straight', 'curved'
                         ):
        
        cx, cy = center
        draw_color = color if color else self.DEFAULT_COLOR

        if radius is None or radius <= 0:
            fig = self.ax.figure
            radius_pt = 4.0
            delta_pix = radius_pt * fig.dpi / 72.0
            x0, y0 = self.ax.transData.transform((cx, cy))
            x1, y1 = x0 + delta_pix, y0
            x1_data, y1_data = self.ax.transData.inverted().transform((x1, y1))
            radius = float(np.hypot(x1_data - cx, y1_data - cy))
        else:
            radius = float(radius)
        
        if angle_end < angle_start:
            angle_end += 360
            
        span = abs(angle_end - angle_start)

        final_guide_style = guide_style
        if guide_style == 'auto':
            if span < 15: 
                final_guide_style = 'curved'
            else: 
                final_guide_style = 'straight'

        if dot:
            self._draw_dot_marker(cx, cy, radius, angle_start, angle_end, dot_radius, draw_color, aspect_ratio)

        if filled:
            self._draw_filled_sector(center, radius, angle_start, angle_end, fill_color, hatch)

        if is_right_angle:
            self._draw_right_angle(cx, cy, radius, angle_start, angle_end, draw_color)
            if not text:
                return 

        arc_obstacle = None
        if linestyle != 'none':
            self._draw_arcs(cx, cy, radius, angle_start, angle_end, 
                            arc_count, linestyle, draw_color, 
                            arrow, arrow_direction, arrow_heads, aspect_ratio)

            sample_count = 64
            thetas = np.linspace(angle_start, angle_end, sample_count)
            rads = np.radians(thetas)
            xs = cx + radius * np.cos(rads)
            ys = cy + (radius * aspect_ratio) * np.sin(rads)
            arc_obstacle = (xs, ys)

        if tick_count > 0:
            self._draw_tick_marks(cx, cy, radius, angle_start, angle_end, tick_count, draw_color, aspect_ratio)

        if text:
            self._draw_smart_label(
                cx,
                cy,
                radius,
                angle_start,
                angle_end,
                text,
                text_offset_scale,
                draw_color,
                text_rotation_mode,
                aspect_ratio,
                final_guide_style,
                arc_obstacle,
            )

    # -------------------------------------------------------------------------
    # Internal Drawing Methods
    # -------------------------------------------------------------------------

    def _draw_filled_sector(self, center, radius, start, end, color, hatch):
        """부채꼴 영역을 채웁니다. (색상 또는 흑백 패턴)"""
        fc = color if color else 'none'
        ec = color if hatch else 'none' 
        
        wedge = patches.Wedge(center, radius, start, end, 
                              facecolor=fc, edgecolor=ec, hatch=hatch,
                              alpha=0.5 if color else 1.0, zorder=1)
        self.ax.add_patch(wedge)

    def _draw_right_angle(self, cx, cy, radius, start, end, color):
        """벡터 합을 이용한 평행사변형 직각 마커 (3D 투영 대응)"""
        rad_s, rad_e = np.radians(start), np.radians(end)
        
        v1_x, v1_y = np.cos(rad_s), np.sin(rad_s)
        v2_x, v2_y = np.cos(rad_e), np.sin(rad_e)
        
        p1_x, p1_y = cx + radius * v1_x, cy + radius * v1_y
        p2_x, p2_y = cx + radius * v2_x, cy + radius * v2_y
        corner_x = cx + radius * (v1_x + v2_x)
        corner_y = cy + radius * (v1_y + v2_y)
        
        self.ax.plot([p1_x, corner_x, p2_x], [p1_y, corner_y, p2_y], 
                     color=color, lw=self.LINE_WIDTH_ARC, solid_capstyle='round', zorder=2)

    def _draw_arcs(self, cx, cy, radius, start, end, count, ls, color, arrow, direction, heads, aspect):
        """단일/이중 아크 및 화살표 처리"""
        gap = radius * 0.15 
        
        for i in range(count):
            current_r = radius + (i * gap)
            
            arc = patches.Arc((cx, cy), current_r*2, current_r*2*aspect, angle=0,
                              theta1=start, theta2=end,
                              color=color, lw=self.LINE_WIDTH_ARC, linestyle=ls, zorder=2)
            self.ax.add_patch(arc)
            
            if arrow and i == count - 1:
                if heads in ['end', 'both']:
                    self._draw_arrow_tip_elliptical(cx, cy, current_r, end, color, aspect, reverse=False)

                if heads in ['start', 'both']:
                    self._draw_arrow_tip_elliptical(cx, cy, current_r, start, color, aspect, reverse=True)

    def _draw_arrow_tip_elliptical(self, cx, cy, radius, angle_deg, color, aspect, reverse=False):
        """타원 궤도 접선 방향 화살표"""
        rad = np.radians(angle_deg)
        tip_x = cx + radius * np.cos(rad)
        tip_y = cy + (radius * aspect) * np.sin(rad)
        
        tangent_dx = -np.sin(rad)
        tangent_dy = aspect * np.cos(rad)
        
        norm = np.sqrt(tangent_dx**2 + tangent_dy**2)
        tangent_dx /= norm
        tangent_dy /= norm
        
        if reverse:
            tangent_dx = -tangent_dx
            tangent_dy = -tangent_dy
        
        scale = radius * 0.15
        
        self.ax.arrow(tip_x - tangent_dx*scale*0.5, tip_y - tangent_dy*scale*0.5, 
                      tangent_dx*scale*0.01, tangent_dy*scale*0.01,
                      head_width=scale, head_length=scale, 
                      fc=color, ec=color, length_includes_head=True, zorder=3, lw=0)

    def _draw_tick_marks(self, cx, cy, radius, start, end, count, color, aspect):
        """합동 표시 (짧은 선)"""
        mid_angle = (start + end) / 2
        tick_len = radius * 0.1
        deg_spacing = 4.0 
        
        offsets = []
        if count == 1: offsets = [0]
        elif count == 2: offsets = [-deg_spacing/2, deg_spacing/2]
        elif count == 3: offsets = [-deg_spacing, 0, deg_spacing]
        
        for off in offsets:
            rad = np.radians(mid_angle + off)
            c_x = cx + radius * np.cos(rad)
            c_y = cy + (radius * aspect) * np.sin(rad)
            
            nv_x = np.cos(rad)
            nv_y = np.sin(rad) * aspect
            
            p1_x = c_x - (tick_len/2) * nv_x
            p1_y = c_y - (tick_len/2) * nv_y
            p2_x = c_x + (tick_len/2) * nv_x
            p2_y = c_y + (tick_len/2) * nv_y
            
            self.ax.plot([p1_x, p2_x], [p1_y, p2_y], color=color, lw=self.LINE_WIDTH_ARC, zorder=3)

    def _draw_dot_marker(self, cx, cy, radius, start, end, dot_size, color, aspect):
        """점(Dot) 표시"""
        mid_deg = (start + end) / 2
        rad = np.radians(mid_deg)
        px = cx + radius * np.cos(rad)
        py = cy + (radius * aspect) * np.sin(rad)
        
        self.ax.plot(px, py, 'o', color=color, markersize=dot_size*100, zorder=5)

    def _draw_smart_label(self, cx, cy, radius, start, end, text, dist_scale, color, rot_mode, aspect, guide_style, arc_obstacle):
        """텍스트 레이블 배치 및 가이드선 그리기 (PointLabeler 기반 배치)"""
        span = abs(end - start)
        mid_deg = (start + end) / 2
        rad = np.radians(mid_deg)

        is_narrow = span < 45

        from . import view_core_v1_0 as _view_core  # 지연 임포트
        margin_pt = 3.0 * dist_scale
        mx = _view_core._pt_to_data(self.ax, margin_pt, axis="x")
        my = _view_core._pt_to_data(self.ax, margin_pt, axis="y")
        margin = max(mx, my)

        base_r = radius + margin
        base_tx = cx + base_r * np.cos(rad)
        base_ty = cy + base_r * aspect * np.sin(rad)

        dir_x = base_tx - cx
        dir_y = base_ty - cy

        self._point_labeler.add_point_label(
            cx,
            cy,
            text,
            obstacles=(self._point_labeler.placed_labels_polys + ([arc_obstacle] if arc_obstacle is not None else [])),
            manual_offset=(dir_x, dir_y),
            arrow=False,
            box_props=None,
            category='number',
        )

    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    def add_angle_at_points(
        self,
        center,
        from_point,
        to_point,
        text=None,
        reflex: bool = False,
        radius: float | None = None,
        **kwargs,
    ):
        """
        세 점 (center, from_point, to_point) 으로 각을 정의해
        add_angle_marker 를 통해 아크/라벨을 그리는 고수준 헬퍼.

        Args:
            center: 각의 꼭짓점 (예: A)
            from_point: 한 쪽 변의 점 (예: B)
            to_point: 다른 쪽 변의 점 (예: C)
            text: 각도 라벨 (예: r\"60^\\circ\")
            reflex: True 이면 큰 각(우각, >180°)을, False 이면 작은 각을 사용.
            **kwargs: add_angle_marker 에 그대로 전달할 추가 인자
                      (linestyle, color, text_offset_scale 등)
        """
        cx, cy = center
        fx, fy = from_point
        tx, ty = to_point

        v1x, v1y = fx - cx, fy - cy
        v2x, v2y = tx - cx, ty - cy

        a1 = np.degrees(np.arctan2(v1y, v1x))
        a2 = np.degrees(np.arctan2(v2y, v2x))

        a1 = (a1 + 360.0) % 360.0
        a2 = (a2 + 360.0) % 360.0

        delta = (a2 - a1) % 360.0

        if reflex:
            if delta < 180.0:
                delta = 360.0 - delta
                a2 = (a1 + delta) % 360.0
        else:
            if delta > 180.0:
                delta = 360.0 - delta
                a2 = (a1 + delta) % 360.0

        start = a1
        end = a2

        if radius is None or radius <= 0:
            span_deg = abs((end - start) % 360.0)
            if span_deg < 5.0:
                span_deg = 5.0
            span_rad = np.radians(span_deg)

            L_target_pt = 22.0
            radius_pt = L_target_pt / span_rad
            radius_pt = max(6.0, min(radius_pt, 20.0))

            from . import view_core_v1_0 as _view_core  # 지연 임포트로 순환 의존 최소화
            rx = _view_core._pt_to_data(self.ax, radius_pt, axis="x")
            ry = _view_core._pt_to_data(self.ax, radius_pt, axis="y")
            radius = max(rx, ry)

        self.add_angle_marker(
            center=center,
            radius=radius,
            angle_start=start,
            angle_end=end,
            text=text,
            **kwargs,
        )
