"""Assemble la maquette : remplace les marqueurs __IMG_*__ et __ATCH_*__ de src.html par des data URI.

Usage : python3 docs/maquette/build.py
Produit dist/maquette.html (page autonome, à ouvrir dans un navigateur)
et dist/artifact.html (fragment sans <html>/<head>, pour la publication en artifact).
"""
import base64
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
IMG = ROOT / "img"
DIST = ROOT / "dist"


def data_uri(name: str, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode((IMG / name).read_bytes()).decode()


MARKERS = {
    "__ATCH_ENCRE__": data_uri("atch-encre.svg", "image/svg+xml"),
    "__ATCH_ECRU__": data_uri("atch-ecru.svg", "image/svg+xml"),
    "__IMG_HERO__": data_uri("hero.webp", "image/webp"),
    "__IMG_ARENES__": data_uri("arenes.webp", "image/webp"),
    "__IMG_MANADE__": data_uri("manade.webp", "image/webp"),
    "__IMG_CHEVAUX__": data_uri("chevaux.webp", "image/webp"),
}

HEAD = (
    '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    "<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n"
    "</head>\n<body>\n"
)


def main() -> None:
    src = (ROOT / "src.html").read_text(encoding="utf-8")
    for marker, uri in MARKERS.items():
        if marker not in src:
            raise SystemExit(f"Marqueur absent de src.html : {marker}")
        src = src.replace(marker, uri)
    DIST.mkdir(exist_ok=True)
    (DIST / "artifact.html").write_text(src, encoding="utf-8")
    (DIST / "maquette.html").write_text(HEAD + src + "\n</body>\n</html>\n", encoding="utf-8")
    print(f"dist/maquette.html et dist/artifact.html : {len(src.encode()) // 1024} Ko")


if __name__ == "__main__":
    main()
