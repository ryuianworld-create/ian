#!/usr/bin/env python3
"""index.html + vendor/three.min.js -> dist/sugar-run.html (단일 파일 배포본)
   그리고 내려받기용 dist/sugar-run.zip"""

import pathlib
import zipfile

root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')
three = (root / 'vendor' / 'three.min.js').read_text(encoding='utf-8')

tag = '<script src="vendor/three.min.js"></script>'
if tag not in html:
    raise SystemExit('index.html에서 three.js 스크립트 태그를 찾지 못했습니다')

out = html.replace(tag, '<script>\n' + three + '\n</script>')
out = out.replace(
    '<p class="sub">인터넷 연결을 확인한 뒤 새로고침해 주세요.</p>',
    '<p class="sub">브라우저가 WebGL을 지원하는지 확인해 주세요.</p>')

dest = root / 'dist' / 'sugar-run.html'
dest.parent.mkdir(exist_ok=True)
dest.write_text(out, encoding='utf-8')
print(f'{dest} ({len(out.encode("utf-8")) / 1024 / 1024:.2f} MB)')

# 브라우저에서 내려받아 보관하기 좋은 zip (한글 파일 이름 + 실행 방법 메모)
readme = (root / 'dist' / '실행방법.txt')
zip_path = root / 'dist' / 'sugar-run.zip'
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in [('설탕-도망쳐.html', out.encode('utf-8')),
                       ('실행방법.txt', readme.read_bytes())]:
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, data)
print(f'{zip_path} ({zip_path.stat().st_size / 1024:.0f} KB)')
