# Coordinate 3D Plugins - 3D 좌표 플러그인
# 공간좌표, 3차원 벡터 등 문제 생성

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
