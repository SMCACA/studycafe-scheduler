

studycafe-scheduler.zip
zip

SMC 스터디카페 React 스케줄 관리 시스템에 카카오 알림톡 실제 발송 기능을 연결하고 싶어! 

【기술 스택】 - React + Vite, Tailwind CSS, Supabase, Vercel 

알림톡 발송 서비스: Solapi (솔라피) 【현재 상황】
알림톡 메뉴가 2개 있어: "스케줄 알림톡", "상벌점 알림톡"
둘 다 "알림톡 발송" 버튼을 누르면 지금은 alert()만 뜨고 실제 발송은 안 됨
Supabase에 students 테이블이 있고 parent_phone(학부모 전화번호) 컬럼이 있어 【하고 싶은 것】

Solapi 계정/API키 발급 방법
Vercel 환경변수에 Solapi API키 설정하는 방법
알림톡 발송 버튼 클릭 시 실제로 학부모 번호로 카카오 알림톡이 전송되게 구현
【중요 조건】 
- 나는 코딩 완전 초보자야, 쉽게 설명해줘 
- 전문용어는 괄호 안에 설명 추가해줘

더 보기
오전 1:10

Solapi 통합을 위해 서버리스 함수와 프론트엔드 수정을 설계했다
Solapi 통합을 위해 서버리스 함수와 프론트엔드 수정을 설계했다
이제 코드 구조를 완전히 파악했습니다! 3개 파일을 새로 만들고 2개를 수정하면 됩니다. 지금 바로 만들어 드릴게요.


6개 파일 수정됨, 명령 3개 실행함, 2개의 파일 생성됨
6개 파일 수정됨, 명령 3개 실행함, 2개의 파일 생성됨
이제 RewardNotification.jsx도 수정합니다.


4개 파일 수정됨, 명령 2개 실행함, 파일 조회함
4개 파일 수정됨, 명령 2개 실행함, 파일 조회함
이제 파일들을 출력 디렉토리로 복사합니다.


명령 2개 실행함, 파일 읽음
명령 2개 실행함, 파일 읽음
파일 4개 완성입니다! 이제 설정 방법을 단계별로 안내드릴게요.

🎯 결론 먼저
"알림톡 발송" 버튼이 실제로 작동하려면 3단계가 필요합니다:

Solapi 계정 만들고 API 키 발급
Vercel에 API 키 등록
파일 4개를 프로젝트에 교체
📦 만들어진 파일 4개 설명
파일	위치	역할
send-notification.js	프로젝트 루트 > api/	Solapi 실제 호출 (서버 역할)
sendNotification.js	src/lib/	버튼과 서버를 연결하는 다리
StudentViewer.jsx	src/pages/	스케줄 알림톡 버튼 업데이트
RewardNotification.jsx	src/pages/	상벌점 알림톡 버튼 업데이트
💡 비유: send-notification.js는 "배달 담당 직원"이고, sendNotification.js는 "주문서 전달자"예요. 버튼 클릭 → 주문서 전달 → 배달 직원 → Solapi → 학부모 폰

STEP 1 · Solapi 계정 & API 키 발급
1-1. 회원가입
→ https://solapi.com 접속 → 무료 회원가입

1-2. API 키 발급
→ 로그인 후 우측 상단 [내 계정] → [API 키 관리] → [새 키 생성]
→ API Key와 API Secret 두 가지를 메모장에 복사해두세요!

1-3. 발신번호 등록 (중요!)
→ [발신번호 관리] → [발신번호 추가] → 학원 전화번호 입력
→ 인증 문자 수신 후 등록 완료

1-4. 충전
→ SMS 1건 약 9원 / 알림톡 1건 약 8원 (소량 충전 가능)

STEP 2 · Vercel 환경변수 (API 키 숨기기)
💡 비유: API 키를 코드에 직접 쓰면 "금고 비밀번호를 문에 붙여놓는 것"! Vercel 환경변수는 비밀번호를 금고 안에 따로 보관하는 거예요.

Vercel 대시보드 → 프로젝트 선택 → Settings → Environment Variables 에서 아래 4개를 추가하세요:

변수명	값	설명
SOLAPI_API_KEY	(발급받은 API Key)	Solapi 아이디
SOLAPI_API_SECRET	(발급받은 API Secret)	Solapi 비밀번호
SOLAPI_FROM_NUMBER	01012345678	학원 등록된 발신번호
SOLAPI_PF_ID	(일단 비워두세요)	카카오채널 ID (아래 참고)
환경변수 추가 후 → Redeploy (재배포) 필수!

STEP 3 · 파일 교체 방법
📁 studycafe-scheduler/          ← 프로젝트 루트
│
├── 📁 api/                       ← ✅ 새로 만들어야 해요!
│   └── send-notification.js      ← ✅ 새 파일
│
└── 📁 src/
    ├── 📁 lib/                   ← ✅ 새로 만들어야 해요!
    │   └── sendNotification.js   ← ✅ 새 파일
    └── 📁 pages/
        ├── StudentViewer.jsx     ← ✅ 기존 파일 교체
        └── RewardNotification.jsx ← ✅ 기존 파일 교체
방법: VS Code에서 위 구조대로 폴더/파일을 만들고 다운받은 내용을 붙여넣기

📲 알림톡 vs SMS - 지금 당장 vs 나중에
지금 당장 (SMS): SOLAPI_PF_ID를 비워두면 바로 문자(SMS/LMS)로 발송돼요! 알림톡처럼 카카오앱이 열리진 않지만 문자로 내용이 전달됩니다.

나중에 (알림톡): 카카오 채널 (플러스친구) 개설 → Solapi에서 채널 연동 → SOLAPI_PF_ID 등록하면 카카오 알림톡으로 전환됩니다. (채널 심사 1~2주 소요)

⚠️ 주의: .env 파일에 Solapi 키를 추가하면 로컬(내 PC)에서만 작동해요. Vercel 배포 환경에서는 반드시 Vercel 환경변수에 등록해야 합니다!

궁금한 단계가 있으면 알려주세요! 😊


Send notification
JS 

Sendnotification
JS 

Studentviewer
코드 · JSX 

Rewardnotification
코드 · JSX 

크레딧 사용 중 • 플랜 한도가 일요일 오전 2:10에 초기화됩니다.
Claude Fable 5 is currently unavailable.
자세히 알아보기(opens in new tab)




Claude는 AI이며 실수할 수 있습니다. 응답을 다시 한번 확인해 주세요.
Send notification · JS
// ================================================================
// 📁 api/send-notification.js
// ================================================================
// 이 파일은 "Vercel 서버리스 함수" (= 서버 역할을 하는 작은 프로그램)입니다.
// React 앱이 이 주소를 호출하면, 여기서 Solapi에 알림톡/문자를 보냅니다.
// API 키는 이 파일에서만 사용 → 브라우저에 절대 노출되지 않아요!
//
// 🗂️ 위치: 프로젝트 최상단(root) > api > send-notification.js
//          (src 폴더 안이 아니라 프로젝트 루트에 api 폴더를 새로 만들어야 해요!)
// ================================================================
 
import crypto from 'crypto' // Node.js 내장 암호화 모듈 (설치 불필요)
 
// ──────────────────────────────────────────────────────────────
// Solapi 인증 헤더 생성 함수
// (마치 편지에 도장 찍는 것처럼, 우리가 진짜 Solapi 회원임을 증명)
// ──────────────────────────────────────────────────────────────
function makeAuthHeader(apiKey, apiSecret) {
  const date = new Date().toISOString()                      // 현재 시간
  const salt = Math.random().toString(36).substring(2, 15)  // 무작위 문자열 (보안용)
  const signature = crypto                                   // 암호화 서명
    .createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex')
 
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}
 
// ──────────────────────────────────────────────────────────────
// 전화번호 정리 함수 (010-1234-5678 → 01012345678)
// ──────────────────────────────────────────────────────────────
function cleanPhone(phone) {
  return phone.replace(/[^0-9]/g, '') // 숫자 외 모두 제거
}
 
// ──────────────────────────────────────────────────────────────
// 메인 핸들러: React에서 요청이 오면 이 함수가 실행됩니다
// ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다' })
  }
 
  // React에서 보낸 데이터를 꺼냄
  const { to, text, type } = req.body
  // to   = 학부모 전화번호 (수신자)
  // text = 보낼 메시지 내용
  // type = 'schedule'(스케줄) 또는 'reward'(상벌점)
 
  // 필수값 체크
  if (!to || !text) {
    return res.status(400).json({ error: '수신번호와 메시지가 필요합니다' })
  }
 
  // ── Vercel 환경변수에서 API 키 읽기 ──
  const apiKey      = process.env.SOLAPI_API_KEY       // Solapi API 키
  const apiSecret   = process.env.SOLAPI_API_SECRET    // Solapi API Secret
  const fromNumber  = process.env.SOLAPI_FROM_NUMBER   // 발신번호 (등록된 번호)
  const pfId        = process.env.SOLAPI_PF_ID         // 카카오 채널 ID (알림톡용)
 
  // 필수 환경변수 누락 시 에러
  if (!apiKey || !apiSecret || !fromNumber) {
    return res.status(500).json({
      error: 'Vercel 환경변수를 확인해주세요 (SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_FROM_NUMBER)'
    })
  }
 
  // ── 메시지 객체 구성 ──
  // 카카오 채널(pfId)이 설정되어 있으면 → 알림톡(ATA)
  // 없으면 → SMS/LMS 문자로 자동 전환 (텍스트 90바이트 초과 시 LMS)
  const message = {
    to:   cleanPhone(to),           // 수신자 번호
    from: cleanPhone(fromNumber),   // 발신자 번호
    text: text,
  }
 
  if (pfId) {
    // 📲 알림톡 모드 (카카오 채널 연동 완료 후)
    message.kakaoOptions = {
      pfId:       pfId,
      disableSms: false, // 알림톡 실패 시 SMS로 자동 대체 (권장!)
    }
    console.log('[알림톡 발송] 수신번호:', cleanPhone(to))
  } else {
    // 📱 SMS/LMS 모드 (카카오 채널 미설정 시 자동 사용)
    console.log('[SMS 발송] 수신번호:', cleanPhone(to))
  }
 
  // ── Solapi API 호출 ──
  try {
    const authHeader = makeAuthHeader(apiKey, apiSecret)
 
    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ message }),
    })
 
    const data = await response.json()
 
    if (!response.ok) {
      // Solapi가 에러를 반환한 경우
      console.error('[Solapi 에러]', data)
      return res.status(response.status).json({
        error:  data.errorMessage || '발송 실패',
        detail: data,
      })
    }
 
    // 성공!
    console.log('[발송 성공]', data)
    return res.status(200).json({ success: true, data })
 
  } catch (err) {
    console.error('[서버 오류]', err)
    return res.status(500).json({ error: '서버 오류: ' + err.message })
  }
}
 

