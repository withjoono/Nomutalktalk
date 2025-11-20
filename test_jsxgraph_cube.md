# 정육면체 JSXGraph 테스트

## 문제 1: 정육면체의 대각선

한 변의 길이가 4인 정육면체 ABCD-EFGH가 있습니다.

**질문:** 점 P는 모서리 AE의 중점이고, 점 Q는 모서리 BF의 중점입니다. 선분 PQ의 길이를 구하세요.

**답변 (jsxgraph 포함):**

정육면체를 2D로 투영하여 표현하겠습니다.

```jsxgraph
{
  "title": "정육면체 ABCD-EFGH (한 변 = 4)",
  "description": "점 P는 AE의 중점, 점 Q는 BF의 중점입니다",
  "board": {
    "boundingbox": [-2, 8, 10, -2],
    "axis": false,
    "showNavigation": true,
    "showCopyright": false,
    "pan": {
      "enabled": true
    },
    "zoom": {
      "wheel": true
    }
  },
  "elements": [
    {
      "type": "point",
      "coords": [0, 0],
      "attributes": {
        "name": "A",
        "size": 3,
        "fixed": false,
        "color": "blue"
      }
    },
    {
      "type": "point",
      "coords": [4, 0],
      "attributes": {
        "name": "B",
        "size": 3,
        "fixed": false,
        "color": "blue"
      }
    },
    {
      "type": "point",
      "coords": [5, 2],
      "attributes": {
        "name": "C",
        "size": 3,
        "fixed": false,
        "color": "blue"
      }
    },
    {
      "type": "point",
      "coords": [1, 2],
      "attributes": {
        "name": "D",
        "size": 3,
        "fixed": false,
        "color": "blue"
      }
    },
    {
      "type": "point",
      "coords": [0, 4],
      "attributes": {
        "name": "E",
        "size": 3,
        "fixed": false,
        "color": "red"
      }
    },
    {
      "type": "point",
      "coords": [4, 4],
      "attributes": {
        "name": "F",
        "size": 3,
        "fixed": false,
        "color": "red"
      }
    },
    {
      "type": "point",
      "coords": [5, 6],
      "attributes": {
        "name": "G",
        "size": 3,
        "fixed": false,
        "color": "red"
      }
    },
    {
      "type": "point",
      "coords": [1, 6],
      "attributes": {
        "name": "H",
        "size": 3,
        "fixed": false,
        "color": "red"
      }
    },
    {
      "type": "segment",
      "points": [[0, 0], [4, 0]],
      "attributes": {
        "strokeColor": "black",
        "strokeWidth": 2
      }
    },
    {
      "type": "segment",
      "points": [[4, 0], [5, 2]],
      "attributes": {
        "strokeColor": "black",
        "strokeWidth": 2
      }
    },
    {
      "type": "segment",
      "points": [[5, 2], [1, 2]],
      "attributes": {
        "strokeColor": "black",
        "strokeWidth": 2
      }
    },
    {
      "type": "segment",
      "points": [[1, 2], [0, 0]],
      "attributes": {
        "strokeColor": "black",
        "strokeWidth": 2
      }
    },
    {
      "type": "segment",
      "points": [[0, 4], [4, 4]],
      "attributes": {
        "strokeColor": "black",
        "strokeWidth": 2
      }
    },
    {
      "type": "segment",
      "points": [[4, 4], [5, 6]],
      "attributes": {
        "strokeColor": "black",
        "strokeWidth": 2
      }
    },
    {
      "type": "segment",
      "points": [[5, 6], [1, 6]],
      "attributes": {
        "strokeColor": "black",
        "strokeWidth": 2
      }
    },
    {
      "type": "segment",
      "points": [[1, 6], [0, 4]],
      "attributes": {
        "strokeColor": "black",
        "strokeWidth": 2
      }
    },
    {
      "type": "segment",
      "points": [[0, 0], [0, 4]],
      "attributes": {
        "strokeColor": "blue",
        "strokeWidth": 2
      }
    },
    {
      "type": "segment",
      "points": [[4, 0], [4, 4]],
      "attributes": {
        "strokeColor": "blue",
        "strokeWidth": 2
      }
    },
    {
      "type": "segment",
      "points": [[5, 2], [5, 6]],
      "attributes": {
        "strokeColor": "gray",
        "strokeWidth": 1,
        "dash": 2
      }
    },
    {
      "type": "segment",
      "points": [[1, 2], [1, 6]],
      "attributes": {
        "strokeColor": "gray",
        "strokeWidth": 1,
        "dash": 2
      }
    },
    {
      "type": "point",
      "coords": [0, 2],
      "attributes": {
        "name": "P",
        "size": 4,
        "color": "green",
        "fixed": false
      }
    },
    {
      "type": "point",
      "coords": [4, 2],
      "attributes": {
        "name": "Q",
        "size": 4,
        "color": "green",
        "fixed": false
      }
    },
    {
      "type": "segment",
      "points": [[0, 2], [4, 2]],
      "attributes": {
        "strokeColor": "green",
        "strokeWidth": 3,
        "name": "PQ"
      }
    }
  ]
}
```

**풀이:**

좌표계를 설정하여 계산하면:
- A(0, 0, 0), B(4, 0, 0), C(4, 4, 0), D(0, 4, 0)
- E(0, 0, 4), F(4, 0, 4), G(4, 4, 4), H(0, 4, 4)

점 P는 AE의 중점이므로: P(0, 0, 2)
점 Q는 BF의 중점이므로: Q(4, 0, 2)

따라서 PQ의 길이는:
$$|PQ| = \sqrt{(4-0)^2 + (0-0)^2 + (2-2)^2} = \sqrt{16} = 4$$

**답: 4**

---

## 문제 2: 삼각형과 원

반지름이 3인 원 위에 정삼각형이 내접합니다.

```jsxgraph
{
  "title": "원에 내접하는 정삼각형",
  "description": "반지름 3인 원에 내접하는 정삼각형",
  "board": {
    "boundingbox": [-5, 5, 5, -5],
    "axis": true,
    "showNavigation": true,
    "showCopyright": false
  },
  "elements": [
    {
      "type": "point",
      "coords": [0, 0],
      "attributes": {
        "name": "O",
        "size": 3,
        "color": "black",
        "fixed": true
      }
    },
    {
      "type": "circle",
      "params": [[0, 0], 3],
      "attributes": {
        "strokeColor": "blue",
        "strokeWidth": 2,
        "fillColor": "lightblue",
        "fillOpacity": 0.2
      }
    },
    {
      "type": "point",
      "coords": [0, 3],
      "attributes": {
        "name": "A",
        "size": 4,
        "color": "red"
      }
    },
    {
      "type": "point",
      "coords": [-2.598, -1.5],
      "attributes": {
        "name": "B",
        "size": 4,
        "color": "red"
      }
    },
    {
      "type": "point",
      "coords": [2.598, -1.5],
      "attributes": {
        "name": "C",
        "size": 4,
        "color": "red"
      }
    },
    {
      "type": "polygon",
      "points": [[0, 3], [-2.598, -1.5], [2.598, -1.5]],
      "attributes": {
        "fillColor": "yellow",
        "fillOpacity": 0.3,
        "borders": {
          "strokeColor": "red",
          "strokeWidth": 2
        }
      }
    }
  ]
}
```

정삼각형의 한 변의 길이는 $3\sqrt{3}$입니다.
