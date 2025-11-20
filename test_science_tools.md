# 과학 시각화 도구 통합 테스트

이 문서는 통합된 모든 과학 시각화 라이브러리를 테스트합니다.

---

## 🧪 화학 (Chemistry)

### 3Dmol.js - 분자 구조 시각화

**문제**: 물 분자(H₂O)의 3D 구조를 보여주세요.

**답변**:

```mol3d
{
  "moleculeData": "3\nWater molecule\nO 0.0 0.0 0.0\nH 0.757 0.586 0.0\nH -0.757 0.586 0.0",
  "format": "xyz",
  "style": {
    "stick": {},
    "sphere": {"radius": 0.3}
  },
  "viewStyle": {
    "backgroundColor": "white"
  },
  "width": 400,
  "height": 400
}
```

---

## ⚛️ 물리 (Physics)

### Matter.js - 2D 물리 시뮬레이션

**문제**: 자유낙하 운동을 시뮬레이션하세요.

**답변**:

```matter
{
  "width": 800,
  "height": 600,
  "bodies": [
    {
      "type": "rectangle",
      "x": 400,
      "y": 0,
      "width": 80,
      "height": 80,
      "options": {
        "restitution": 0.8,
        "render": {
          "fillStyle": "red"
        }
      }
    },
    {
      "type": "rectangle",
      "x": 400,
      "y": 580,
      "width": 810,
      "height": 60,
      "options": {
        "isStatic": true,
        "render": {
          "fillStyle": "green"
        }
      }
    }
  ],
  "gravity": {
    "x": 0,
    "y": 1
  }
}
```

### p5.js - 원 운동 시뮬레이션

**문제**: 원 운동을 그려주세요.

**답변**:

```p5
{
  "width": 400,
  "height": 400,
  "setup": "function setup() { createCanvas(400, 400); }",
  "draw": "function draw() { background(220); translate(200, 200); let angle = frameCount * 0.05; let x = cos(angle) * 100; let y = sin(angle) * 100; fill(255, 0, 0); ellipse(x, y, 30, 30); stroke(0); line(0, 0, x, y); }"
}
```

---

## 🧬 생물 (Biology)

### Cytoscape.js - 생물학적 네트워크

**문제**: 간단한 대사 경로를 보여주세요.

**답변**:

```cytoscape
{
  "container": "cy",
  "elements": [
    {"data": {"id": "glucose", "label": "포도당"}},
    {"data": {"id": "g6p", "label": "G6P"}},
    {"data": {"id": "f6p", "label": "F6P"}},
    {"data": {"id": "pyruvate", "label": "피루브산"}},
    {"data": {"source": "glucose", "target": "g6p"}},
    {"data": {"source": "g6p", "target": "f6p"}},
    {"data": {"source": "f6p", "target": "pyruvate"}}
  ],
  "style": [
    {
      "selector": "node",
      "style": {
        "background-color": "#66ccff",
        "label": "data(label)",
        "text-valign": "center",
        "color": "#000",
        "font-size": "12px"
      }
    },
    {
      "selector": "edge",
      "style": {
        "width": 3,
        "line-color": "#ccc",
        "target-arrow-color": "#ccc",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier"
      }
    }
  ],
  "layout": {
    "name": "circle"
  }
}
```

---

## 🌍 지구과학 (Earth Science)

### Leaflet - 지도 시각화

**문제**: 서울의 위치를 지도에 표시하세요.

**답변**:

```leaflet
{
  "center": [37.5665, 126.9780],
  "zoom": 12,
  "markers": [
    {
      "position": [37.5665, 126.9780],
      "popup": "서울특별시청"
    },
    {
      "position": [37.5796, 126.9770],
      "popup": "경복궁"
    }
  ],
  "width": "100%",
  "height": "400px"
}
```

---

## 🔬 일반 과학 (General Science)

### Three.js - 3D 시각화

**문제**: 회전하는 큐브를 그려주세요.

**답변**:

```threejs
{
  "width": 400,
  "height": 400,
  "scene": {
    "background": "0x222222"
  },
  "camera": {
    "position": {"x": 0, "y": 0, "z": 5}
  },
  "objects": [
    {
      "type": "box",
      "geometry": {"width": 2, "height": 2, "depth": 2},
      "material": {"color": "0x00ff00"},
      "position": {"x": 0, "y": 0, "z": 0},
      "rotation": {"x": 0, "y": 0, "z": 0},
      "animate": {
        "rotation": {"x": 0.01, "y": 0.01}
      }
    }
  ],
  "lights": [
    {
      "type": "ambient",
      "color": "0x404040"
    },
    {
      "type": "directional",
      "color": "0xffffff",
      "position": {"x": 1, "y": 1, "z": 1}
    }
  ]
}
```

---

## 테스트 방법

1. 이 파일을 Google File Search RAG 시스템에 업로드하세요
2. 각 과학 분야의 질문을 던지세요
3. AI가 적절한 시각화 코드를 생성하는지 확인하세요

## 지원하는 코드 블록 형식

- ````mol3d` - 3Dmol.js (분자 구조)
- ````matter` - Matter.js (2D 물리)
- ````p5` - p5.js (크리에이티브 코딩)
- ````cytoscape` - Cytoscape.js (네트워크 그래프)
- ````leaflet` - Leaflet (지도)
- ````cesium` - Cesium (3D 지구본)
- ````threejs` - Three.js (3D 그래픽)
