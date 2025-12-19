"""font_core_v1_0
------------------
Central font and mathtext configuration: defines base font size,
roman/italic styles for points vs shapes vs numbers, and provides a
FontCore.style_text() helper used by all other core modules.
"""
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import matplotlib as mpl
import os
import re

class FontCore:
    """
    [FontCore v1.0]
    수학/과학 도면을 위한 서체 및 스타일 관리 엔진
    
    - 영문/숫자: CM Roman (Computer Modern) & Italic 적용 (Mathtext 활용)
    - 한글: 나눔고딕 (NanumGothic)
    - 기본 크기: 8pt
    - 스타일 규칙: ISO 80000-2 및 관례에 따른 정자체/이탤릭체 자동 분류
    """
    
    def __init__(self, font_size=8, korean_font_name='NanumGothic'):
        self.font_size = font_size
        self.korean_font_name = korean_font_name
        self._configure_global_settings()
        
    def _configure_global_settings(self):
        """Matplotlib 전역 폰트 설정 초기화"""
        
        plt.rcParams['font.size'] = self.font_size
        plt.rcParams['axes.labelsize'] = self.font_size
        plt.rcParams['xtick.labelsize'] = self.font_size
        plt.rcParams['ytick.labelsize'] = self.font_size
        plt.rcParams['legend.fontsize'] = self.font_size
        
        plt.rcParams['mathtext.fontset'] = 'cm'
        plt.rcParams['mathtext.rm'] = 'serif'
        
        found_korean = False
        for font in fm.fontManager.ttflist:
            if self.korean_font_name in font.name:
                plt.rcParams['font.family'] = font.name
                found_korean = True
                break
                
        if not found_korean:
            print(f"[Warning] '{self.korean_font_name}' 폰트를 찾을 수 없습니다. 시스템 기본 폰트를 사용합니다.")
            if os.name == 'nt':
                plt.rcParams['font.family'] = 'Malgun Gothic'
            elif os.name == 'posix':
                plt.rcParams['font.family'] = 'AppleGothic'

        plt.rcParams['axes.unicode_minus'] = False

    def style_text(self, text, category='auto'):
        """
        입력된 텍스트와 카테고리에 따라 CM Roman/Italic 또는 한글 폰트 스타일을 적용한 문자열 반환
        
        Args:
            text (str): 라벨링할 텍스트
            category (str): 'variable', 'number', 'unit', 'function',
                            'point', 'shape', 'korean', 'auto'
        
        Returns:
            str: Matplotlib에서 렌더링 가능한 포맷팅된 문자열 (LaTeX 문법 포함)
            dict: 폰트 속성 딕셔너리 (필요 시 fontdict 인자로 사용)
        """
        
        if category == 'korean' or (category == 'auto' and re.search('[가-힣]', str(text))):
            return text, {'family': plt.rcParams['font.family']}

        text = str(text)
        
        
        if category == 'variable' or category == 'shape':
            return f"${text}$", {} # Math mode 기본이 Italic
            
        elif category == 'number':
            return f"${text}$", {} 
            
        elif category == 'unit' or category == 'function':
            return f"$\\mathrm{{{text}}}$", {}
            
        elif category == 'point':
            return f"$\\mathrm{{{text}}}$", {}
            
        elif category == 'auto':
            if text.replace('.', '', 1).isdigit():
                return f"${text}$", {}
            elif len(text) == 1 and text.isalpha():
                return f"${text}$", {}
            elif len(text) > 1 and text.isalpha():
                return f"$\\mathrm{{{text}}}$", {}
            elif '_' in text:
                return f"${text}$", {}
            
        return text, {}

    def get_axis_label_style(self):
        """축 라벨(x, y) 등을 그릴 때 사용할 기본 스타일"""
        return {'fontsize': self.font_size}

# ==========================================
# ==========================================
if __name__ == "__main__":
    font_engine = FontCore()
    
    fig, ax = plt.subplots(figsize=(5, 3))
    
    txt, prop = font_engine.style_text("d_1", category='variable')
    ax.text(0.1, 0.8, f"Variable: {txt}", fontdict=prop)
    
    txt, prop = font_engine.style_text("10", category='number')
    ax.text(0.1, 0.6, f"Number: {txt}", fontdict=prop)
    
    txt, prop = font_engine.style_text("cm", category='unit')
    ax.text(0.1, 0.4, f"Unit: {txt}", fontdict=prop)
    
    txt, prop = font_engine.style_text("A", category='point')
    ax.text(0.1, 0.2, f"Point: {txt}", fontdict=prop)
    
    txt, prop = font_engine.style_text("길이", category='korean')
    ax.text(0.5, 0.5, f"Korean: {txt}", fontdict=prop)

    ax.set_title("FontCore v1.0 Rendering Test")
    plt.show()
