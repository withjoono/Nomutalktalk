# Geometry 2D Plugins - 2D 기하학 플러그인
# 영역, 문/통로 등 기하학적 문제 생성

# Plugins:
# - g2_c1u03j06_regions_plugin_v1_0.py: 영역 분할 문제
# - g2_c1u03j02_j39_doors_plugin_v1_0.py: 문/통로 문제

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

_try_import('g2_c1u03j06_regions_plugin_v1_0')
_try_import('g2_c1u03j02_j39_doors_plugin_v1_0')
