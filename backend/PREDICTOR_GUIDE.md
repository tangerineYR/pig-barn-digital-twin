# 예측 공급자 연결 안내

기존 `/api/v1/snapshot`은 C1~C4 합성 시연용으로 유지한다. 새 `POST /api/v2/predict`는 관측 이력을 받아 +30분 예측을 반환한다. 장치 명령은 보내지 않는다. React의 디지털트윈 화면에서 관측과 예측을 함께 표시한다.

통합 실행은 프로젝트 루트의 `start.cmd`를 사용한다. [로컬 실행 안내](../RUNBOOK.md)를 먼저 참고한다. 아래는 개발용 수동 실행이며 통합 실행과 동시에 실행하지 않는다.

## 실행과 확인

저장소 루트 폴더에서 실행한다. 이미 실행 중인 서버가 있다면 종료한 뒤 재실행한다.

```powershell
$env:PREDICTOR_MODE = 'mock'
.\backend\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Mock은 현재 NH₃를 +30분 예측값으로 그대로 유지하는 연결 점검용 기준선이다. 현재 시각의 값이 결측이면 `insufficient_input`을 반환한다. 예측구간은 만들지 않는다.

다른 터미널에서 같은 프로젝트 폴더를 열어 호출한다.

```powershell
$predictionBody = Get-Content -Raw -Encoding UTF8 examples/prediction-request-SYNTHETIC.json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/v2/predict' -ContentType 'application/json' -Body $predictionBody
```

예시의 00:10 현재값은 12이고, 00:40 예측은 12 ppm이다. 이 값은 **합성 입력에 대한 단순 유지 예측**이다. 예시 관측 파일의 00:40 실제값 18은 요청에 포함되지 않는다. Swagger `/docs`에서도 같은 JSON을 붙여 넣어 확인할 수 있다.

## 공급자 교체

환경변수는 서버를 실행할 터미널에서 설정한다. `.env` 파일 자동 로딩은 구현하지 않았으며, 토큰을 프론트 설정이나 저장소에 적지 않는다.

| 모드 | 서버 환경변수 | 요청의 모델 식별자 |
| --- | --- | --- |
| Mock | `PREDICTOR_MODE=mock` | `mock-persistence`, 버전 `1` |
| 저장 파일 | `PREDICTOR_MODE=file`, `PREDICTOR_FILE=examples/predictions-SYNTHETIC.json` | 파일에 기록된 모델/버전/조건과 동일 |
| 실제 API | `PREDICTOR_MODE=http`, `PREDICTOR_URL`에 정확한 POST URL | 실제 모델 계약의 모델/버전 |

HTTP의 선택 설정은 `PREDICTOR_TIMEOUT_SECONDS`(기본 5, 최대 60초), `PREDICTOR_TOKEN`(Bearer 인증)이다. 요청은 표준 JSON을 POST하고 표준 응답을 받는다. 파일의 상대 경로는 서버 실행 폴더 기준이다. 실제 출력이 다른 규격이면 모델 측의 최소 export/adapter에서 공통 계약으로 변환한다. `HttpPredictor`와 public application 계약은 모델별 형식에 종속시키지 않는다.

공급자와 모델 식별자는 별개다. File/HTTP로 Mock 결과를 전달해도 출처는 계속 `mock`이다. 학습 결과에는 `model_output`, 구간 UI 점검용 가짜 결과에는 `synthetic_fixture`를 사용한다.

## 데이터와 검증 규칙

| 파일/모듈 | 역할 |
| --- | --- |
| `schemas.py` | 공통 요청·응답·예측 파일 계약. 시각·단위·상태·구간 유효성 검사 |
| `predictors/providers.py` | Mock/File/HTTP 공급자와 응답의 요청 일치 검사 |
| `predictors/config.py` | 서버 환경변수로 공급자 선택 |
| `data_sources/observations.py` | 단일 농장·대상 관측 JSON/CSV 로드, 정렬, 기준 시각까지의 이력 추출 |
| `data_sources/legacy_replay.py` | 기존 `replay-1` 예측을 새 보관 규격으로 변환 |
| `../examples/*-SYNTHETIC.json` | 실제 학습 결과와 구분되는 형식·연결 확인용 예시 |

- 요청에 데이터셋/버전·농장·대상·조건·모델/버전·관측 출처·단위·기준 시각·이력을 담는다. +30분 이외 horizon은 이번 계약에서 받지 않는다.
- 이력 시각은 시간대를 포함하고 중복 없이 오름차순이어야 한다. 미래 관측과 `actual` 필드는 거부한다. 관측값은 비음수 유한 수 또는 null, 추가 입력 변수는 `features`에 넣는다.
- 원본 예측/구간은 음수 하한이 있더라도 보존한다. 위험 색상이나 물리적 유효성 정책은 후속 표시 단계에서 구별하며 평가 원본을 덮어쓰지 않는다.
- 구간은 하한·상한·목표 포함률·산출법을 모두 제공하거나 모두 null로 둔다. 목표 포함률은 정확도가 아니다. `generated_at`은 생성 시각을 알 수 없는 구형 파일에서 null일 수 있다.
- 파일 공급자는 농장·대상·시각·모델·단위 등의 정확한 일치로 조회한다. 새 요청 ID로 응답하되 저장된 예측값·생성 시각은 바꾸지 않는다.
- HTTP 응답의 요청 ID·모델·단위·시각 등이 다르면 실패로 처리한다. 입력 오류는 422, 서버 설정 오류는 503, 공급자 실패는 502이며 Mock으로 자동 대체하지 않는다.
- 역사 관측 시각과 네트워크 응답 시각은 별개다. 새 계약은 과거 데이터에 기존 v1의 실시간 신선도 규칙을 적용하지 않는다.

CSV는 시간·NH₃ 두 열의 명시적 매핑을 지원한다. 부가 입력 CSV 매핑은 모델 명세에 맞춰 확장하며 현재는 JSON `features`를 사용한다. 빈 값은 null, 중복·단위 추측·자동 보간은 허용하지 않는다. JSON/CSV 관측 저장소는 이 단계에서 Python 모듈로 제공하며 브라우저 업로드 API는 아직 없다.

기존 `replay-1` 변환에는 빠진 메타정보인 데이터 버전·관측 대상·모델 버전 매핑·관측 출처를 호출자가 제공해야 한다. `current`/`actual`을 임의로 하나의 관측 시계열로 합치지 않고 예측만 변환한다. 원래 파일은 기존 브라우저 사후 평가 화면에서 계속 사용할 수 있다.

## 모델 담당자에게 받을 정보

입력 변수와 단위, 입력 창 길이/샘플 간격/전처리, 모델 ID/버전과 조건, API 요청·응답 예시 또는 저장된 출력 파일, 구간 산출법·목표 포함률을 받는다. 입력 창·결측 허용 규칙을 결정하는 일은 실제 모델 명세에 따른다. 연결 코드는 마련했지만 실제 학습모델 연결·성능 검증은 아직 수행하지 않았다.

## 실제 출력 인계와 로컬 검증

우선 경로는 **모델 측 export → `PredictionArchive` → `FilePredictor`**다. 집계 MAE/RMSE/R²만으로 시각별 예측을 복원할 수 없다. 시각별 출력 또는 안정적인 API가 없으면 실제 모델 연결 검증은 보류하며 Mock 결과로 성공을 대신하지 않는다.

모델 담당자는 다음 정보를 확정해 함께 전달한다.

| 출력/메타정보 | 공통 계약으로의 매핑 |
| --- | --- |
| 데이터 버전, 농장, 관측 대상(개별 센서/명시적 공간 평균) | `dataset_id`, `dataset_version`, `farm_id`, `subject_id` |
| 실험 조건, 모델 ID와 재현 가능한 버전 | `condition_id`, `model_id`, `model_version` |
| 예측 기준 시각과 시간대, 대상 시각 | `issued_at`, `target_at = issued_at + 30분`; 시간대 추측 금지 |
| 최종 농도 예측과 단위 | `prediction`, `unit`; 변화량 출력은 모델 측에서 당시 현재값을 더해 농도로 변환 |
| 실제 학습 결과의 출처 | `prediction_source=model_output`; 관측 출처는 별도로 지정 |
| 하한·상한·목표 포함률·산출법 | `lower`, `upper`, `nominal_coverage`, `interval_method`; 미제공이면 모두 null |
| 예측 생성 시각 | `generated_at`; 확인할 수 없으면 null |
| 미래 실제값 | 예측 요청/보관 파일에 넣지 않고 별도 관측 파일의 대상 시각에 저장 |

`confidence`, 잔차 표준편차 또는 단일 분위수 상한은 그 자체로 양측 prediction interval이 아니다. 구간 메타정보를 추정하거나 임의의 구간을 만들지 않는다. 입력 창·샘플 간격·전처리·평활 여부·센서 집계 및 단위도 모델 측 manifest에 명시해야 한다.

실제 데이터와 출력은 저장소 밖 또는 Git에서 제외된 `data/`에만 둔다. 원자료·모델·실제 출력은 공개 승인을 추정해 commit하지 않는다. 공개 예시와 테스트는 합성 자료만 사용한다.

1. 시각별 결과를 `PredictionArchive.model_validate_json`으로 검증한다. `actual`을 예측 파일에 포함하면 거부된다.
2. 해당 파일로 File 공급자를 설정하고 UI의 데이터/농장/대상/조건/모델/버전을 맞춘다. 별도 관측 파일은 `twin-1` 형식으로 불러온다.
3. 기준 시각까지의 이력만 요청에 들어가는지, 반환값의 원본 값·단위·출처·구간·+30분 대상 시각이 일치하는지 확인한다.
4. Twin에서 대상 시각 직전까지 정답이 숨겨지고 도달 후 같은 시각의 관측만 공개되는지 확인한다. 잘못된 농장/대상/모델/버전/시각 요청은 오류여야 한다.
5. 조건 비교가 필요하면 별도 `replay-1` 평가 파일을 사용한다. 한 파일에는 같은 대상·전처리·구간 정책을 가진 결과만 넣고, 다른 대상이나 구간 정책은 별도 파일로 분리한다.

모델 검증 표의 R²는 `1 − SSE/SST`이며 MAE/RMSE와 동일한 공통 유효 시각을 사용한다. 표본 2개 미만 또는 정답이 일정하면 미표시하고 음수 점수는 유지한다. 예측구간 지표는 기존처럼 구간이 있는 공통 부분집합을 사용한다. Peak Recall·False Alarm/day·Lead Time은 사건 지속시간·병합·경보 임계값·경고 창·오경보/선행시간 규칙이 고정되기 전에는 구현하지 않는다.

## 검증 명령

```powershell
.\backend\.venv\Scripts\python.exe -m unittest backend.test_app backend.test_predictors backend.test_telemetry -v
npm.cmd test
```

테스트는 기존 합성 API, 미래정보 차단, 결측·구간·파일 매칭, 실제 로컬 HTTP 테스트 서버를 통한 공급자 교체, 타임아웃·잘못된 응답·CORS를 확인한다. HTTP 테스트 서버는 테스트 종료 시 닫힌다.
