// ================================================================
// 📁 src/lib/manualsApi.js
// ================================================================
// 비유: 이 파일은 "도서관 사서함" 역할이에요.
//   - 파일 자체는 Supabase Storage(서가)에 올려두고
//   - manuals 테이블에는 "제목 + 책이 꽂힌 위치(주소)"만 적어둬요.
// students 테이블과 같은 방식으로, RLS 없이 브라우저(anon key)에서
// 직접 읽고 쓸 수 있게 만들었어요. (이미 로그인한 관리자만 들어오는 화면이라 안전해요)
// ================================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const BUCKET = 'manuals'

/** 매뉴얼 목록을 최신순으로 가져옵니다. */
export async function fetchManuals() {
  const { data, error } = await supabase
    .from('manuals')
    .select('*')
    .order('uploaded_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

/** 새 매뉴얼 파일을 업로드하고 목록에 등록합니다. */
export async function uploadManual({ title, file }) {
  // ① Storage(서가)에 실제 파일을 올려요.
  //    ⚠️ Supabase Storage는 저장 "경로(키)"에 한글 등 영문/숫자 외 글자가
  //       들어가면 "Invalid key" 오류를 내요. (운송장에는 영어 주소만 가능한 것과 비슷해요)
  //       그래서 실제 저장 경로는 영문/숫자만 남기고, 화면에 보여줄 "원래 파일명"은
  //       따로 manuals 테이블(file_name 칸)에 한글 그대로 저장해둬요.
  const lastDot = file.name.lastIndexOf('.')
  const ext = lastDot >= 0 ? file.name.slice(lastDot) : ''
  const safeExt = ext.replace(/[^\w.]/g, '') || ''
  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (uploadError) throw new Error('파일 업로드 실패: ' + uploadError.message)

  // ② 방금 올린 파일의 공개 주소를 가져와요.
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

  // ③ "사서함 카드"(manuals 테이블)에 제목 + 주소를 적어둬요.
  const { data, error: insertError } = await supabase
    .from('manuals')
    .insert({
      title: title.trim(),
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_size: file.size,
      content_type: file.type,
    })
    .select()
    .single()

  if (insertError) throw new Error('등록 실패: ' + insertError.message)
  return data
}

/** 매뉴얼을 삭제합니다 (Storage 파일 + 목록 둘 다). */
export async function deleteManual(manual) {
  // Storage에서 실제 파일도 지워요. (file_url에서 파일 경로만 뽑아내요)
  try {
    const path = decodeURIComponent(manual.file_url.split(`/${BUCKET}/`)[1])
    if (path) await supabase.storage.from(BUCKET).remove([path])
  } catch {
    // 파일 삭제가 실패해도 목록 삭제는 계속 진행해요 (찾는 파일이 없을 수도 있어서)
  }

  const { error } = await supabase.from('manuals').delete().eq('id', manual.id)
  if (error) throw new Error(error.message)
}
