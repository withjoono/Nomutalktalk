# Diagram 2D Plugins - 2D 다이어그램 플러그인
# 좌석 배치, 부스 배치 등 2D 다이어그램 문제 생성

# Plugins:
# - g2_j77_seating_plugin_v1_0.py: 좌석 배치 문제
# - g2_c1u03j02_j41_j42_booth_plugin_v1_0.py: 부스 배치 문제

__all__ = []

# 플러그인 자동 로드
def _try_import(module_name):
    try:
        module = __import__(module_name, globals(), locals(), ['*'], 1)
        globals().update({k: v for k, v in module.__dict__.items() if not k.startswith('_')})
        __all__.append(module_name)
        return True
    except ImportError:
        return False

_try_import('g2_j77_seating_plugin_v1_0')
_try_import('g2_c1u03j02_j41_j42_booth_plugin_v1_0')
