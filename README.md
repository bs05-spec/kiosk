# ATTEND KIOSK

학생 출석 등록 키오스크와 관리자용 명단·출결 관리 웹앱입니다. Next.js App Router, TypeScript, Tailwind CSS, Supabase를 사용합니다.

## 시작하기

1. 의존성을 설치합니다.

   ```bash
   npm install
   ```

2. `.env.example`을 `.env.local`로 복사한 뒤 Supabase 프로젝트 값과 관리자 인증 값을 입력합니다.

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `ADMIN_PASSWORD_HASH`
   - `ADMIN_SESSION_SECRET`

   `.env.local`은 Git에 포함하지 마세요. `SUPABASE_SECRET_KEY`, 관리자 비밀번호 해시, 세션 시크릿은 공개 저장소나 클라이언트 코드에 노출하면 안 됩니다.

3. Supabase SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql)을 실행합니다. 명단, 학생, 출석 기록 테이블과 명단 업로드용 함수를 생성합니다.

4. 개발 서버를 실행합니다.

   ```bash
   npm run dev
   ```

   키오스크는 `http://localhost:3000`, 관리자 화면은 `http://localhost:3000/admin`에서 확인합니다.

## 관리자 비밀번호 해시 생성

프로젝트 루트에서 PowerShell을 열고 다음을 실행합니다. 입력한 비밀번호는 화면에 표시되지 않습니다. 출력된 `ADMIN_PASSWORD_HASH=...` 값을 `.env.local`에 설정한 뒤 개발 서버를 재시작합니다.

```powershell
$secure = Read-Host "관리자 비밀번호" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  node -e "require('bcryptjs').hash(process.env.ADMIN_PASSWORD,12).then(hash=>console.log('ADMIN_PASSWORD_HASH='+hash))"
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  Remove-Item Env:ADMIN_PASSWORD
}
```

## 확인 명령

```bash
npm run lint
npm run build
```
