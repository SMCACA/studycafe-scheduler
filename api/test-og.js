// ================================================================
// 📁 api/test-og.js  ← 진단용 테스트 파일 (나중에 삭제해도 됨)
// ================================================================
import { ImageResponse } from '@vercel/og'

export const config = { runtime: 'edge' }

export default function handler() {
  return new ImageResponse(
    {
      type: 'div',
      key: null,
      props: {
        style: {
          width: 400, height: 200,
          background: '#6366F1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        children: {
          type: 'span',
          key: null,
          props: {
            style: { color: 'white', fontSize: 36, fontWeight: 700 },
            children: 'SMC 테스트 OK',
          },
        },
      },
    },
    { width: 400, height: 200 }
  )
}