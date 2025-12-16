# Mixed Plugins - 혼합 플러그인
# 여러 유형의 에셋을 조합하는 복합 문제 생성

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
