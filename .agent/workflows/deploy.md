---
description: NomuTalk 백엔드 App Engine 배포
---

# NomuTalk 백엔드 배포

> [!CAUTION]
> 이 프로젝트는 반드시 아래 설정으로만 배포해야 합니다.

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| GCP 프로젝트 | `nomutalk-889bd` |
| GCP 계정 | `sws12q@gmail.com` |
| App Engine URL | `https://nomutalk-889bd.du.r.appspot.com` |
| Cloud SQL | `nomutalk-889bd:asia-northeast3:nomutalk-db` |
| DB 이름 | `nomutalk` |
| DB 사용자 | `nomutalk_user` |

## 배포 절차

// turbo-all

1. gcloud 계정/프로젝트 설정 확인
```
gcloud config list --format="value(core.account,core.project)"
```

2. 계정이 `sws12q@gmail.com` / 프로젝트가 `nomutalk-889bd`가 아니면 설정
```
gcloud config set account sws12q@gmail.com
gcloud config set project nomutalk-889bd
```

3. 배포 실행
```
gcloud app deploy app.yaml --project=nomutalk-889bd --quiet
```

## ⚠️ 절대 하면 안 되는 것

- `app.yaml`의 `DATABASE_URL`이나 `cloud_sql_instances`를 `legaltech-490706`으로 변경하지 않기
- `withjoono@gmail.com`이나 `geobukacademy@gmail.com` 계정으로 배포하지 않기
- `gcloud config set`으로 다른 프로젝트 계정을 이 터미널에 설정하지 않기
