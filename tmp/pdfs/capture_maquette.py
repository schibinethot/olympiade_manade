from pathlib import Path
import base64
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'tmp/pdfs'
src = (ROOT / 'docs/maquette/src.html').read_text()
for key, name, mime in [
    ('ATCH_ENCRE','atch-encre.svg','image/svg+xml'), ('ATCH_ECRU','atch-ecru.svg','image/svg+xml'),
    ('IMG_HERO','hero.webp','image/webp'), ('IMG_ARENES','arenes.webp','image/webp'),
    ('IMG_MANADE','manade.webp','image/webp'), ('IMG_CHEVAUX','chevaux.webp','image/webp')]:
    src = src.replace('__'+key+'__', 'data:'+mime+';base64,'+base64.b64encode((ROOT/'docs/maquette/img'/name).read_bytes()).decode())
src = re.sub(r'/\* temps réel simulé \*/.*?/\* démarrage \*/', '/* démarrage */', src, flags=re.S)
fonts = Path('/Users/tpmge/Library/Fonts')
css = f'''<style>
@font-face{{font-family:Inter;src:url('{fonts.as_uri()}/Inter_18pt-Regular.ttf');font-weight:400}}
@font-face{{font-family:Inter;src:url('{fonts.as_uri()}/Inter_18pt-SemiBold.ttf');font-weight:600}}
@font-face{{font-family:Inter;src:url('{fonts.as_uri()}/Inter_18pt-Bold.ttf');font-weight:700 900}}
@font-face{{font-family:'Playfair Display';src:url('{fonts.as_uri()}/PlayfairDisplay-Regular.ttf');font-weight:400 600}}
@font-face{{font-family:'Playfair Display';src:url('{fonts.as_uri()}/PlayfairDisplay-Bold.ttf');font-weight:700 900}}
@font-face{{font-family:'Playfair Display';src:url('{fonts.as_uri()}/PlayfairDisplay-SemiBoldItalic.ttf');font-weight:400 900;font-style:italic}}
*,*::before,*::after{{animation:none!important;transition:none!important}}
</style>'''
html = WORK / 'maquette-capture.html'
html.write_text('<!doctype html><html lang="fr"><meta charset="utf-8"><body>'+src+css+'</body></html>')

tasks = [
('accueil','public','accueil','desktop',None),
('accueil_mobile','public','accueil','mobile',None),
('dates','public','dates','desktop',None),
('palmares','public','classements','desktop',None),
('inscription','spect','inscription','mobile',('ins','1')),
('code','spect','inscription','mobile',('ins','2')),
('vote','spect','noter','mobile',None),
('vote_desktop','spect','noter','desktop',None),
('classement','spect','classement','mobile',None),
('jury','jury','noter','ipad',None),
('jury_mobile','jury','noter','mobile',None),
('cockpit','orga','cockpit','desktop',None),
('cockpit_mobile','orga','cockpit','mobile',None),
('import','orga','import','desktop',None),
('resultats','orga','resultats','desktop',None),
('ecran','ecran','ecran','tv',None),
]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':2200,'height':1600},device_scale_factor=1.6,color_scheme='light',reduced_motion='reduce')
    page.goto(html.as_uri(),wait_until='networkidle')
    page.evaluate('document.fonts.ready')
    for name, role, screen, device, action in tasks:
        page.locator(f'#roles [data-arg="{role}"]').click()
        page.locator(f'#screens [data-arg="{screen}"]').click()
        if device!='tv':
            page.locator(f'#devices [data-arg="{device}"]').click()
        if action:
            page.locator(f'.dev [data-act="{action[0]}"][data-arg="{action[1]}"]').first.click()
        page.evaluate('document.fonts.ready')
        page.locator('.dev').screenshot(path=str(WORK/'screens'/f'{name}.png'),animations='disabled')
        print(name,flush=True)
    # L'avis privé figure au bas de l'écran de classement.
    page.locator('#roles [data-arg="spect"]').click()
    page.locator('#screens [data-arg="classement"]').click()
    page.locator('#devices [data-arg="mobile"]').click()
    page.locator('.dev .scroll').evaluate('(e)=>e.scrollTop=e.scrollHeight')
    page.locator('.dev').screenshot(path=str(WORK/'screens/avis.png'),animations='disabled')
    browser.close()
