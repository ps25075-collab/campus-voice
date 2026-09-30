-- '선거' 카테고리 폐지: 기존 선거 기사를 '학교' 카테고리로 이동.
-- 앱(CATEGORIES)에서 '선거'를 제거한 것과 짝을 이룬다.
-- 2026-10-01 service_role 로 적용 완료 (id 26~37, 12건). 재실행 안전: 남은 '선거' 행이 없으면 no-op.

update public.articles set category = '학교' where category = '선거';
