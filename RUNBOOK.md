# 로컬 실행 안내

이 프로젝트는 Windows, Python 3.12, Node.js 22 환경을 기준으로 구성했습니다. GitHub 소스에서 처음 실행할 때는 프론트엔드 빌드를 위해 Node.js가 필요하며, 빌드된 화면을 실행할 때는 Python 환경을 사용합니다. 서버는 로컬 주소에서만 실행되며 실제 장치를 제어하지 않습니다.

## 설치가 완료된 환경에서 실행

프로젝트 폴더에서 PowerShell을 열고 실행합니다.

```powershell
.\start.cmd
```

`READY`가 표시되면 [디지털트윈](http://127.0.0.1:4173)을 엽니다. 실행한 터미널은 유지합니다. 서버는 현재 PC의 127.0.0.1에만 열립니다.

실행 명령은 `.\start.cmd`이며 끝에 `\`를 붙이지 않습니다. API 준비 대기는 기본 90초이고 10초마다 진행 상황을 출력합니다. 로딩이 느린 PC에서는 `.\start.cmd --startup-timeout 180`으로 늘릴 수 있습니다(5~600초). 이 값은 모델 추론 제한 시간이 아니라 서버 시작 대기 시간입니다.

### API 시작 시간 초과 또는 빈 로그

실행 관리자는 API 서버용 Python 프로세스를 시작하기 전에 `.runtime/api.log`에 실행 경로와 서버 시작 대기 제한 시간을 기록합니다. API 서버 프로세스는 출력 버퍼링 없이 Python 실행 → Uvicorn 모듈 로드 → FastAPI 애플리케이션 로드 → 서버 준비 과정을 순서대로 기록합니다. 서버 준비가 30초 이상 지연되면 Python 호출 스택을 로그에 남겨 지연 원인을 확인할 수 있도록 합니다. 이전 실행 로그는 `.runtime/api.previous.log`에 보존합니다.

- 실행 관리자의 시작 정보만 기록되고 API 서버의 실행 단계 로그가 없다면, API 서버용 Python 프로세스가 정상적으로 시작되지 않았거나 초기 실행 단계에서 문제가 발생했을 가능성이 있습니다.
- `importing ...`에서 멈추면 해당 라이브러리 또는 앱 로딩 중인 것입니다. 이어지는 진단 내용을 확인합니다.
- `Application and listener ready`가 있는데 시간 초과라면 로컬 HTTP 연결을 확인합니다. 실행기의 로컬 확인은 프록시를 사용하지 않습니다.
- API 서버 프로세스가 예상치 못하게 종료되면 실행 관리자가 종료 코드와 로그 경로를 오류 메시지에 표시합니다. `.runtime/api.log`의 마지막 오류 메시지와 함께 종료 원인을 확인하세요.

로그를 직접 확인할 명령은 `type .runtime\api.log`입니다. 로그가 여전히 0바이트라면 수정된 실행기를 사용하고 있는지 경로부터 확인합니다. 같은 경로의 로그를 읽으면서 여러 실행기를 동시에 시작하지 않습니다. 서버 시작에 실패하더라도 실행 관리자는 자신이 시작한 API 서버 프로세스만 종료합니다.

- 디지털트윈 → **예측 API 연결**: 기본 Mock 모델로 시작합니다. 데이터는 합성 예시이며 예측은 현재값 유지 기준선입니다.
- 시간 막대 30분으로 이동 → 시계열 분석: 00:00의 예측 10과 00:30 실제 24, 절대오차 14를 확인합니다.
- 모델 검증: 예측 파일 업로드 후 농장·조건·평가 기간을 선택합니다.
- 제어 시나리오: C1~C4 합성 실험을 실행합니다. 실제 장치에 명령을 보내지 않습니다.

다른 터미널에서 아래 명령을 실행합니다.

```powershell
.\status.cmd
.\stop.cmd
```

시작 터미널의 `Ctrl+C`로도 종료할 수 있습니다. 정상 종료 시 실행 관리자는 자신이 시작한 API 서버 프로세스만 종료합니다. 다른 서버가 8000/4173을 사용 중이면 시작을 거부하므로 기존 서버를 사용자가 확인한 뒤 종료합니다. 이미 실행 중인 서버를 자동으로 강제 종료하지 않습니다.

## 다른 PC에 설치

**GitHub 소스에서 실행**: 공개 저장소를 clone하거나 Code → Download ZIP으로 내려받습니다. Windows에 Python 3.12와 Node.js 22를 설치한 뒤 프로젝트 루트에서 `.\setup.cmd`를 실행하고, 설치가 완료되면 `.\start.cmd`로 시작합니다. dist/는 Git에 포함하지 않으므로 최초 실행 시 빌드가 필요합니다.

아래 절차는 `scripts/package_release.py`로 만든 **dist 포함 전달용 ZIP**에만 해당합니다.

압축을 풀고 `barn-simulator` 폴더에서 Python 3.12가 설치되어 있는지 확인합니다. 최초 설치에는 인터넷이 필요합니다. Node 22는 소스 수정·재빌드 시에만 필요합니다.

```powershell
py -3.12 -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-lock.txt
.\start.cmd
```

압축본에는 완성된 `dist`가 들어 있으므로 화면 실행에 Node 패키지 설치는 필요 없습니다. 소스를 수정하거나 다시 빌드할 때만 다음 명령을 실행합니다.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
```

기존 서버를 종료하고 다시 시작한 뒤 브라우저를 새로고침합니다. 가상환경은 PC 사이에 복사하지 않고 각 PC에서 설치합니다. 새 PC의 의존성 설치 자체는 별도 환경에서 검증하지 않았습니다.

## 모델 공급자 변경

```powershell
.\stop.cmd
.\start.cmd --config launcher.local.json
```

`launcher.http.example.json` 또는 `launcher.file.example.json`을 `launcher.local.json`으로 복사해 수정합니다. 토큰은 JSON에 넣지 않고 시작 터미널의 `PREDICTOR_TOKEN` 환경변수로 전달합니다. 실행기는 `.env`를 자동 로딩하지 않습니다. UI의 모델 ID/버전/조건도 제공 모델과 맞춥니다. HTTP 예시 주소 9000에는 실제 모델 서버를 별도로 실행해야 합니다.

화면의 API 주소는 항상 FastAPI `http://127.0.0.1:8000`을 가리킵니다. 모델 서버 주소는 서버 설정에만 넣습니다. 기본 UI 제한 시간은 8초이므로 이 실행기는 모델 서버 제한 시간을 최대 6초로 받습니다. 장시간 추론은 최적화 또는 별도의 비동기 계약 설계가 필요합니다.

File 예시는 계약 확인용이며 기본 3D 예시와 대상 ID·기준 시각이 다를 수 있습니다. 정확히 일치하는 저장 예측이 없으면 오류로 표시합니다. 자동으로 Mock으로 대체하지 않습니다.

## 문제 확인

| 상황 | 조치 |
| --- | --- |
| 8000/4173 사용 중 | 기존 개발 서버 또는 이전 시작 터미널 확인. 이 실행기가 만든 세션이면 stop.cmd |
| Python 환경 없음 | 위 최초 설치 절차 실행 |
| dist 없음 | npm ci, npm run build |
| API 시작 실패 | `.runtime/api.log` 확인 |
| 재부팅 후 오래된 세션 파일 | start.cmd로 새로 시작. stop/status가 연결 실패해도 타 프로세스는 종료하지 않음 |
| 예측 미수신 | API 주소·모델 ID·버전·조건·입력 데이터 확인 후 실패 예측 재시도 |
| 화면에 이전 버전 표시 | 서버 재시작 후 새로고침. 현재 화면은 서비스 워커를 사용하지 않음 |

실행 관리자를 강제로 종료하면 별도로 실행된 API 서버 프로세스가 남아 있을 수 있습니다. 정상 종료 시에는 `stop.cmd` 또는 `Ctrl+C`를 사용하세요. 이 애플리케이션은 Windows 서비스나 자동 시작 작업으로 등록되지 않으며, 사용자가 직접 실행하고 종료하는 로컬 프로그램입니다.

## 패키지 검증

```powershell
.\backend\.venv\Scripts\python.exe -m unittest backend.test_app backend.test_predictors backend.test_telemetry -v
.\backend\.venv\Scripts\python.exe scripts\package_release.py
```

패키지 생성 스크립트는 `deliverables/pig-barn-digital-twin-release.zip`을 생성합니다. ZIP에는 빌드된 프론트엔드, 백엔드 실행 코드, 예제 및 문서와 SHA-256 파일 목록(`MANIFEST.sha256.json`)이 포함됩니다. 배포 전에는 ZIP의 전체 파일 목록을 검사하여 로컬 설정, 인증 정보 또는 비공개 데이터가 포함되지 않았는지 확인해야 합니다.
