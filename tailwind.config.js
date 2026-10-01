/** @type {import('tailwindcss').Config} */
export default {
  // hover: 효과를 마우스가 있는 기기에서만 적용 — 터치 화면에서 눌린 뒤 떠 있는 상태로 굳는 문제 방지
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
