"""
core package v1.0
-----------------

Thin wrapper package that re-exports the existing engine core modules
so that plugins can import them via ``core.*`` without worrying about
their physical location.
"""

from .rc_core_v1_0 import *  # noqa: F401,F403
from .font_core_v1_0 import *  # noqa: F401,F403
from .label_core_v1_0 import *  # noqa: F401,F403
from .dim_core_v1_0 import *  # noqa: F401,F403
from .angle_core_v1_0 import *  # noqa: F401,F403
from .axis_core_v1_0 import *  # noqa: F401,F403
from .view_core_v1_0 import *  # noqa: F401,F403
from .region_core_v1_0 import *  # noqa: F401,F403

