"""label_core_v1_0
-------------------
Main labeling engine: point labels, curve/line labels, axis and origin
labels, projection labels, and shape labels. Implements empty-angle
bisector logic, obstacle-aware placement, and special rules for
coordinate axes and dimension labels.
"""
import os

import sys

import re



import numpy as np

import matplotlib.pyplot as plt

from matplotlib.path import Path



# When executed directly as a script (for quick tests), ensure that the

# engine root is on sys.path so that the ``core`` package can be

# imported with absolute imports below.

if __package__ is None or __package__ == "":

    _engine_root_for_path = os.path.dirname(os.path.dirname(__file__))

    if _engine_root_for_path not in sys.path:

        sys.path.insert(0, _engine_root_for_path)



from core.font_core_v1_0 import FontCore

from core.rc_core_v1_0 import LINE_PT_SPEC

from core.view_core_v1_0 import _pt_to_data as _pt_to_data_view



class PointLabeler:

    """

    [LabelCore - Point & Equation Module v1.0]

    

    A comprehensive labeling engine for geometric plots.

    

    Key Features:

    1. Smart Placement: Radar scan, Sliding search, Bi-directional offset.

    2. Robust Collision: Rotated BBox, Pass-through detection, Leader line routing.

    3. Advanced Rendering: Floating anchors, Box edge anchoring, Arrowheads.

    4. Typography Support: Multi-line text, LaTeX height correction (\dfrac, \sum).

    """

    def __init__(self, ax, font_engine=None, font_scale=1.0, geom_registry=None):

        self.ax = ax

        self.font_engine = font_engine if font_engine else FontCore()

        self.FONT_SCALE = font_scale 



        self.auto_adjust = False

        

        # Configuration

        self.SCAN_STEP_DEG = 10

        self.SCAN_DIST_RANGE = (0.3 * self.FONT_SCALE, 0.5 * self.FONT_SCALE)

        self.LEADER_DIST_RANGE = (0.8 * self.FONT_SCALE, 1.5 * self.FONT_SCALE)

        

        # Cost Weights

        self.W_OVERLAP = 1e6

        self.W_OUT_OF_BOUNDS = 1e5

        self.W_LEADER_CROSS = 1e5

        self.W_PREF_ANGLE = 10

        self.W_DIST = 100

        self.W_SLIDE_PENALTY = 500

        self.W_SIDE_FLIP_PENALTY = 50

        self.W_VIEWPORT_DIST = 50

        

        # Internal State

        self.placed_labels_polys = []

        self._label_text_artists = []

        self.LINE_WIDTH_LEADER = LINE_PT_SPEC["leader"]

        self.LINE_WIDTH_PROJ = LINE_PT_SPEC["projection"]

        self.ARROW_HEAD_WIDTH = 0.08 * self.FONT_SCALE

        self.ARROW_HEAD_LENGTH = 0.12 * self.FONT_SCALE



        # Optional geometry registry for automatic "ray" detection.




        self.geom_registry = geom_registry

        

        # Default Style



        self.DEFAULT_BOX_PROPS = None



    # ====================================================================

    # 1. Point Labeling

    # ====================================================================

    def add_point_label(self, x, y, text, obstacles=[], neighbors=[], preferred_angle=None, manual_offset=None, arrow=False, box_props=None, category='point'):

        styled, prop = self.font_engine.style_text(text, category=category)

        w, h = self._estimate_text_size(text)

        b_props = box_props if box_props else self.DEFAULT_BOX_PROPS

        

        if preferred_angle is None and neighbors:

            preferred_angle = self._calculate_bisector_angle(x, y, neighbors)

        if preferred_angle is None: preferred_angle = 45



        best_x, best_y, use_leader = x, y, False

        final_ha, final_va = 'center', 'center'



        if manual_offset:



            best_x = x + manual_offset[0]

            best_y = y + manual_offset[1]

        else:

            # 1. Near Scan

            best_x, best_y, cost, (final_ha, final_va) = self._scan_area_aligned(

                x, y, w, h, obstacles, preferred_angle, self.SCAN_DIST_RANGE, check_leader=False

            )

            

            # 2. Far Scan (Leader)

            if cost >= self.W_OVERLAP:

                lx, ly, l_cost, (l_ha, l_va) = self._scan_area_aligned(

                    x, y, w, h, obstacles, preferred_angle, self.LEADER_DIST_RANGE, check_leader=True

                )

                if l_cost < cost:

                    best_x, best_y = lx, ly

                    final_ha, final_va = l_ha, l_va

                    use_leader = True



        if use_leader:

            # Padding from point marker

            pad = 0.05 * self.FONT_SCALE

            angle = np.arctan2(best_y - y, best_x - x)

            start_x = x + pad * np.cos(angle)

            start_y = y + pad * np.sin(angle)



            # Anchor to box edge

            cx, cy = self._get_center_from_alignment(best_x, best_y, w, h, final_ha, final_va)

            end_x, end_y = self._get_box_intersection(start_x, start_y, cx, cy, w, h, 0)



            self.ax.plot([start_x, end_x], [start_y, end_y], color="black", lw=self.LINE_WIDTH_LEADER, zorder=1)



            if arrow:

                self._draw_arrowhead(start_x, start_y, angle + np.pi)



        text_artist = self.ax.text(

            best_x,

            best_y,

            styled,

            fontdict=prop,

            ha=final_ha,

            va=final_va,

            bbox=b_props,

            zorder=2,

        )

        self._label_text_artists.append(text_artist)



        cx, cy = self._get_center_from_alignment(best_x, best_y, w, h, final_ha, final_va)

        self._register_bbox(cx, cy, w, h, rotation=0)



        # Optional global refinement using adjustText (if installed).

        if self.auto_adjust:


            self.refine_layout_with_adjusttext(enabled=True)



    # ====================================================================

    # 2. Equation & Curve Labeling

    # ====================================================================

    def add_curve_label(self, x_data, y_data, text, index_ratio=0.7, offset=0.3, category='variable', obstacles=[], arrow=False, box_props=None):

        """

        Place a label for a curve given by sampled points (x_data, y_data).



        Obstacles considered in the cost function:

        - this curve itself (?? ?ë ?¬í¨)

        - callerê° ?ë¬??ëª¨ë  ????ê³¡ì  obstacle

        - ?´ë? ë°°ì¹???¤ë¥¸ ?¼ë²¨?¤ì bbox (placed_labels_polys)



        ê±°ë¦¬ ê·ì¹:

        - ê¸°ì? ê±°ë¦¬ d0 = offset * FONT_SCALE

        - d0??0.5ë°? 1ë°? 1.5ë°???ê°ì§ ê±°ë¦¬ë¥??ë³´ë¡??¬ì©?ê³ 

          dê° d0?ì ë©?´ì§?ë¡ ?ì? ?¨ë?°ë? ì¶ê??ë¤.

        """

        styled, prop = self.font_engine.style_text(text, category=category)

        w, h = self._estimate_text_size(text)

        b_props = box_props if box_props else self.DEFAULT_BOX_PROPS




        base_offset = 0.1 * self.FONT_SCALE

        offset_candidates = [base_offset]



        total_len = len(x_data)

        center_idx = int(total_len * index_ratio)



        step = max(1, int(total_len * 0.02))

        all_indices = list(range(1, max(1, total_len - 1), step))

        x_min_curve = float(np.min(x_data))

        x_max_curve = float(np.max(x_data))

        xL, xR = self.ax.get_xlim()

        x_mid = 0.5 * (xL + xR)

        side_indices = all_indices

        if x_max_curve <= x_mid:

            left_side = [i for i in all_indices if x_data[i] < x_mid]

            if left_side:

                side_indices = left_side

        elif x_min_curve >= x_mid:

            right_side = [i for i in all_indices if x_data[i] > x_mid]

            if right_side:

                side_indices = right_side

        indices = sorted(side_indices, key=lambda i: abs(i - center_idx))




        if obstacles is None:

            obstacles = []

        obstacles_effective = list(obstacles) + [(x_data, y_data)]




        xlim, ylim = self.ax.get_xlim(), self.ax.get_ylim()

        center_strip_w = _pt_to_data_view(self.ax, 20.0 * self.FONT_SCALE, axis="x")



        best_params = None

        min_cost = float("inf")




        for idx in indices:

            cx, cy = x_data[idx], y_data[idx]

            dx, dy = x_data[idx + 1] - x_data[idx - 1], y_data[idx + 1] - y_data[idx - 1]

            norm = np.hypot(dx, dy)

            if norm == 0:

                continue

            nx, ny = -dy / norm, dx / norm



            for sign in [1, -1]:

                for dist in offset_candidates:

                    tx, ty = cx + nx * dist * sign, cy + ny * dist * sign




                    cost = 0.0

                    poly = self._get_rotated_poly(tx, ty, w, h, 0.0)



                    if self._check_collision_all_types(poly, obstacles_effective):

                        cost += self.W_OVERLAP

                    if self._check_out_of_bounds(poly):

                        cost += self.W_OUT_OF_BOUNDS




                    poly_x_min = float(poly[:, 0].min())

                    poly_x_max = float(poly[:, 0].max())

                    if poly_x_min < center_strip_w and poly_x_max > -center_strip_w:

                        cost += self.W_OVERLAP




                    # slide_penalty = (abs(idx - center_idx) / total_len) * self.W_SLIDE_PENALTY

                    # cost += slide_penalty




                    dist_penalty = abs(dist - base_offset) * self.W_DIST

                    cost += dist_penalty




                    d_left = abs(tx - xlim[0])

                    d_right = abs(xlim[1] - tx)

                    d_bottom = abs(ty - ylim[0])

                    d_top = abs(ylim[1] - ty)


                    edge_dist = min(d_left, d_right, d_bottom, d_top)

                    cost += edge_dist * self.W_VIEWPORT_DIST



                    if sign == -1:

                        cost += self.W_SIDE_FLIP_PENALTY



                    if cost < min_cost:

                        min_cost = cost

                        best_params = (tx, ty, 0.0, False, None, "center", "center")



                    if cost == 0:

                        break

                if min_cost == 0:

                    break

            if min_cost == 0:

                break





        if False and min_cost >= self.W_OVERLAP:

            leader_dist = self.LEADER_DIST_RANGE[1]

            leader_indices = indices[::2]

            for idx in leader_indices:

                cx, cy = x_data[idx], y_data[idx]

                dx, dy = x_data[idx + 1] - x_data[idx - 1], y_data[idx + 1] - y_data[idx - 1]

                norm = np.hypot(dx, dy)

                if norm == 0:

                    continue

                nx, ny = -dy / norm, dx / norm

                for sign in [1, -1]:

                    lx, ly = cx + nx * leader_dist * sign, cy + ny * leader_dist * sign

                    cost = 0.0

                    if self._check_collision_segment((cx, cy, lx, ly), obstacles_effective):

                        cost += self.W_LEADER_CROSS

                    angle_deg = np.degrees(np.arctan2(ly - cy, lx - cx)) % 360

                    ha, va = self._get_alignment_from_angle(angle_deg)

                    real_cx, real_cy = self._get_center_from_alignment(lx, ly, w, h, ha, va)

                    poly = self._get_rotated_poly(real_cx, real_cy, w, h, 0)

                    if self._check_collision_all_types(poly, obstacles_effective):

                        cost += self.W_OVERLAP

                    if self._check_out_of_bounds(poly):

                        cost += self.W_OUT_OF_BOUNDS

                    cost += (abs(idx - center_idx) / total_len) * self.W_SLIDE_PENALTY

                    if cost < min_cost:

                        min_cost = cost

                        best_params = (lx, ly, 0, True, (cx, cy), ha, va)



        if best_params:

            fx, fy, frot, use_leader, anchor, ha, va = best_params

            if use_leader:

                ax_x, ax_y = anchor

                real_cx, real_cy = self._get_center_from_alignment(fx, fy, w, h, ha, va)

                end_x, end_y = self._get_box_intersection(ax_x, ax_y, real_cx, real_cy, w, h, frot)

                self.ax.plot(

                    [ax_x, end_x],

                    [ax_y, end_y],

                    color="black",

                    lw=self.LINE_WIDTH_LEADER,

                    zorder=1,

                )

                if arrow:

                    angle = np.arctan2(ax_y - end_y, ax_x - end_x)

                    self._draw_arrowhead(ax_x, ax_y, angle)



            text_artist = self.ax.text(

                fx,

                fy,

                styled,

                fontdict=prop,

                rotation=frot,

                rotation_mode="anchor",

                ha=ha,

                va=va,

                bbox=b_props,

                zorder=2,

            )

            self._label_text_artists.append(text_artist)

            cx, cy = (
                self._get_center_from_alignment(fx, fy, w, h, ha, va)
                if use_leader
                else (fx, fy)
            )

            self._register_bbox(cx, cy, w, h, rotation=frot)

            # Register final label polygon so that subsequent geometry
            # (segments, curves, other labels) can treat this label box
            # as an obstacle.
            poly_final = self._get_rotated_poly(cx, cy, w, h, frot)
            box_final = [
                float(poly_final[:, 0].min()),
                float(poly_final[:, 1].min()),
                float(poly_final[:, 0].max()),
                float(poly_final[:, 1].max()),
            ]

            self._clip_lines_by_label_box(box_final)



    def add_line_label(self, x1, y1, x2, y2, text, pos_ratio=0.5, offset=0.2, category='variable', obstacles=[], arrow=False, box_props=None):

        steps = 20

        x_data = np.linspace(x1, x2, steps); y_data = np.linspace(y1, y2, steps)

        self.add_curve_label(x_data, y_data, text, index_ratio=pos_ratio, offset=offset, category=category, obstacles=obstacles, arrow=arrow, box_props=box_props)



    # ====================================================================

    # 3. Projection Labeling

    # ====================================================================

    def add_projection_label(self, x, y, text, axis='x', category='point', box_props=None):

        styled, prop = self.font_engine.style_text(text, category=category)

        w, h = self._estimate_text_size(text)

        b_props = box_props if box_props else self.DEFAULT_BOX_PROPS

        proj_x, proj_y = (x, 0) if axis == 'x' else (0, y)

        

        self.ax.plot([x, proj_x], [y, proj_y], color='black', ls='--', lw=self.LINE_WIDTH_PROJ, zorder=1)



        pad = 0.1 * self.FONT_SCALE

        

        if axis == 'x':

            lbl_x, lbl_y = proj_x, proj_y - pad

            ha, va = 'center', 'top'

        else:

            lbl_x, lbl_y = proj_x - pad, proj_y

            ha, va = 'right', 'center'



        text_artist = self.ax.text(

            lbl_x,

            lbl_y,

            styled,

            fontdict=prop,

            ha=ha,

            va=va,

            bbox=b_props,

            zorder=2,

        )

        self._label_text_artists.append(text_artist)

        cx, cy = self._get_center_from_alignment(lbl_x, lbl_y, w, h, ha, va)

        self._register_bbox(cx, cy, w, h, rotation=0)





class VertexLabeler:

    """

    High-level helper for labeling polygon vertices (A, B, C, ...).



    ê¸°ë³¸ ?¬ì© ?¨í´

    -------------

    polygon = [(x0, y0), (x1, y1), ...]  # ê¼?§???ì?ë¡?

    labels  = ["A", "B", "C", ...]



    vlabeler = VertexLabeler(ax, font_engine)

    vlabeler.label_polygon(polygon, labels)



    - ?¤ê°?ì ë¬´ê²ì¤ì¬?ì ê°?ê¼?§?ì¼ë¡??¥í??ë°©í¥??ê³ì°??

      ?¼ì ??ê±°ë¦¬(base_offset_pt)ë§í¼ ë°ê¹¥ìª½ì¼ë¡??¼ë²¨??ë°°ì¹?ë¤.

    - ê±°ë¦¬ ?¨ì??pt ê¸°ì??´ë©°, view_core_v1_0._pt_to_data ë¥??´ì©??

      data ì¢íê³?ê±°ë¦¬ë¡?ë³?í??

    """



    def __init__(

        self,

        ax: plt.Axes,

        font_engine: FontCore | None = None,

        font_scale: float = 1.0,

        base_offset_pt: float = 16.0,

    ) -> None:

        self.ax = ax

        self.base_offset_pt = base_offset_pt


        self._point_labeler = PointLabeler(ax, font_engine=font_engine, font_scale=font_scale)



    def label_polygon(self, polygon, labels):

        """

        polygon ê¼?§?ë¤??labels ë¥??ì?ë¡?ë°°ì¹?ë¤.



        Args:

            polygon: [(x0, y0), (x1, y1), ...] ?í??ê¼?§??ë¦¬ì¤??

            labels:  ["A", "B", "C", ...] ?¼ë²¨ ë¦¬ì¤??(len ?ì¼?´ì¼ ??

        """

        points = list(polygon)

        if len(points) != len(labels):

            raise ValueError("polygon ê³?labels ??ê¸¸ì´ê° ?¼ì¹?´ì¼ ?©ë??")



        if not points:

            return




        xs = [float(p[0]) for p in points]

        ys = [float(p[1]) for p in points]

        cx = float(np.mean(xs))

        cy = float(np.mean(ys))




        from . import view_core_v1_0 as _view_core  # ì§???í¬?¸ë¡ ?í ?ì¡´ ìµì??



        font_size_pt = getattr(self._point_labeler.font_engine, "font_size", 8.0)

        min_offset_pt = max(self.base_offset_pt, font_size_pt * 3.0)



        dx = _view_core._pt_to_data(self.ax, min_offset_pt, axis="x")

        dy = _view_core._pt_to_data(self.ax, min_offset_pt, axis="y")

        base_offset = max(dx, dy)




        edge_obstacles = []

        n = len(points)

        for i in range(n):

            x1, y1 = points[i]

            x2, y2 = points[(i + 1) % n]

            edge_obstacles.append((float(x1), float(y1), float(x2), float(y2)))



        for (x, y), text in zip(points, labels):

            vx = float(x) - cx

            vy = float(y) - cy

            length = float(np.hypot(vx, vy))

            if length == 0.0:


                dir_x, dir_y = 0.0, 1.0

            else:

                dir_x, dir_y = vx / length, vy / length



            offset_x = dir_x * base_offset

            offset_y = dir_y * base_offset



            self._point_labeler.add_point_label(

                x,

                y,

                text,

                obstacles=self._point_labeler.placed_labels_polys + edge_obstacles,

                manual_offset=(offset_x, offset_y),

            )



    # ====================================================================

    # 4. Core Utilities

    # ====================================================================

    def _estimate_text_size(self, text):

        """Estimate text dimensions including multi-line & LaTeX height correction."""

        if not text: return 0.1, 0.1

        lines = text.split('\n')

        max_w, total_h = 0, 0

        

        for line in lines:

            clean_text = re.sub(r'\\[a-zA-Z]+', 'a', line.replace('$', ''))

            clean_text = re.sub(r'[\{\}\_\^]', '', clean_text)

            text_len = len(clean_text)

            w = (0.15 * text_len + 0.1) * self.FONT_SCALE

            max_w = max(max_w, w)

            

            # Height boost for fractions/sums

            h_factor = 0.3

            if r'\frac' in line or r'\dfrac' in line or r'\sum' in line or r'\int' in line or r'\lim' in line:

                h_factor = 0.5

            total_h += (h_factor * self.FONT_SCALE)

            

        return max_w, total_h



    def _draw_arrowhead(self, x, y, angle):

        length, width = self.ARROW_HEAD_LENGTH, self.ARROW_HEAD_WIDTH

        back_x = x - length * np.cos(angle); back_y = y - length * np.sin(angle)

        wing1_x = back_x + width * np.cos(angle + np.pi/2); wing1_y = back_y + width * np.sin(angle + np.pi/2)

        wing2_x = back_x + width * np.cos(angle - np.pi/2); wing2_y = back_y + width * np.sin(angle - np.pi/2)

        self.ax.add_patch(plt.Polygon([(x, y), (wing1_x, wing1_y), (wing2_x, wing2_y)], closed=True, color='black', zorder=1))



    def _get_box_intersection(self, px, py, cx, cy, w, h, rotation):

        poly = self._get_rotated_poly(cx, cy, w, h, rotation)

        segments = [(poly[0], poly[1]), (poly[1], poly[2]), (poly[2], poly[3]), (poly[3], poly[0])]

        start_p = np.array([px, py]); end_p = np.array([cx, cy])

        best_intersect = (cx, cy); min_dist_sq = float('inf')

        for p1, p2 in segments:

            pt = self._line_intersection(start_p, end_p, p1, p2)

            if pt is not None:

                dist_sq = (pt[0]-px)**2 + (pt[1]-py)**2

                if dist_sq < min_dist_sq: min_dist_sq = dist_sq; best_intersect = pt

        return best_intersect[0], best_intersect[1]



    def _line_intersection(self, p1, p2, p3, p4):

        x1, y1 = p1; x2, y2 = p2; x3, y3 = p3; x4, y4 = p4

        denom = (y4-y3)*(x2-x1) - (x4-x3)*(y2-y1)

        if denom == 0: return None

        ua = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / denom

        ub = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / denom

        if 0 <= ua <= 1 and 0 <= ub <= 1: return np.array([x1 + ua * (x2-x1), y1 + ua * (y2-y1)])

        return None



    def _scan_area_aligned(self, cx, cy, w, h, obstacles, pref_angle, dist_range, check_leader):

        best_pos = (cx, cy); min_cost = float('inf'); best_align = ('center', 'center')

        for deg in np.arange(0, 360, self.SCAN_STEP_DEG):

            rad = np.radians(deg); ha, va = self._get_alignment_from_angle(deg)

            for dist in np.linspace(dist_range[0], dist_range[1], 3):

                tx = cx + dist * np.cos(rad); ty = cy + dist * np.sin(rad)

                real_cx, real_cy = self._get_center_from_alignment(tx, ty, w, h, ha, va)

                poly = self._get_rotated_poly(real_cx, real_cy, w, h, 0)

                cost = 0

                if self._check_collision_all_types(poly, obstacles): cost += self.W_OVERLAP

                if self._check_out_of_bounds(poly): cost += self.W_OUT_OF_BOUNDS

                if check_leader and self._check_collision_segment((cx, cy, tx, ty), obstacles): cost += self.W_LEADER_CROSS

                angle_diff = abs(pref_angle - deg); 

                if angle_diff > 180: angle_diff = 360 - angle_diff

                cost += angle_diff * self.W_PREF_ANGLE + dist * self.W_DIST

                if cost < min_cost: min_cost = cost; best_pos = (tx, ty); best_align = (ha, va)

        return best_pos[0], best_pos[1], min_cost, best_align



    # Helper Functions

    def _check_collision_all_types(self, poly, obstacles):

        if self._check_collision_poly(poly): return True

        box = [poly[:,0].min(), poly[:,1].min(), poly[:,0].max(), poly[:,1].max()]

        for obs in obstacles:

            if len(obs) == 4 and isinstance(obs[0], (int, float)):

                 if self._check_collision_line_box(box, poly, obs): return True

            elif len(obs) == 2 and hasattr(obs[0], '__len__'):

                if self._check_collision_curve_box(box, poly, obs[0], obs[1]): return True

        return False

    def _check_collision_curve_box(self, box, poly, x_data, y_data):

        """

        ?ë? ê³¡ì -?¼ë²¨ ì¶©ë ê²??



        - poly: ?ì ???¼ë²¨ ë°ì¤ ê¼?§??(4x2)

        - x_data, y_data: ê³¡ì ???´ë£¨???°ì´???í??



        1?¨ê³: poly? ê³¡ì ??AABBê° ?í? ê²¹ì¹ì§ ?ì¼ë©?ë°ë¡ ?ë½.

        2?¨ê³: ?¼ë²¨ ì£¼ë? êµ¬ê°ë§?ì¶ë ¤?? ê³¡ì  ?¸ê·¸ë¨¼í¸? ?¼ë²¨ 4ê°?ë³??

                ? ë¶-? ë¶ êµì°¨ë¥??ì ê²??

        """

        if len(x_data) < 2:

            return False



        x_arr = np.asarray(x_data)

        y_arr = np.asarray(y_data)




        pl, pr = poly[:, 0].min(), poly[:, 0].max()

        pb, pt = poly[:, 1].min(), poly[:, 1].max()



        # Curve AABB

        cl, cr = x_arr.min(), x_arr.max()

        cb, ct = y_arr.min(), y_arr.max()




        if cr < pl or cl > pr or ct < pb or cb > pt:

            return False




        label_segments = []

        for i in range(4):

            p1 = tuple(poly[i])

            p2 = tuple(poly[(i + 1) % 4])

            label_segments.append((p1, p2))




        margin = 0.1 * getattr(self, "FONT_SCALE", 1.0)

        in_region = np.where(

            (x_arr >= pl - margin)

            & (x_arr <= pr + margin)

            & (y_arr >= pb - margin)

            & (y_arr <= pt + margin)

        )[0]



        if in_region.size == 0:

            return False



        start_idx = max(0, int(in_region.min()) - 1)


        end_idx = min(len(x_arr) - 2, int(in_region.max()) + 1)



        for i in range(start_idx, end_idx + 1):

            q1 = (float(x_arr[i]), float(y_arr[i]))

            q2 = (float(x_arr[i + 1]), float(y_arr[i + 1]))

            for p1, p2 in label_segments:

                if self._segments_intersect(p1, p2, q1, q2):

                    return True



        return False

    def _check_collision_line_box(self, box, poly, line):

        x1, y1, x2, y2 = line

        l, r, b, t = box[0], box[2], box[1], box[3]

        l-=0.05; r+=0.05; b-=0.05; t+=0.05

        if (l<=x1<=r and b<=y1<=t) or (l<=x2<=r and b<=y2<=t): return True

        p1, p2 = (x1, y1), (x2, y2)

        box_segments = [((l, b), (l, t)), ((l, t), (r, t)), ((r, t), (r, b)), ((r, b), (l, b))]

        for s1, s2 in box_segments:

            if self._segments_intersect(p1, p2, s1, s2): return True

        return False



    def _clip_lines_by_label_box(self, box):

        """

        ???¼ë²¨??ì¶ì ?í??ë°ì¤(box = [l, b, r, t])?

        êµì°¨?ë ëª¨ë  Line2Dë¥??ë¼?? ?¼ë²¨ ?´ë?ë¥??µê³¼?ë

        ? ë¶? ê·¸ë¦¬ì§ ?ëë¡??´ë¦¬?í??



        - ë°ì¤ ê²½ê³???ì©(ê²½ê³ê¹ì?ë§?ê·¸ë¦¬ê¸?

        - ë°ì¤ ?´ë?ë¥??ì ??ì§?ë êµ¬ê°ë§??ê±°?ë¤.

        """

        l, b, r, t = map(float, box)

        if not np.all(np.isfinite([l, b, r, t])) or l >= r or b >= t:

            return



        def _inside(px, py):


            return (l < px) and (px < r) and (b < py) and (py < t)



        for line in list(self.ax.lines):

            xdata = np.asarray(line.get_xdata(), dtype=float)

            ydata = np.asarray(line.get_ydata(), dtype=float)

            if xdata.size < 2 or ydata.size != xdata.size:

                continue



            new_x = []

            new_y = []

            prev_end = None



            n = len(xdata)

            for i in range(n - 1):

                x1 = xdata[i]

                y1 = ydata[i]

                x2 = xdata[i + 1]

                y2 = ydata[i + 1]



                if not (

                    np.isfinite(x1)

                    and np.isfinite(y1)

                    and np.isfinite(x2)

                    and np.isfinite(y2)

                ):



                    prev_end = None

                    continue



                dx = x2 - x1

                dy = y2 - y1



                ts = []

                if dx != 0.0:


                    for x_edge in (l, r):

                        t_edge = (x_edge - x1) / dx

                        if 0.0 <= t_edge <= 1.0:

                            y_edge = y1 + dy * t_edge

                            if b <= y_edge <= t:

                                ts.append(t_edge)

                if dy != 0.0:


                    for y_edge in (b, t):

                        t_edge = (y_edge - y1) / dy

                        if 0.0 <= t_edge <= 1.0:

                            x_edge = x1 + dx * t_edge

                            if l <= x_edge <= r:

                                ts.append(t_edge)



                if ts:

                    ts = sorted(set(ts))

                breakpoints = [0.0] + ts + [1.0]



                for j in range(len(breakpoints) - 1):

                    t_start = breakpoints[j]

                    t_end = breakpoints[j + 1]

                    mid_t = 0.5 * (t_start + t_end)

                    mid_x = x1 + dx * mid_t

                    mid_y = y1 + dy * mid_t




                    if _inside(mid_x, mid_y):

                        continue



                    sx = x1 + dx * t_start

                    sy = y1 + dy * t_start

                    ex = x1 + dx * t_end

                    ey = y1 + dy * t_end



                    if (

                        prev_end is not None

                        and abs(prev_end[0] - sx) < 1e-9

                        and abs(prev_end[1] - sy) < 1e-9

                    ):


                        new_x.append(ex)

                        new_y.append(ey)

                    else:


                        if new_x:

                            new_x.append(np.nan)

                            new_y.append(np.nan)

                        new_x.extend([sx, ex])

                        new_y.extend([sy, ey])

                    prev_end = (ex, ey)



            if new_x:

                line.set_data(new_x, new_y)

            else:



                if any(_inside(float(xd), float(yd)) for xd, yd in zip(xdata, ydata)):

                    line.set_data([np.nan], [np.nan])



    def _segments_intersect(self, p1, p2, q1, q2):

        """Return True if segments p1-p2 and q1-q2 intersect (including touching)."""

        (x1, y1), (x2, y2) = p1, p2

        (x3, y3), (x4, y4) = q1, q2



        def orient(ax, ay, bx, by, cx, cy):

            return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)



        o1 = orient(x1, y1, x2, y2, x3, y3)

        o2 = orient(x1, y1, x2, y2, x4, y4)

        o3 = orient(x3, y3, x4, y4, x1, y1)

        o4 = orient(x3, y3, x4, y4, x2, y2)



        # General case

        if o1 * o2 < 0 and o3 * o4 < 0:

            return True



        # Collinear / touching cases

        def on_seg(ax, ay, bx, by, cx, cy):
            return (
                min(ax, bx) - 1e-9 <= cx <= max(ax, bx) + 1e-9 and
                min(ay, by) - 1e-9 <= cy <= max(ay, by) + 1e-9
            )



        if o1 == 0 and on_seg(x1, y1, x2, y2, x3, y3): return True

        if o2 == 0 and on_seg(x1, y1, x2, y2, x4, y4): return True

        if o3 == 0 and on_seg(x3, y3, x4, y4, x1, y1): return True

        if o4 == 0 and on_seg(x3, y3, x4, y4, x2, y2): return True



        return False

    def _check_collision_segment(self, segment, obstacles):

        p1, p2 = (segment[0], segment[1]), (segment[2], segment[3])

        for obs in obstacles:

            if len(obs) == 4 and isinstance(obs[0], (int, float)):

                if self._segments_intersect(p1, p2, (obs[0], obs[1]), (obs[2], obs[3])): return True

        return False

    def _check_collision_poly(self, new_poly_coords):

        n_xs, n_ys = new_poly_coords[:, 0], new_poly_coords[:, 1]

        nl, nr, nb, nt = n_xs.min(), n_xs.max(), n_ys.min(), n_ys.max()

        margin = 0.05 * self.FONT_SCALE

        new_path = Path(new_poly_coords)

        for exist_poly in self.placed_labels_polys:

            e_xs, e_ys = exist_poly[:, 0], exist_poly[:, 1]

            el, er, eb, et = e_xs.min(), e_xs.max(), e_ys.min(), e_ys.max()

            if (nl - margin < er and nr + margin > el and nb - margin < et and nt + margin > eb):

                if any(Path(exist_poly).contains_points(new_poly_coords)) or any(

                    new_path.contains_points(exist_poly)

                ):

                    return True

        return False

    def _check_out_of_bounds(self, poly):

        xlim, ylim = self.ax.get_xlim(), self.ax.get_ylim()

        xs, ys = poly[:, 0], poly[:, 1]

        if xs.min() < xlim[0] or xs.max() > xlim[1] or ys.min() < ylim[0] or ys.max() > ylim[1]: return True

        return False

    def _get_alignment_from_angle(self, deg):

        deg = deg % 360

        if 45 <= deg < 135: return 'center', 'bottom'

        elif 135 <= deg < 225: return 'right', 'center'

        elif 225 <= deg < 315: return 'center', 'top'

        else: return 'left', 'center'

    def _get_center_from_alignment(self, x, y, w, h, ha, va):

        cx, cy = x, y

        if ha == 'left': cx += w/2

        elif ha == 'right': cx -= w/2

        if va == 'bottom': cy += h/2

        elif va == 'top': cy -= h/2

        return cx, cy

    def _get_rotated_poly(self, cx, cy, w, h, rotation):

        corners = np.array([[-w/2, -h/2], [w/2, -h/2], [w/2, h/2], [-w/2, h/2]])

        rad = np.radians(rotation); c, s = np.cos(rad), np.sin(rad)

        rot_matrix = np.array([[c, -s], [s, c]])

        return np.dot(corners, rot_matrix.T) + [cx, cy]

    def _register_bbox(self, cx, cy, w, h, rotation):

        poly = self._get_rotated_poly(cx, cy, w, h, rotation)

        self.placed_labels_polys.append(poly)

    def _calculate_bisector_angle(self, cx, cy, neighbors):

        """

        Compute the maximum empty-angle bisector from a set of rays.



        Parameters

        ----------

        cx, cy : float

            Anchor point (labelled point).

        neighbors : list[(float, float)]

            Each element represents **one geometric ray actually drawn

            in the scene**, starting at (cx, cy) and going through the

            given neighbor point.



            ì¤ì??ê·ì¹:

            - ?ë???¤ì  ? ë¶/ê³¡ì  ë°©í¥? ??ë²ë§ ?£ë??

              (?? ?¸ë¡ ? ë¶???ìª½?¼ë¡ë§??´ì´???ë¤ë©? ?ëìª?

              ë°©í¥ ?´ì? ?£ì? ?ë??)

            - ?ì¹?¸ ??ë°©í¥??ëª¨ë ?£ì¼ë©??´ë¹ ? ì´ ??ê°ì

              ?ì´ë¡?ê³ì°?ì´ ë¹ê°???ê³¡?????ë¤.

            - ???¨ì??*ì£¼ì´ì§? ?ì´???¬ì´??ìµë? ë¹ê°ë§?

              ê³ì°?ë?ë¡? ?¤ì  ?í??ì¡´ì¬?ì? ?ë ë°©í¥?

              neighbors ???¬í¨?ì? ?ë??

        """

        if not neighbors:

            return 45.0

        angles = sorted(

            [np.degrees(np.arctan2(ny - cy, nx - cx)) % 360.0 for nx, ny in neighbors]

        )

        max_gap, best_angle = 0.0, 45.0

        for i in range(len(angles)):

            curr, next_ang = angles[i], angles[(i + 1) % len(angles)]

            if next_ang < curr:

                next_ang += 360.0

            gap = next_ang - curr

            if gap > max_gap:

                max_gap = gap

                best_angle = curr + gap / 2.0

        return best_angle % 360.0



    def _get_bisector_candidates(self, cx, cy, neighbors):

        """

        Return all empty-angle bisector directions sorted by descending gap.



        Used when a label cannot be placed along the *best* bisector due

        to collisions; the next candidates are tried in order.

        """

        if not neighbors:

            return [45.0]

        angles = sorted(

            [np.degrees(np.arctan2(ny - cy, nx - cx)) % 360.0 for nx, ny in neighbors]

        )

        candidates: list[tuple[float, float]] = []

        for i in range(len(angles)):

            curr, next_ang = angles[i], angles[(i + 1) % len(angles)]

            if next_ang < curr:

                next_ang += 360.0

            gap = next_ang - curr

            mid = (curr + next_ang) * 0.5

            candidates.append((gap, mid % 360.0))


        candidates.sort(key=lambda g: g[0], reverse=True)

        return [ang for (_gap, ang) in candidates]



    # ------------------------------------------------------------------

    # 5. Optional global post-adjustment (adjustText integration)

    # ------------------------------------------------------------------

    def refine_layout_with_adjusttext(self, enabled: bool = True) -> None:

        """

        Optionally run adjustText on all label artists that this labeler created.



        - If `adjustText` is not installed, this function quietly returns.

        - This is intended as a light final refinement on top of the

          geometry-based placement rules already implemented in this class.

        """

        if not enabled:

            return

        if not self._label_text_artists:

            return

        try:

            from adjustText import adjust_text  # type: ignore

        except Exception:

            # Library not available; skip without failing.

            return



        adjust_text(self._label_text_artists, ax=self.ax)



    def set_axis_labels(self, x_text="x", y_text="y", position='tip'):

        styled_x, prop_x = self.font_engine.style_text(x_text, category='variable')

        styled_y, prop_y = self.font_engine.style_text(y_text, category='variable')

        if position == 'center':

            self.ax.set_xlabel(styled_x, fontdict=prop_x)

            self.ax.set_ylabel(styled_y, fontdict=prop_y)

        elif position == 'tip':

            xlim, ylim = self.ax.get_xlim(), self.ax.get_ylim()

            # All axis labels (x, y, O) keep a fixed distance from

            # their nearest axis: pad = 0.1 * FONT_SCALE (data units).

            pad = 0.1 * getattr(self, "FONT_SCALE", 1.0)

            # Arrow tip positions are provided by AxisCore via private

            # attributes on the Axes. If not available, fall back to

            # the current limits.

            x_tip = getattr(self.ax, "_axiscore_x_tip", xlim[1])

            y_tip = getattr(self.ax, "_axiscore_y_tip", ylim[1])



            # Rough text sizes (in data units) so that the glyphs stay

            # within the arrow tips.

            w_x, h_x = (0.0, 0.0)

            if x_text:

                w_x, h_x = self._estimate_text_size(x_text)

            w_y, h_y = (0.0, 0.0)

            if y_text:

                w_y, h_y = self._estimate_text_size(y_text)



            # x-axis label: to the right of the tip, slightly below

            # the x-axis (y = 0).

            if x_text:

                self.ax.text(

                    x_tip - w_x / 2.0,

                    -pad,

                    styled_x,

                    fontdict=prop_x,

                    ha="center",

                    va="top",

                )



            # y-axis label: above the y-axis tip, slightly to the left

            # of the axis.

            if y_text:

                self.ax.text(

                    -pad,

                    y_tip - h_y / 2.0,

                    styled_y,

                    fontdict=prop_y,

                    ha="right",

                    va="center",

                )



            # Origin label O: always below the x-axis and, by default,

            # to the left of the y-axis. If the left position would

            # fall outside the current x-range, flip to the right.

            ox_left = -pad

            oy = -pad

            o_text, o_prop = self.font_engine.style_text("O", category="point")



            if ox_left < xlim[0]:

                ox = pad

                ha_o = "left"

            else:

                ox = ox_left

                ha_o = "right"



            self.ax.text(

                ox,

                oy,

                o_text,

                fontdict=o_prop,

                ha=ha_o,

                va="top",

            )





def _add_point_label_with_bisector(

    self,

    x,

    y,

    text,

    obstacles=None,

    neighbors=None,

    preferred_angle=None,

    manual_offset=None,

    arrow=False,

    box_props=None,

    category="point",

):

    """

    Replacement for PointLabeler.add_point_label.



    Core rule for *all* point labels (ordinary points and vertices):



    1. Determine the preferred direction.

       - If `preferred_angle` is given, use it.

       - Else, if `neighbors` are given, use the maximum empty?angle

         bisector computed from the rays (x,y)->neighbor.

       - Else, fall back to 45 degrees.

    2. Starting from distance base_offset = 0.1 * FONT_SCALE from the

       point along that direction, move the label *radially outward*

       along the same ray until we find the closest position that:

       - does not collide with existing labels / obstacles, and

       - stays inside the current axes limits.

    3. If no collision?free position is found along that ray within a

       reasonable distance, fall back to the older scanning / leader

       logic as a last resort.

    """

    if obstacles is None:

        obstacles = []

    # neighbours:

    # - If the caller explicitly provides `neighbors`, respect them.

    # - Otherwise, if a GeometryRegistry is attached, query it for

    #   automatically detected "real rays" (curves / segments passing

    #   through this point).

    # - If still nothing is available, fall back to an empty list and

    #   later to the 45-degree default direction.

    if neighbors is None:

        auto_neighbors = []

        reg = getattr(self, "geom_registry", None)

        if reg is not None:

            try:

                auto_neighbors = list(reg.get_rays_for_point(x, y))

            except Exception:

                auto_neighbors = []

        neighbors = auto_neighbors

    else:

        neighbors = list(neighbors)



    styled, prop = self.font_engine.style_text(text, category=category)

    w, h = self._estimate_text_size(text)

    b_props = box_props if box_props else self.DEFAULT_BOX_PROPS



    # ------------------------------------------------------------------

    # 1. Determine candidate directions (angles in degrees).

    # ------------------------------------------------------------------

    candidate_angles: list[float]

    if preferred_angle is not None:

        candidate_angles = [float(preferred_angle) % 360.0]

    elif neighbors:

        candidate_angles = self._get_bisector_candidates(x, y, neighbors)

    else:

        candidate_angles = [45.0]




    preferred_angle = float(candidate_angles[0]) % 360.0



    # ------------------------------------------------------------------

    # 2. Manual offset: honour as-is (used rarely for fine tuning).

    # ------------------------------------------------------------------

    use_leader = False

    if manual_offset is not None:

        best_x = x + manual_offset[0]

        best_y = y + manual_offset[1]

        angle_for_align = np.degrees(np.arctan2(manual_offset[1], manual_offset[0]))

        final_ha, final_va = self._get_alignment_from_angle(angle_for_align)



    else:

        # ------------------------------------------------------------------

        # 3. Radial search strictly along the preferred bisector.

        #

        #    Start at base_offset = 0.1 * FONT_SCALE and move outward


        # ------------------------------------------------------------------

        base_offset = 0.1 * self.FONT_SCALE

        # Upper bound for "near" placements; beyond this we fall back to

        # the older scan / leader logic.

        max_offset = max(self.SCAN_DIST_RANGE[1], base_offset)

        # Step so that we check about 6?? positions between base and max.

        n_steps = 8

        if n_steps <= 1 or max_offset <= base_offset:

            offsets = [base_offset]

        else:

            offsets = np.linspace(base_offset, max_offset, n_steps)



        theta_rad = np.radians(preferred_angle)

        dir_x, dir_y = np.cos(theta_rad), np.sin(theta_rad)

        align_ha, align_va = self._get_alignment_from_angle(preferred_angle)



        best_x = x

        best_y = y

        final_ha, final_va = align_ha, align_va

        found_along_ray = False



        for dist in offsets:

            cand_x = x + dist * dir_x

            cand_y = y + dist * dir_y

            cx, cy = self._get_center_from_alignment(

                cand_x, cand_y, w, h, align_ha, align_va

            )

            poly = self._get_rotated_poly(cx, cy, w, h, 0.0)



            if self._check_collision_all_types(poly, obstacles):

                continue

            if self._check_out_of_bounds(poly):

                continue




            best_x, best_y = cand_x, cand_y

            final_ha, final_va = align_ha, align_va

            found_along_ray = True

            break



        # ------------------------------------------------------------------

        # 4. Fallback: if even the farthest position along the bisector

        #    is not acceptable, reuse the older scan / leader logic.

        # ------------------------------------------------------------------

        if not found_along_ray:

            # Near scan in the neighbourhood of the preferred angle.

            nx, ny, cost, (scan_ha, scan_va) = self._scan_area_aligned(

                x,

                y,

                w,

                h,

                obstacles,

                preferred_angle,

                self.SCAN_DIST_RANGE,

                check_leader=False,

            )

            best_x, best_y = nx, ny

            final_ha, final_va = scan_ha, scan_va




            if cost >= self.W_OVERLAP:

                lx, ly, l_cost, (l_ha, l_va) = self._scan_area_aligned(

                    x,

                    y,

                    w,

                    h,

                    obstacles,

                    preferred_angle,

                    self.LEADER_DIST_RANGE,

                    check_leader=True,

                )

                if l_cost < cost:

                    best_x, best_y = lx, ly

                    final_ha, final_va = l_ha, l_va

                    use_leader = True



    # ----------------------------------------------------------------------

    # 5. Render: optional leader line, then text.

    # ----------------------------------------------------------------------

    if use_leader:

        pad = 0.05 * self.FONT_SCALE

        angle = np.arctan2(best_y - y, best_x - x)

        start_x = x + pad * np.cos(angle)

        start_y = y + pad * np.sin(angle)



        cx, cy = self._get_center_from_alignment(

            best_x, best_y, w, h, final_ha, final_va

        )

        end_x, end_y = self._get_box_intersection(

            start_x, start_y, cx, cy, w, h, 0.0

        )



        self.ax.plot(

            [start_x, end_x],

            [start_y, end_y],

            color="black",

            lw=self.LINE_WIDTH_LEADER,

            zorder=1,

        )



        if arrow:

            self._draw_arrowhead(start_x, start_y, angle + np.pi)



    text_artist = self.ax.text(

        best_x,

        best_y,

        styled,

        fontdict=prop,

        ha=final_ha,

        va=final_va,

        bbox=b_props,

        zorder=2,

    )

    self._label_text_artists.append(text_artist)



    cx, cy = self._get_center_from_alignment(best_x, best_y, w, h, final_ha, final_va)

    self._register_bbox(cx, cy, w, h, rotation=0)



    if self.auto_adjust:

        self.refine_layout_with_adjusttext(enabled=True)





def _add_point_label_with_bisector_v2(

    self,

    x,

    y,

    text,

    obstacles=None,

    neighbors=None,

    preferred_angle=None,

    manual_offset=None,

    arrow=False,

    box_props=None,

    category="point",

):

    """

    Revised version of PointLabeler.add_point_label that tries all

    empty?angle bisector candidates (ìµë? ë¹ê°, ê·??¤ì ë¹ê° ?? in order.

    The first collision?free position along any candidate direction is

    chosen; only if none works do we fall back to the older scan / leader

    logic.

    """

    if obstacles is None:

        obstacles = []



    # Neighbour rays:

    # - If explicit neighbours are given, respect them.

    # - Else, if a GeometryRegistry is attached, query it.

    if neighbors is None:

        auto_neighbors = []

        reg = getattr(self, "geom_registry", None)

        if reg is not None:

            try:

                auto_neighbors = list(reg.get_rays_for_point(x, y))

            except Exception:

                auto_neighbors = []

        neighbors = auto_neighbors

    else:

        neighbors = list(neighbors)



    styled, prop = self.font_engine.style_text(text, category=category)

    w, h = self._estimate_text_size(text)

    b_props = box_props if box_props else self.DEFAULT_BOX_PROPS



    # 1. Candidate directions.

    if preferred_angle is not None:

        candidate_angles = [float(preferred_angle) % 360.0]

    elif neighbors:

        candidate_angles = self._get_bisector_candidates(x, y, neighbors)

    else:

        candidate_angles = [45.0]

    preferred_angle = float(candidate_angles[0]) % 360.0



    use_leader = False



    # 2. Manual offset: honour as-is (used rarely for fine tuning).

    if manual_offset is not None:

        best_x = x + manual_offset[0]

        best_y = y + manual_offset[1]

        angle_for_align = np.degrees(np.arctan2(manual_offset[1], manual_offset[0]))

        final_ha, final_va = self._get_alignment_from_angle(angle_for_align)



    else:

        # 3. Radial search along candidate bisectors.

        base_offset = 0.1 * self.FONT_SCALE

        max_offset = max(self.SCAN_DIST_RANGE[1], base_offset)

        n_steps = 8

        if n_steps <= 1 or max_offset <= base_offset:

            offsets = [base_offset]

        else:

            offsets = np.linspace(base_offset, max_offset, n_steps)



        best_x = x

        best_y = y

        final_ha, final_va = self._get_alignment_from_angle(preferred_angle)

        found_along_ray = False

        used_angle = preferred_angle



        for angle in candidate_angles:

            theta_rad = np.radians(angle)

            dir_x, dir_y = np.cos(theta_rad), np.sin(theta_rad)

            align_ha, align_va = self._get_alignment_from_angle(angle)






            base_cx, base_cy = self._get_center_from_alignment(

                x + base_offset * dir_x,

                y + base_offset * dir_y,

                w,

                h,

                align_ha,

                align_va,

            )

            base_poly = self._get_rotated_poly(base_cx, base_cy, w, h, 0.0)

            if self._check_collision_poly(base_poly):

                continue



            for dist in offsets:

                cand_x = x + dist * dir_x

                cand_y = y + dist * dir_y

                cx, cy = self._get_center_from_alignment(

                    cand_x, cand_y, w, h, align_ha, align_va

                )

                poly = self._get_rotated_poly(cx, cy, w, h, 0.0)



                if self._check_collision_all_types(poly, obstacles):

                    continue

                if self._check_out_of_bounds(poly):

                    continue



                best_x, best_y = cand_x, cand_y

                final_ha, final_va = align_ha, align_va

                found_along_ray = True

                used_angle = angle

                break



            if found_along_ray:

                break



        preferred_angle = float(used_angle)



        # 4. Fallback: reuse the older scan / leader logic if nothing

        #    worked along any candidate ray.

        if not found_along_ray:

            nx, ny, cost, (scan_ha, scan_va) = self._scan_area_aligned(

                x,

                y,

                w,

                h,

                obstacles,

                preferred_angle,

                self.SCAN_DIST_RANGE,

                check_leader=False,

            )

            best_x, best_y = nx, ny

            final_ha, final_va = scan_ha, scan_va



            if cost >= self.W_OVERLAP:

                lx, ly, l_cost, (l_ha, l_va) = self._scan_area_aligned(

                    x,

                    y,

                    w,

                    h,

                    obstacles,

                    preferred_angle,

                    self.LEADER_DIST_RANGE,

                    check_leader=True,

                )

                if l_cost < cost:

                    best_x, best_y = lx, ly

                    final_ha, final_va = l_ha, l_va

                    use_leader = True



    # 4.5. Snap distance to axes for points lying on **actual** axes so that

    #      labels keep roughly pad = 0.1 * FONT_SCALE from the axis,

    #      similar to axis / projection labels.

    pad_axis = 0.1 * self.FONT_SCALE

    eps_axis = 1e-9

    # Detect whether real coordinate axes (with arrowheads) exist in
    # this Axes, as provided by AxisCore.
    has_x_axis = hasattr(self.ax, "_axiscore_x_tip")
    has_y_axis = hasattr(self.ax, "_axiscore_y_tip")

    # Shape labels are excluded from axis snapping; only point-like
    # labels (category != "shape") are adjusted.


    if not use_leader and category != "shape":

        # Point on x-axis: keep vertical distance ??pad_axis,

        # while allowing small horizontal shifts to avoid obstacles.

        if has_x_axis and abs(y) < eps_axis:

            dy = best_y - y


            sign = 1.0 if dy == 0.0 else np.sign(dy)

            target_y = y + sign * pad_axis




            dx_candidates = [0.0, pad_axis, -pad_axis, 2 * pad_axis, -2 * pad_axis]

            chosen = None

            for dx in dx_candidates:

                cand_x2 = best_x + dx

                cand_y2 = target_y

                cx2, cy2 = self._get_center_from_alignment(

                    cand_x2, cand_y2, w, h, final_ha, final_va

                )

                poly2 = self._get_rotated_poly(cx2, cy2, w, h, 0.0)

                if self._check_collision_all_types(poly2, obstacles):

                    continue

                if self._check_out_of_bounds(poly2):

                    continue

                chosen = (cand_x2, cand_y2)

                break

            if chosen is not None:

                best_x, best_y = chosen



        # Point on y-axis: keep horizontal distance ??pad_axis,

        # while allowing small vertical shifts.

        if has_y_axis and abs(x) < eps_axis:

            dx = best_x - x

            sign = 1.0 if dx == 0.0 else np.sign(dx)

            target_x = x + sign * pad_axis



            dy_candidates = [0.0, pad_axis, -pad_axis, 2 * pad_axis, -2 * pad_axis]

            chosen = None

            for dy in dy_candidates:

                cand_x2 = target_x

                cand_y2 = best_y + dy

                cx2, cy2 = self._get_center_from_alignment(

                    cand_x2, cand_y2, w, h, final_ha, final_va

                )

                poly2 = self._get_rotated_poly(cx2, cy2, w, h, 0.0)

                if self._check_collision_all_types(poly2, obstacles):

                    continue

                if self._check_out_of_bounds(poly2):

                    continue

                chosen = (cand_x2, cand_y2)

                break

            if chosen is not None:

                best_x, best_y = chosen



    # 5. Render leader line (optional) and text.

    if use_leader:

        pad = 0.05 * self.FONT_SCALE

        angle = np.arctan2(best_y - y, best_x - x)

        start_x = x + pad * np.cos(angle)

        start_y = y + pad * np.sin(angle)



        cx, cy = self._get_center_from_alignment(

            best_x, best_y, w, h, final_ha, final_va

        )

        end_x, end_y = self._get_box_intersection(

            start_x, start_y, cx, cy, w, h, 0.0

        )



        self.ax.plot(

            [start_x, end_x],

            [start_y, end_y],

            color="black",

            lw=self.LINE_WIDTH_LEADER,

            zorder=1,

        )



        if arrow:

            self._draw_arrowhead(start_x, start_y, angle + np.pi)



    text_artist = self.ax.text(

        best_x,

        best_y,

        styled,

        fontdict=prop,

        ha=final_ha,

        va=final_va,

        bbox=b_props,

        zorder=2,

    )

    self._label_text_artists.append(text_artist)



    cx, cy = self._get_center_from_alignment(best_x, best_y, w, h, final_ha, final_va)

    self._register_bbox(cx, cy, w, h, rotation=0)



    if self.auto_adjust:

        self.refine_layout_with_adjusttext(enabled=True)





def _clip_lines_by_label_box_for_pointlabeler(self, box):

    """

    ???¼ë²¨ ë°ì¤(box = [l, b, r, t])? êµì°¨?ë Line2Dë¥?

    \"?¼ë²¨??ê´?µíê¸??ê¹ì§ë§?" ê·¸ë¦¬?ë¡ ?ë¥¸??



    - ë°ì¤ ?´ë?ë¥??µê³¼?ë êµ¬ê°? ëª¨ë ?ê±°?ë¤.

    - ?¨ë ?¬ë¬ êµ¬ê° ì¤? ë·°í¬??ê²½ê³ë¡ë?????ë©ë¦??¨ì´ì§?

      (ì¦? ???ìª½???ì¹?? êµ¬ê° ?ëë§??¨ê¸°ê³??ë¨¸ì§???ê±°?ë¤.

    """

    l, b, r, t = map(float, box)

    if not np.all(np.isfinite([l, b, r, t])) or l >= r or b >= t:

        return



    def _inside(px, py):


        return (l < px) and (px < r) and (b < py) and (py < t)




    xlim = self.ax.get_xlim()

    ylim = self.ax.get_ylim()



    def _edge_distance(px, py):

        return min(

            px - xlim[0],

            xlim[1] - px,

            py - ylim[0],

            ylim[1] - py,

        )



    for line in list(self.ax.lines):

        xdata = np.asarray(line.get_xdata(), dtype=float)

        ydata = np.asarray(line.get_ydata(), dtype=float)

        if xdata.size < 2 or ydata.size != xdata.size:

            continue



        segments = []

        seg_x = []

        seg_y = []

        prev_end = None



        n = len(xdata)

        for i in range(n - 1):

            x1 = xdata[i]

            y1 = ydata[i]

            x2 = xdata[i + 1]

            y2 = ydata[i + 1]



            if not (

                np.isfinite(x1)

                and np.isfinite(y1)

                and np.isfinite(x2)

                and np.isfinite(y2)

            ):


                if seg_x:

                    segments.append((seg_x, seg_y))

                    seg_x, seg_y = [], []

                prev_end = None

                continue



            dx = x2 - x1

            dy = y2 - y1



            ts = []

            if dx != 0.0:


                for x_edge in (l, r):

                    t_edge = (x_edge - x1) / dx

                    if 0.0 <= t_edge <= 1.0:

                        y_edge = y1 + dy * t_edge

                        if b <= y_edge <= t:

                            ts.append(t_edge)

            if dy != 0.0:


                for y_edge in (b, t):

                    t_edge = (y_edge - y1) / dy

                    if 0.0 <= t_edge <= 1.0:

                        x_edge = x1 + dx * t_edge

                        if l <= x_edge <= r:

                            ts.append(t_edge)



            if ts:

                ts = sorted(set(ts))

            breakpoints = [0.0] + ts + [1.0]



            for j in range(len(breakpoints) - 1):

                t_start = breakpoints[j]

                t_end = breakpoints[j + 1]

                mid_t = 0.5 * (t_start + t_end)

                mid_x = x1 + dx * mid_t

                mid_y = y1 + dy * mid_t




                if _inside(mid_x, mid_y):

                    continue



                sx = x1 + dx * t_start

                sy = y1 + dy * t_start

                ex = x1 + dx * t_end

                ey = y1 + dy * t_end



                if (

                    prev_end is not None

                    and abs(prev_end[0] - sx) < 1e-9

                    and abs(prev_end[1] - sy) < 1e-9

                ):


                    seg_x.append(ex)

                    seg_y.append(ey)

                else:


                    if seg_x:

                        segments.append((seg_x, seg_y))

                    seg_x = [sx, ex]

                    seg_y = [sy, ey]

                prev_end = (ex, ey)



        if seg_x:

            segments.append((seg_x, seg_y))



        if not segments:



            if any(_inside(float(xd), float(yd)) for xd, yd in zip(xdata, ydata)):

                line.set_data([np.nan], [np.nan])

            continue





        best_seg = None

        best_score = -np.inf

        for sx_list, sy_list in segments:

            xs_arr = np.asarray(sx_list, dtype=float)

            ys_arr = np.asarray(sy_list, dtype=float)

            mask = np.isfinite(xs_arr) & np.isfinite(ys_arr)

            if not np.any(mask):

                continue

            mx = xs_arr[mask].mean()

            my = ys_arr[mask].mean()

            score = _edge_distance(mx, my)

            if score > best_score:

                best_score = score

                best_seg = (sx_list, sy_list)



        if best_seg is not None:

            line.set_data(best_seg[0], best_seg[1])





def _clip_lines_by_label_box_for_pointlabeler_v2(self, box):

    """

    ê°ì  ë²ì : ???¼ë²¨ ë°ì¤(box = [l, b, r, t])? êµì°¨?ë ê³¡ì ??

    \"?¼ë²¨??ê´?µíê¸??ê¹ì§ë§?" ê·¸ë¦¬?? ?¼ë²¨ ê¸°ì??¼ë¡ ë·°í¬??

    ê²½ê³ ìª½ì ?ë ì¡°ê°? ?ë¼?´ê³  ë°ë??????ìª½)???ë ì¡°ê°??

    ?°ì ?ì¼ë¡??¨ê¸´??

    """

    l, b, r, t = map(float, box)

    if not np.all(np.isfinite([l, b, r, t])) or l >= r or b >= t:

        return



    def _inside(px, py):


        return (l < px) and (px < r) and (b < py) and (py < t)





    xlim = self.ax.get_xlim()

    ylim = self.ax.get_ylim()

    cx = 0.5 * (l + r)

    cy = 0.5 * (b + t)



    d_left = cx - xlim[0]

    d_right = xlim[1] - cx

    d_bottom = cy - ylim[0]

    d_top = ylim[1] - cy

    d_min = min(d_left, d_right, d_bottom, d_top)



    if d_min == d_left:

        v_edge = np.array([xlim[0] - cx, 0.0])

    elif d_min == d_right:

        v_edge = np.array([xlim[1] - cx, 0.0])

    elif d_min == d_bottom:

        v_edge = np.array([0.0, ylim[0] - cy])

    else:

        v_edge = np.array([0.0, ylim[1] - cy])



    def _edge_distance(px, py):


        return min(

            px - xlim[0],

            xlim[1] - px,

            py - ylim[0],

            ylim[1] - py,

        )



    for line in list(self.ax.lines):

        xdata = np.asarray(line.get_xdata(), dtype=float)

        ydata = np.asarray(line.get_ydata(), dtype=float)

        if xdata.size < 2 or ydata.size != xdata.size:

            continue



        segments: list[tuple[list[float], list[float]]] = []

        seg_x: list[float] = []

        seg_y: list[float] = []

        prev_end = None



        n = len(xdata)

        for i in range(n - 1):

            x1 = xdata[i]

            y1 = ydata[i]

            x2 = xdata[i + 1]

            y2 = ydata[i + 1]



            if not (

                np.isfinite(x1)

                and np.isfinite(y1)

                and np.isfinite(x2)

                and np.isfinite(y2)

            ):

                if seg_x:

                    segments.append((seg_x, seg_y))

                    seg_x, seg_y = [], []

                prev_end = None

                continue



            dx = x2 - x1

            dy = y2 - y1



            ts = []

            if dx != 0.0:

                for x_edge in (l, r):

                    t_edge = (x_edge - x1) / dx

                    if 0.0 <= t_edge <= 1.0:

                        y_edge = y1 + dy * t_edge

                        if b <= y_edge <= t:

                            ts.append(t_edge)

            if dy != 0.0:

                for y_edge in (b, t):

                    t_edge = (y_edge - y1) / dy

                    if 0.0 <= t_edge <= 1.0:

                        x_edge = x1 + dx * t_edge

                        if l <= x_edge <= r:

                            ts.append(t_edge)



            if ts:

                ts = sorted(set(ts))

            breakpoints = [0.0] + ts + [1.0]



            for j in range(len(breakpoints) - 1):

                t_start = breakpoints[j]

                t_end = breakpoints[j + 1]

                mid_t = 0.5 * (t_start + t_end)

                mid_x = x1 + dx * mid_t

                mid_y = y1 + dy * mid_t



                if _inside(mid_x, mid_y):

                    continue



                sx = x1 + dx * t_start

                sy = y1 + dy * t_start

                ex = x1 + dx * t_end

                ey = y1 + dy * t_end



                if (

                    prev_end is not None

                    and abs(prev_end[0] - sx) < 1e-9

                    and abs(prev_end[1] - sy) < 1e-9

                ):

                    seg_x.append(ex)

                    seg_y.append(ey)

                else:

                    if seg_x:

                        segments.append((seg_x, seg_y))

                    seg_x = [sx, ex]

                    seg_y = [sy, ey]

                prev_end = (ex, ey)



        if seg_x:

            segments.append((seg_x, seg_y))



        if not segments:



            if any(_inside(float(xd), float(yd)) for xd, yd in zip(xdata, ydata)):

                line.set_data([np.nan], [np.nan])

            continue



        interior_best = None

        interior_best_score = float("-inf")

        boundary_best = None

        boundary_best_score = float("-inf")



        for sx_list, sy_list in segments:

            xs_arr = np.asarray(sx_list, dtype=float)

            ys_arr = np.asarray(sy_list, dtype=float)

            mask = np.isfinite(xs_arr) & np.isfinite(ys_arr)

            if not np.any(mask):

                continue

            mx = xs_arr[mask].mean()

            my = ys_arr[mask].mean()

            edge_score = _edge_distance(mx, my)





            s = (mx - cx) * v_edge[0] + (my - cy) * v_edge[1]

            if s < 0.0:

                if edge_score > interior_best_score:

                    interior_best_score = edge_score

                    interior_best = (sx_list, sy_list)

            else:

                if edge_score > boundary_best_score:

                    boundary_best_score = edge_score

                    boundary_best = (sx_list, sy_list)



        chosen_seg = interior_best if interior_best is not None else boundary_best

        if chosen_seg is not None:

            line.set_data(chosen_seg[0], chosen_seg[1])





def _vertex_label_polygon_with_bisector(self, polygon, labels):

    """

    Override for VertexLabeler.label_polygon:

    - for each vertex use the maximum empty-angle bisector determined

      by its two neighboring vertices

    - offset the label by 0.2 * FONT_SCALE along that direction and

      reuse PointLabeler.add_point_label for fine adjustment.

    """

    points = list(polygon)

    if len(points) != len(labels):

        raise ValueError("polygon ê³?labels ??ê¸¸ì´ê° ?¼ì¹?´ì¼ ?©ë??")

    if not points:

        return



    # Edges as obstacles so labels stay outside the polygon.

    edge_obstacles = []

    n = len(points)

    for i in range(n):

        x1, y1 = points[i]

        x2, y2 = points[(i + 1) % n]

        edge_obstacles.append((float(x1), float(y1), float(x2), float(y2)))



    for idx, ((x, y), text) in enumerate(zip(points, labels)):

        prev_pt = points[(idx - 1) % n]

        next_pt = points[(idx + 1) % n]

        neighbors = [

            (float(prev_pt[0]), float(prev_pt[1])),

            (float(next_pt[0]), float(next_pt[1])),

        ]



        self._point_labeler.add_point_label(

            float(x),

            float(y),

            text,

            obstacles=self._point_labeler.placed_labels_polys + edge_obstacles,

            neighbors=neighbors,

        )





# ----------------------------------------------------------------------


# ----------------------------------------------------------------------

# VertexLabeler compatibility notes:
# The legacy VertexLabeler implementation has been merged into
# PointLabeler. To keep backwards compatibility, a few helper
# methods are aliased here so existing callers continue to work.


PointLabeler._estimate_text_size = VertexLabeler._estimate_text_size

PointLabeler._draw_arrowhead = VertexLabeler._draw_arrowhead

PointLabeler._get_box_intersection = VertexLabeler._get_box_intersection

PointLabeler._line_intersection = VertexLabeler._line_intersection

PointLabeler._scan_area_aligned = VertexLabeler._scan_area_aligned

PointLabeler._check_collision_all_types = VertexLabeler._check_collision_all_types

PointLabeler._check_collision_curve_box = VertexLabeler._check_collision_curve_box

PointLabeler._check_collision_line_box = VertexLabeler._check_collision_line_box

PointLabeler._clip_lines_by_label_box = _clip_lines_by_label_box_for_pointlabeler_v2

PointLabeler._check_collision_segment = VertexLabeler._check_collision_segment

PointLabeler._segments_intersect = VertexLabeler._segments_intersect

PointLabeler._check_collision_poly = VertexLabeler._check_collision_poly

PointLabeler._check_out_of_bounds = VertexLabeler._check_out_of_bounds

PointLabeler._get_alignment_from_angle = VertexLabeler._get_alignment_from_angle

PointLabeler._get_center_from_alignment = VertexLabeler._get_center_from_alignment

PointLabeler._get_rotated_poly = VertexLabeler._get_rotated_poly

PointLabeler._register_bbox = VertexLabeler._register_bbox

PointLabeler._calculate_bisector_angle = VertexLabeler._calculate_bisector_angle

PointLabeler._get_bisector_candidates = VertexLabeler._get_bisector_candidates

PointLabeler.refine_layout_with_adjusttext = VertexLabeler.refine_layout_with_adjusttext

PointLabeler.set_axis_labels = VertexLabeler.set_axis_labels




PointLabeler.add_point_label = _add_point_label_with_bisector_v2

VertexLabeler.label_polygon = _vertex_label_polygon_with_bisector





# ----------------------------------------------------------------------

# Shape label helpers (circles, lines)

# ----------------------------------------------------------------------

def circle_shape_label(

    plabeler,

    center,

    radius,

    text,

    obstacles=None,

    box_props=None,

    category: str = "shape",

):

    """

    Helper for labeling a circle (or arc) using the global shape rule:



    - Place the label outside the circle, at a distance of

      0.1 * FONT_SCALE from the circle boundary.

    - Direction: from the viewport centre towards the circle centre,

      then extend further outwards along that ray.

    """

    if obstacles is None:

        obstacles = []



    cx, cy = float(center[0]), float(center[1])

    r = float(radius)



    ax = plabeler.ax

    xL, xR = ax.get_xlim()

    yB, yT = ax.get_ylim()

    vx = cx - 0.5 * (xL + xR)

    vy = cy - 0.5 * (yB + yT)

    if abs(vx) < 1e-9 and abs(vy) < 1e-9:

        vx, vy = 0.0, 1.0

    norm = float(np.hypot(vx, vy))

    ux, uy = vx / norm, vy / norm






    pad_pt = 0.1 * plabeler.FONT_SCALE

    pad_data = _pt_to_data_view(ax, pad_pt, "y")




    w_lbl, h_lbl = plabeler._estimate_text_size(text)

    text_rad = 0.5 * float(np.hypot(w_lbl, h_lbl))



    offset = r + pad_data + text_rad



    target_x = cx + ux * offset

    target_y = cy + uy * offset



    _add_point_label_with_bisector_v2(

        plabeler,

        cx,

        cy,

        text,

        obstacles=obstacles,

        neighbors=None,

        preferred_angle=None,

        manual_offset=(target_x - cx, target_y - cy),

        arrow=False,

        box_props=box_props,

        category=category,

    )





def line_shape_label(

    plabeler,

    p1,

    p2,

    text,

    side: str = "positive",

    obstacles=None,

    box_props=None,

    category: str = "shape",

):

    """

    Helper for labeling a straight line/segment:



    - Place the label on the extension of the line through the segment

      midpoint, at a distance of 0.1 * FONT_SCALE along the line

      direction.

    """

    if obstacles is None:

        obstacles = []



    x1, y1 = float(p1[0]), float(p1[1])

    x2, y2 = float(p2[0]), float(p2[1])

    mx, my = 0.5 * (x1 + x2), 0.5 * (y1 + y2)



    vx, vy = x2 - x1, y2 - y1

    norm = float(np.hypot(vx, vy))

    if norm == 0.0:

        _add_point_label_with_bisector_v2(

            plabeler,

            mx,

            my,

            text,

            obstacles=obstacles,

            neighbors=None,

            preferred_angle=None,

            manual_offset=None,

            arrow=False,

            box_props=box_props,

            category=category,

        )

        return



    ux, uy = vx / norm, vy / norm

    if side == "negative":

        ux, uy = -ux, -uy



    pad_pt = 0.1 * plabeler.FONT_SCALE

    pad_data = _pt_to_data_view(plabeler.ax, pad_pt, "x")

    target_x = mx + ux * pad_data

    target_y = my + uy * pad_data



    _add_point_label_with_bisector_v2(

        plabeler,

        mx,

        my,

        text,

        obstacles=obstacles,

        neighbors=None,

        preferred_angle=None,

        manual_offset=(target_x - mx, target_y - my),

        arrow=False,

        box_props=box_props,

        category=category,

    )
