# Problem Studio Plugins Package
# 문제 출제 스튜디오 플러그인 패키지
#
# 플러그인 카테고리:
# - no_asset: 에셋 없는 텍스트 전용 문제
# - diagram_2d: 2D 다이어그램 (좌석, 부스 배치 등)
# - geometry_2d: 2D 기하학 (영역, 도형 등)
# - graph_2d: 2D 그래프 (함수, 좌표평면 등)
# - numberline_1d: 1D 수직선
# - table: 표, 행렬
# - chart_stat: 차트, 통계
# - tree_graph: 트리, 그래프
# - network_flow: 네트워크 흐름
# - solid_3d: 3D 입체도형
# - net_unfold: 전개도
# - coordinate_3d: 3D 좌표
# - mixed: 복합/혼합

from . import no_asset
from . import diagram_2d
from . import geometry_2d
from . import graph_2d
from . import numberline_1d
from . import table
from . import chart_stat
from . import tree_graph
from . import network_flow
from . import solid_3d
from . import net_unfold
from . import coordinate_3d
from . import mixed

__all__ = [
    'no_asset',
    'diagram_2d',
    'geometry_2d',
    'graph_2d',
    'numberline_1d',
    'table',
    'chart_stat',
    'tree_graph',
    'network_flow',
    'solid_3d',
    'net_unfold',
    'coordinate_3d',
    'mixed'
]
