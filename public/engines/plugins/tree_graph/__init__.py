# Tree Graph Plugins - 트리/그래프 플러그인
# 트리 경로, 그래프 탐색 등 문제 생성

# Plugins:
# - g3_c1u03j07_treepaths_plugin_v1_0.py: 트리 경로 문제

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

_try_import('g3_c1u03j07_treepaths_plugin_v1_0')
