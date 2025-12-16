# Solid 3D Plugins - 3D 입체도형 플러그인
# 정육면체, 원기둥, 원뿔 등 3D 입체도형 문제 생성

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
