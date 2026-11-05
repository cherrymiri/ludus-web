# LUDUS — 가벼운 장난과 설렘을 즐기는 사랑

〈When Love Responds, 사랑의 응답〉 두 번째 작품 **LUDUS**의 인터랙티브 웹사이트입니다.
Three.js + Vite로 제작되었으며, EROS와 완전히 분리된 독립 프로젝트입니다.

## 실행

```bash
npm install
npm run dev       # 로컬 개발 서버 (http://localhost:5173)
npm run build     # 배포용 빌드 → dist/
npm run preview   # 빌드 결과 확인
```

Node.js 20.19 이상이 필요합니다.

## 조작

| 입력 | PC | 모바일 |
| --- | --- | --- |
| 좌우 이동 | 마우스 이동 | 화면을 좌우로 드래그 |
| 상하 이동 | 휠 ↓ / 휠 ↑ (페이지는 스크롤되지 않음) | 오른쪽 세로 슬라이더 |
| 잡기 / 놓기 | 좌클릭 (토글) | 하단 잡기 버튼 (토글) |

처음에는 대기 화면입니다. **시작하기**를 눌러야 60초 카운트다운이 시작되고 집게를 조작할 수 있습니다.

- 60초 안에 공을 성공선 위까지 들어 올리면 → "Okay, you win!" (타이머는 그 순간 멈춤)
- 시간이 끝나면 → 집게가 공을 놓고, 공이 통통 튀며 "Missed me!"
- 어느 쪽이든 "다시 잡아볼래?"를 누르면 새로고침 없이 대기 화면으로 돌아가며, 다시 **시작하기**를 눌러야 타이머가 시작됩니다.

상태: 대기(idle) → 플레이(play) → 성공(won) / 실패(missed) → 대기. 결과는 한 번만 확정되고 바뀌지 않습니다.

**두 번째 기회** — "Missed me!" 다음 판은 남은 시간에 따라 조용히 쉬워지고 반드시 성공으로 끝납니다.
- 60–31초: 잘 잡히고 덜 미끄러지며, 중심이 조금 어긋나도 잡힘 (그래도 튕겨 나갈 수 있음)
- 30–16초: 제대로 잡은 공은 떨어지지 않고, 미끄러지던 공도 다시 붙잡힘. 내려온 집게 쪽으로 공이 살짝 굴러감
- 11초: 아직 못 잡았다면 공이 통통 뛰어 집게 아래로 오고, 집게가 내려와 잡아 올림 (9초: 잡고만 있으면 집게가 들어 올림)
- 6.2초 / 5초: 비상 보조 (시뮬레이션에서는 도달하지 않음)

이 판을 이긴 뒤(또는 첫 판에서 이긴 뒤, 새로고침 시) 다시 일반 난이도로 시작합니다.

## 배포 (GitHub → Vercel)

1. GitHub에 새 저장소(예: `ludus`)를 만들고 이 폴더를 올립니다.
   ```bash
   git init
   git add .
   git commit -m "LUDUS interactive site"
   git branch -M main
   git remote add origin https://github.com/<아이디>/ludus.git
   git push -u origin main
   ```
2. [vercel.com](https://vercel.com) → **Add New… → Project** → 위 저장소를 Import.
3. Framework Preset이 **Vite**로 자동 인식됩니다. (Build Command `npm run build`, Output Directory `dist` — 그대로 두면 됩니다.)
4. **Deploy**를 누르면 상시 접속 가능한 URL이 생성됩니다. 이후 `main` 브랜치에 push할 때마다 자동으로 재배포됩니다.

EROS 프로젝트와는 별도의 Vercel 프로젝트로 생성하세요.

## 폴더 구조

```
public/models/ludus.glb   Blender에서 내보낸 모델 (집게 + 공, 계층·피벗·재질 이름 유지)
src/config.js             ★ 확률·속도·물성·성공선 높이 등 모든 조정값
src/claw.js               집게 이동, 실제 관절 기준 팔 회전, 팔-공 접촉 계산
src/ball.js               공의 메시 변형(눌림·부피 보존·젤리 흔들림) + 낙하/바운드 물리
src/game.js               잡기 판정, 4가지 결과(A–D), 미끄러짐, 성공 판정, 연속 실패 보정
src/materials.js          크롬 / 새틴 팁 / 젤 공(볼륨 셰이더 + 광택 스킨)
src/stage.js              카메라, 스튜디오 반사 환경, 조명
src/hud.js                성공선, 결과 화면(Okay, you win! / Missed me!) 연출
src/timer.js              60초 카운트다운 표시와 맥동 효과
src/input.js, touch.js    마우스 입력 / 모바일 드래그·슬라이더·잡기 버튼
tools/export_glb.py       .blend → GLB 변환 스크립트 (원본 .blend는 수정하지 않음)
```

## 자주 바꿀 설정 (`src/config.js`)

난이도
- `OUTCOMES` — 잡힌 뒤 결과 확률 (튕겨 나감 34% / 들어 올리다 미끄러짐 30% / 성공선 근처 낙하 26% / 성공 10%)
- `PITY` — 연속 실패 시 성공 확률을 점차 올리는 규칙 (4번 실패 후부터, 최대 32%)
- `ALIGNMENT_INFLUENCE`, `GRIP.centreTolerance` — 중심을 얼마나 정확히 맞춰야 잡히는지
- `HOLD` — 잡힌 공이 흔들리고 처지는 정도
- `VARIATION` — 미끄러지는 높이·시간, 튕기는 속도·방향의 랜덤 범위

성공
- `SUCCESS.lineY` — 성공선 높이 (공 전체가 이 선 위로 올라가야 성공)
- `SUCCESS.textDelay`, `SUCCESS.buttonDelay` — 문구·버튼이 나타나는 시점

공 재질
- `ORB.density` — 전체 젤리 밀도 (낮을수록 투명)
- `ORB.clearCore` — 중심부 투명도 (높을수록 가운데가 맑음)
- `ORB.rimGlow` — 가장자리 민트·아이스블루 밝기

제한시간 (`TIMER`, `MISS`)
- `TIMER.duration` — 제한시간(초, 실제 시계 기준)
- `TIMER.pulseFrom`, `TIMER.urgentFrom` — 은은한 맥동(15초), 빠른 맥동(5초)이 시작되는 시점
- `MISS.hops` — 시간 초과 후 공이 놀리듯 튀는 높이(속도)와 횟수
- `MISS.textDelay`, `MISS.buttonDelay` — "Missed me!"와 버튼이 나타나는 시점

두 번째 기회 (`ASSIST`)
- `ASSIST.tier1` — 60–31초 구간의 결과 확률
- `ASSIST.tolerance`, `ASSIST.magnet` — 구간별 중심 허용 오차, 공이 집게 쪽으로 굴러가는 정도
- `ASSIST.autoAt`, `ASSIST.autoLiftAt`, `ASSIST.rescueAt`, `ASSIST.guaranteeBy` — 자동 보조 시점

움직임 / 화면
- `CLAW` — 집게 반응 속도, 휠 감도, 이동 범위
- `BALL` — 중력, 바운드 탄성, 굴러가는 마찰
- `PLAYFIELD` — 가로 화면 / 세로(모바일) 화면의 이동 범위

## 모델 다시 내보내기

Blender 4.2 이상에서 모델을 수정했다면:

```bash
blender -b 재질.blend --python tools/export_glb.py -- 재질.blend public/models/ludus.glb
```

이 스크립트는 `LUDUS` 계층(집게·와이어·팔 3개·공)만 GLB로 내보내고, 웹 접촉 계산에 쓰는
팔 중심선 좌표를 `collision_pts`(extras)로 함께 저장합니다.
