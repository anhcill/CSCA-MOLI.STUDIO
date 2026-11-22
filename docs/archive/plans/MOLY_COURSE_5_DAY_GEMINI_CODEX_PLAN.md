# Ke hoach 5 ngay lien ket Moly Studio va CSCA-Course

## 0. Duong dan hai du an

### Du an 1 - Moly Studio

```text
C:\Users\ducan\Documents\Codex\2026-07-13\new-chat\CSCA-MOLI.STUDIO
```

Thu muc chinh can lam viec:

```text
C:\Users\ducan\Documents\Codex\2026-07-13\new-chat\CSCA-MOLI.STUDIO\backend
C:\Users\ducan\Documents\Codex\2026-07-13\new-chat\CSCA-MOLI.STUDIO\frontend
C:\Users\ducan\Documents\Codex\2026-07-13\new-chat\CSCA-MOLI.STUDIO\database
```

Railway project hien tai:

```text
Project: csca moly
Environment: production
App service: CSCA-MOLI.STUDIO
Database service: Postgres
```

### Du an 2 - CSCA-Course

```text
C:\Users\ducan\Documents\Codex\2026-07-24\anhcill-csca-interview-git-https-github\CSCA-Course
```

Ma nguon ung dung chinh nam trong:

```text
C:\Users\ducan\Documents\Codex\2026-07-24\anhcill-csca-interview-git-https-github\CSCA-Course\WebsiteReactVCK-master
```

Thu muc chinh can lam viec:

```text
C:\Users\ducan\Documents\Codex\2026-07-24\anhcill-csca-interview-git-https-github\CSCA-Course\WebsiteReactVCK-master\backend
C:\Users\ducan\Documents\Codex\2026-07-24\anhcill-csca-interview-git-https-github\CSCA-Course\WebsiteReactVCK-master\frontend
C:\Users\ducan\Documents\Codex\2026-07-24\anhcill-csca-interview-git-https-github\CSCA-Course\WebsiteReactVCK-master\database
```

Railway project hien tai:

```text
Project: csca-course-lms
Environment: production
Web service: csca-course-web
Worker service: csca-course-sync-worker
Database service: Postgres
```

### Quy tac bat buoc khi lam tren hai repo

- Gemini phai kiem tra `Get-Location` hoac `pwd` truoc khi sua file.
- Moi handoff note phai ghi ro file thuoc repo Moly hay repo CSCA-Course.
- Khong chay migration cua Moly tren database CSCA-Course va nguoc lai.
- Khong copy file `.env`, Railway secret, JWT secret hoac database URL giua hai repo.
- Khi mot thay doi can sua ca hai repo, phai tao commit rieng trong tung repo.
- Codex phai review `git diff` va chay test rieng tai tung duong dan truoc khi nghiem thu.

## 1. Muc tieu

Xay dung MVP lien ket quyen hoc video giua hai he thong:

- User da co quyen ben CSCA-Course se duoc Moly ghi nhan la da so huu, khong bi ban trung.
- User mua khoa hoc tren Moly se duoc cap day du quyen hoc ben CSCA-Course.
- User co the di chuyen giua hai website bang SSO one-time code.
- Ho tro cap quyen, thu hoi, het han, refund, retry va reconciliation.
- Khong chia se password, cookie, JWT secret hoac ket noi ghi truc tiep giua hai database.

Phan cong tong quat:

- **Gemini:** lam implementation dau tien, viet migration, API, worker, UI va test co ban.
- **Codex:** lam sau Gemini, review diff, kiem tra SQL, bao mat, transaction, chay test, sua loi va nghiem thu.

## 2. Pham vi 5 ngay

### Trong pham vi

- Identity mapping giua Moly va CSCA-Course.
- Course mapping giua hai he thong.
- Entitlement inheritance hai chieu.
- Moly payment thanh cong thi cap quyen tren Course.
- Course user da co quyen thi Moly hien thi `Da so huu`.
- SSO one-time code giua hai domain.
- Retry, dead-letter, audit log va reconciliation.

### Ngoai pham vi

- Khong dong bo file video, lesson content hoac learning progress.
- Khong dung chung database, password hash hoac JWT secret.
- Khong tu dong merge tai khoan bi xung dot.
- Khong bat `CSCA_VIDEO_COMMERCE_SALES_ENABLED=true` tren production trong 5 ngay.
- Khong deploy production neu chua co phe duyet cua chu du an.

## 3. Quy trinh lam viec Gemini -> Codex

Moi ngay bat buoc theo thu tu:

1. Gemini trien khai phan viec trong ngay.
2. Gemini chay test lien quan.
3. Gemini commit rieng va ghi handoff note.
4. Codex review toan bo diff cua Gemini.
5. Codex chay lai test, test them cac tinh huong loi va bao mat.
6. Codex sua loi bang commit rieng.
7. Chi chuyen sang ngay tiep theo khi dat tieu chi nghiem thu.

Quy uoc commit:

```text
feat(gemini): ...
test(gemini): ...
docs(gemini): ...
review(codex): ...
fix(codex): ...
test(codex): ...
```

Gemini va Codex khong sua cung mot file tai cung thoi diem. Gemini phai commit hoac dung cong viec truoc khi Codex bat dau review.

## 4. Handoff note Gemini phai ghi moi ngay

```markdown
## Gemini handoff - Day N

### Da lam
- ...

### File da thay doi
- ...

### Migration
- ...

### Test da chay
- Lenh:
- Ket qua:

### Bien moi truong moi
- Chi ghi ten bien, khong ghi gia tri secret.

### Gia dinh va phan chua lam
- ...

### Commit
- <commit SHA>
```

---

# Ngay 1 - Contract, identity mapping va database

## Gemini lam

### 1. Viet integration contract

Tao tai lieu `MOLY_COURSE_INTEGRATION_CONTRACT.md`, trong do dinh nghia:

- `source_system`
- `external_user_id`
- `external_course_id`
- `external_grant_id`
- `event_id`
- `idempotency_key`
- `correlation_id`
- `source_updated_at`
- Cac trang thai `active`, `revoked`, `expired`, `suspended`.

Viet JSON contract mau cho:

- Provision/link user.
- Grant entitlement.
- Revoke entitlement.
- Course ownership query.
- Identity conflict.

### 2. Viet migration additive

Du kien tao cac bang:

```text
external_identities
external_course_mappings
external_entitlements
integration_inbox
integration_outbox
integration_conflicts
```

Bat buoc co unique constraint:

```text
(source_system, external_user_id)
(source_system, external_course_id)
(source_system, external_grant_id)
```

Yeu cau migration:

- Additive va idempotent.
- Khong drop bang hoac cot hien co.
- Khong ghi de `external_student_id` va `external_course_id` cua Management hien tai.
- Co index cho worker claim, user lookup, course lookup va pending event.
- Co `source_updated_at` de event cu khong ghi de event moi.
- Co audit timestamp va metadata JSONB khi can.

### 3. Course mapping ban dau

- Tao co che map thu cong giua hai khoa hoc dang co tren Course va khoa hoc tuong ung tren Moly.
- Khong auto-map theo title, slug hoac ten gan giong.
- Neu chua co mapping thi tra `COURSE_MAPPING_MISSING`.

### 4. Test Gemini phai viet

- Migration chay thanh cong tren database rong.
- Migration chay lai lan hai khong loi.
- Duplicate external identity bi chan.
- Cung mot external ID duoc phep ton tai neu khac `source_system`.
- Foreign key va status constraint hoat dong.
- Event cu hon bi danh dau stale.

## Codex lam sau

- Review tung migration SQL.
- Kiem tra data type co phu hop voi ID hien tai hay khong.
- Kiem tra `ON DELETE` khong lam mat audit hoac entitlement da mua.
- Kiem tra unique/index tranh duplicate va race condition.
- Kiem tra migration khong anh huong 602 user Moly va 54 user Course hien tai.
- Chay migration hai lan tren database test/local.
- Chay schema coverage va query orphan record.
- Sua migration hoac test neu phat hien thieu constraint/index.
- Xac nhan contract khong dung email lam canonical identity.

## Tieu chi hoan thanh Ngay 1

- Migration chay lap lai an toan.
- Du lieu hien tai khong bi sua hoac xoa.
- Co integration contract ro rang.
- Co course mapping thu cong.
- Tat ca test database cua Ngay 1 pass.
- Codex da review va commit sua loi neu co.

---

# Ngay 2 - API cap quyen ben CSCA-Course

## Gemini lam

### 1. Provision va link user

Mo rong Course integration de ho tro nguon `moly`:

- Tim identity theo `(source_system, external_user_id)`.
- Neu chua co identity, thu link voi user hien co theo quy trinh an toan.
- Email chi duoc dung de goi y link, khong phai identity chinh.
- Tai khoan admin, creator hoac teacher phai vao conflict queue de review thu cong.
- Khong tu dong thay doi email cua account da co.
- External ID gui sang Course phai co namespace, vi du `moly:541`.

### 2. Grant va revoke entitlement

Mot grant thanh cong phai tao/cap nhat day du:

- Active LMS account.
- `lms_access_grants` active.
- `enrollments` active.
- Recording membership hoac class enrollment phu hop.
- Correlation va audit record.

Revoke phai:

- Revoke dung entitlement theo `source_system` va `external_grant_id`.
- Khong revoke quyen den tu nguon khac.
- Chan video access sau khi revoke.

### 3. Bao mat integration

- HMAC signature.
- Service token/integration key.
- Timestamp max age.
- Idempotency key.
- Payload hash.
- Constant-time secret comparison.
- Stale event protection.

### 4. Queue va worker

- Dua event vao durable inbox truoc khi tra response.
- Worker xu ly retry co gioi han.
- Loi vinh vien chuyen dead-letter.
- Identity/course conflict duoc ghi vao `integration_conflicts`.

### 5. Test Gemini phai viet

- Provision user moi.
- Link user da co.
- Replay cung idempotency key.
- Grant quyen lan dau.
- Grant lap lai khong duplicate.
- Revoke va grant lai.
- Event het han.
- Chu ky sai.
- Course mapping thieu.
- Email da thuoc student khac.
- Account admin/teacher conflict.
- Worker retry sau loi tam thoi.

## Codex lam sau

- Review auth middleware va HMAC implementation.
- Test replay attack, forged signature va timestamp qua han.
- Kiem tra transaction bao gom ca grant va recording membership.
- Bao dam khong co trang thai grant thanh cong nhung membership that bai.
- Test race condition khi hai event cung cap quyen cho mot user.
- Test worker dung giua transaction va chay lai.
- Kiem tra stale event khong ghi de revoke/grant moi hon.
- Chay truc tiep flow access cua `videoCourse.router.js`.
- Xac minh user qua du cac gate: LMS account, grant, membership, revoke va device policy.
- Sua cac loi security, transaction hoac SQL phat hien duoc.

## Tieu chi hoan thanh Ngay 2

- Mot event Moly cap du quyen de user xem duoc video Course.
- Replay khong tao duplicate.
- Revoke chan truy cap.
- Event loi co the retry.
- Conflict khong lam thay doi user nhay cam.
- Codex da review va test full access path.

---

# Ngay 3 - Moly payment va entitlement sync

## Gemini lam

### 1. Course integration client tren Moly

Them cac bien moi truong sau, khong hard-code secret:

```text
COURSE_LMS_BASE_URL
COURSE_LMS_SERVICE_TOKEN
COURSE_LMS_INTEGRATION_KEY
COURSE_LMS_HMAC_SECRET
COURSE_LMS_REQUEST_TIMEOUT_MS
```

Client phai ho tro:

- Timeout.
- Retry co backoff.
- Correlation ID.
- Idempotency key.
- Response validation.
- Log khong lo secret hoac PII nhay cam.

### 2. Payment fulfillment

Sau khi payment duoc server xac nhan:

1. Luu order/payment result.
2. Tao local video entitlement.
3. Snapshot course/product da mua.
4. Ghi integration outbox trong cung transaction.
5. Worker gui grant sang Course.
6. Luu remote grant ID va sync status.

Khong goi Course truoc khi local payment transaction commit.

### 3. Quyen ke thua tu Course sang Moly

- Nhan hoac query entitlement cua Course.
- Luu external entitlement/projection tren Moly.
- Course user da co quyen phai thay `Da so huu`.
- Khong cho mua lai cung mot offering dang active.
- Neu entitlement dang pending sync thi hien `Dang dong bo quyen`.

### 4. Refund va revoke

- Refund chi revoke grant cua dung transaction Moly.
- Khong revoke grant duoc mua ben Course hoac duoc admin cap.
- Event revoke phai co idempotency va source timestamp.

### 5. Test Gemini phai viet

- Payment callback gui lap.
- Course API timeout.
- Course tra 409 conflict.
- Worker retry va thanh cong sau do.
- Refund.
- User da co external entitlement.
- User co nhieu entitlement cho cung course.
- Product snapshot khong thay doi sau khi admin sua gia/catalog.

## Codex lam sau

- Review payment transaction boundary.
- Kiem tra client khong the tu gui `paid=true` de nhan quyen.
- Kiem tra duplicate webhook khong tao duplicate order/grant.
- Test Course downtime khong lam mat payment hay entitlement.
- Kiem tra worker claim va lock tranh hai worker gui cung event.
- Kiem tra refund khong thu hoi quyen tu nguon khac.
- Chay tat ca video commerce tests hien co cua Moly.
- Chay test failure recovery va eventual consistency.
- Kiem tra feature flag sales van tat tren production.
- Sua loi va bo sung regression test.

## Tieu chi hoan thanh Ngay 3

- Payment thanh cong tao local entitlement va remote grant.
- Remote downtime khong lam mat quyen.
- User da co Course entitlement khong bi ban trung.
- Refund chi thu hoi dung grant.
- Sales production van tat.

---

# Ngay 4 - SSO va giao dien nguoi dung

## Gemini lam

### 1. One-time SSO code

Tao flow:

1. App nguon yeu cau launch code.
2. Server tao random code co entropy cao.
3. Database chi luu hash cua code.
4. Code co TTL 60-120 giay.
5. App dich exchange code bang server-to-server request.
6. Code duoc danh dau `used_at` trong cung transaction.
7. App dich tao session rieng cua no.

SSO record can co:

- `code_hash`
- `source_system`
- `source_user_id`
- `target_system`
- `target_path`
- `nonce`
- `expires_at`
- `used_at`
- `created_at`

### 2. Identity link/JIT account

- Tim `external_identities` truoc.
- Neu khong co mapping, dua vao safe linking flow.
- Co the tao shadow learner account neu khong xung dot.
- Khong copy password hash.
- Khong tu dong merge account admin/teacher.

### 3. UI Moly

Ho tro cac trang thai:

- `Da so huu`.
- `Mua khoa hoc`.
- `Vao hoc`.
- `Dang dong bo quyen`.
- `Can xac minh tai khoan`.
- `Quyen da het han`.

### 4. UI Course

- Nhan SSO code.
- Exchange code server-side.
- Tao Course session.
- Redirect den dung video offering/workspace.
- Bao toan device limit va access revocation policy.

### 5. Test Gemini phai viet

- Exchange thanh cong.
- Code dung lai.
- Code het han.
- Code gia.
- Target path khong hop le.
- User chua co Moly account.
- User co account tren ca hai ben.
- User bi revoke trong luc code con han.

## Codex lam sau

- Review random code generation va hashing.
- Test code reuse va concurrent exchange.
- Kiem tra CSRF va session fixation.
- Kiem tra open redirect.
- Kiem tra khong lo token tren query log, analytics hoac referrer.
- Kiem tra cookie chi thuoc domain cua tung app.
- Kiem tra khong dung chung JWT secret.
- Kiem tra device limit ben Course van hoat dong.
- Chay E2E cho ba truong hop:
  1. Course user da co quyen nhung chua co Moly account.
  2. Moly user mua khoa hoc moi.
  3. User co tai khoan ca hai ben nhung chua link.
- Sua loi security va bo sung regression tests.

## Tieu chi hoan thanh Ngay 4

- Code chi dung duoc mot lan.
- Code het han dung thoi gian.
- Khong co open redirect.
- Course-only user co the vao Moly va duoc link an toan.
- Moly buyer vao duoc dung Course workspace.
- Khong chia se password, cookie hoac JWT secret.

---

# Ngay 5 - Reconciliation, monitoring va nghiem thu

## Gemini lam

### 1. Reconciliation job

Job phai phat hien:

- Local active nhung remote missing.
- Local revoked nhung remote van active.
- Remote active nhung Moly chua biet.
- Course mapping missing.
- Identity mapping missing/conflict.
- Event pending qua lau.
- Dead-letter chua xu ly.

Nguyen tac:

- Co the tu sua entitlement missing/revoked khi identity va mapping chac chan.
- Khong tu merge identity conflict.
- Moi lan sua phai co audit record.
- Reconciliation phai idempotent.

### 2. Admin/operations view

Toi thieu phai xem duoc:

- Pending events.
- Failed events.
- Dead-letter events.
- Retry count.
- Last error.
- Identity conflicts.
- Course mapping missing.
- Correlation ID.

### 3. Observability

- Structured logs.
- Correlation ID xuyen suot hai app.
- Metrics cho pending, retry, failed, dead-letter va sync latency.
- Khong log secret, raw token hoac full payment payload.

### 4. Runbook va rollout document

Viet ro:

- Cach retry event.
- Cach revoke thu cong.
- Cach map course.
- Cach xu ly identity conflict.
- Cach tat integration khan cap.
- Cach rollback migration/code.
- Danh sach Railway variables.
- Thu tu rollout staging va production.

### 5. Test Gemini phai viet

- Reconcile missing grant.
- Reconcile revoke.
- Khong sua identity conflict.
- Chay reconciliation hai lan khong duplicate.
- Retry dead-letter thu cong.
- Kill switch dung hoat dong.

## Codex lam sau

- Review toan bo diff cua ca hai repository.
- Chay unit, integration va E2E tests.
- Chay migration tren ban sao schema production.
- Query duplicate identity, course mapping va entitlement.
- Query orphan rows va pending event qua han.
- Kiem tra lock, long transaction va worker concurrency.
- Kiem tra Railway variables chi theo ten, khong de lo gia tri.
- Smoke test hai app tren staging.
- Kiem tra grant, revoke, expire, refund va reconciliation end-to-end.
- Kiem tra rollback va kill switch.
- Viet bao cao nghiem thu cuoi cung gom:
  - Hang muc dat.
  - Loi Gemini implementation da duoc Codex sua.
  - Test da chay.
  - Rui ro con lai.
  - Lenh rollout.
  - Rollback plan.
- Khong deploy production hoac bat sales neu chua duoc phe duyet.

## Tieu chi hoan thanh Ngay 5

- Grant, revoke, expire va refund dong bo dung.
- Retry khong tao duplicate.
- Reconciliation phat hien va sua duoc entitlement lech.
- Identity conflict khong bi auto-merge.
- Co monitoring, audit, runbook va kill switch.
- Tat ca test bat buoc pass.
- Codex xac nhan san sang staging hoac neu ro blocker.

---

# 5. Ma tran phan cong

| Hang muc | Gemini lam | Codex lam sau |
|---|---|---|
| Integration contract | Viet ban dau | Review tinh day du va consistency |
| Migration SQL | Tao migration va test | Review constraint, index, data safety |
| Identity mapping | Implement | Test conflict, collision va race condition |
| Course mapping | Implement | Kiem tra fail-closed va mapping sai |
| Course grant/revoke API | Implement | Security va transaction review |
| Recording membership | Implement | Xac minh full access path |
| Moly payment integration | Implement | Review idempotency va failure recovery |
| Integration worker | Implement | Test concurrency, retry va dead-letter |
| SSO | Implement | Security/adversarial testing |
| UI states | Implement | Regression va E2E review |
| Reconciliation | Implement | Verify drift correction va audit |
| Railway config | Liet ke bien can thiet | Kiem chung config va health |
| Production rollout | Chuan bi tai lieu | Xac nhan cuoi, khong tu deploy |

# 6. Definition of Done chung

Mot hang muc chi duoc coi la xong khi:

- Co code va migration neu can.
- Co test cho happy path va failure path.
- Gemini da commit va ghi handoff note.
- Codex da review diff.
- Codex da chay lai test.
- Loi phat hien trong review da duoc sua va co regression test.
- Khong lo secret hoac PII trong log.
- Khong ghi truc tiep sang database cua app con lai.
- Co idempotency va audit cho moi thay doi quyen.
- Co cach revoke va rollback.

# 7. Ket qua mong doi sau 5 ngay

- Co ban staging lien ket Moly va CSCA-Course.
- User Course da co quyen duoc Moly ghi nhan la da so huu.
- User Moly mua moi duoc cap day du grant va recording membership tren Course.
- SSO hoat dong bang one-time code.
- Refund/revoke/expire dong bo dung.
- Queue co retry, dead-letter va reconciliation.
- Co bao cao nghiem thu cua Codex.
- Production sales van tat cho den khi chu du an phe duyet.
