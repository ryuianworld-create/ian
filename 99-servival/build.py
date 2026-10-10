#!/usr/bin/env python3
"""index.html + vendor/three.min.js -> dist/99-survival.html (인터넷 없이 열리는 단일 파일)"""

import pathlib

root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')
three = (root / 'vendor' / 'three.min.js').read_text(encoding='utf-8')

tag = '<script src="vendor/three.min.js"></script>'
if tag not in html:
    raise SystemExit('index.html에서 three.js 스크립트 태그를 찾지 못했습니다')

out = html.replace(tag, '<script>\n' + three + '\n</script>')
out = out.replace('인터넷 연결을 확인한 뒤 새로고침해 주세요.', '브라우저가 WebGL을 지원하는지 확인해 주세요.')

dest = root / 'dist' / '99-survival.html'
dest.parent.mkdir(exist_ok=True)
dest.write_text(out, encoding='utf-8')
print(f'{dest} ({len(out.encode("utf-8")) / 1024 / 1024:.2f} MB)')
