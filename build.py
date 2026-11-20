#!/usr/bin/env python3
"""Builds the two language pages and the share-image sources.

  python3 build.py

Reads content/site.json, content/en.json and content/es.json, fills template/page.html and
writes index.html (English) and es/index.html (Spanish). It also fills the share-image
templates in share-src/ into share-src/build/, which share-src/render.sh turns into PNGs.
Standard library only.
"""
import html
import json
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
LANGS = ("en", "es")
OUT = {"en": ROOT / "index.html", "es": ROOT / "es" / "index.html"}
LOCALE = {"en": "en_US", "es": "es_MX"}
TOKEN = re.compile(r"\{\{(&?)([\w.]+)\}\}")


def enc(text):
    return quote(text, safe="-_.~")


def lookup(ctx, path):
    value = ctx
    for part in path.split("."):
        value = value[part]
    return value


def render(template, ctx):
    def fill(match):
        raw, path = match.groups()
        value = str(lookup(ctx, path))
        return value if raw else html.escape(value, quote=True)
    return TOKEN.sub(fill, template)


def context(lang, site, content):
    base = site["site_url"].rstrip("/")
    url = {"en": base + "/", "es": base + "/es/"}
    share_url = base if lang == "en" else base + "/es/"
    other = "es" if lang == "en" else "en"
    ctx = dict(site)
    ctx.update(content)
    award = site.get("award_url", "")
    if award:
        plaque_open = f'<a class="plaque" href="{html.escape(award, quote=True)}" target="_blank" rel="noopener">'
        plaque_close = "</a>"
    else:
        plaque_open, plaque_close = '<div class="plaque">', "</div>"
    # Language switch: the current language is plain text, the other one a link.
    hrefs = {"en": "./" if lang == "en" else "../", "es": "es/" if lang == "en" else "./"}
    items = []
    for code in LANGS:
        label = code.upper()
        if code == lang:
            items.append(f'<span class="lang-current" aria-current="page">{label}</span>')
        else:
            items.append(f'<a href="{hrefs[code]}" hreflang="{code}" lang="{code}">{label}</a>')
    # The English page sends ?lang=es to /es/, keeping any other query parameters.
    redirect = ""
    if lang == "en":
        redirect = ('<script>(function(){var q=new URLSearchParams(location.search);'
                    'if(q.get("lang")==="es"){q.delete("lang");var s=q.toString();'
                    'location.replace("es/"+(s?"?"+s:"")+location.hash);}})();</script>')
    text = content["share_text"]
    ctx.update({
        "a": "" if lang == "en" else "../",
        "page_url": url[lang],
        "url_en": url["en"],
        "url_es": url["es"],
        "other_locale": LOCALE[other],
        "home_href": "./",
        "og_image": f"{base}/assets/og-{lang}.png",
        "share_url": share_url,
        "share_whatsapp": "https://wa.me/?text=" + enc(text + " " + share_url),
        "share_facebook": "https://www.facebook.com/sharer/sharer.php?u=" + enc(share_url),
        "share_x": "https://x.com/intent/tweet?text=" + enc(text) + "&url=" + enc(share_url),
        "share_linkedin": "https://www.linkedin.com/sharing/share-offsite/?url=" + enc(share_url),
        "share_telegram": "https://t.me/share/url?url=" + enc(share_url) + "&text=" + enc(text),
        "contact_url": f"https://wa.me/{site['whatsapp_number']}?text=" + enc(content["contact_message"]),
        "plaque_open": plaque_open,
        "plaque_close": plaque_close,
        "lang_switch": '<span class="lang-sep" aria-hidden="true">|</span>'.join(items),
        "lang_redirect": redirect,
        # The plaque's last line wraps between its two parts on narrow screens.
        "plaque_sub": '<span class="sep"> · </span>'.join(
            f"<span>{html.escape(part)}</span>" for part in content["plaque"]["sub"].split(" · ")),
    })
    return ctx


def main():
    site = json.loads((ROOT / "content" / "site.json").read_text(encoding="utf-8"))
    page = (ROOT / "template" / "page.html").read_text(encoding="utf-8")
    shares = sorted((ROOT / "share-src").glob("*.tmpl.html"))
    (ROOT / "share-src" / "build").mkdir(exist_ok=True)
    for lang in LANGS:
        content = json.loads((ROOT / "content" / f"{lang}.json").read_text(encoding="utf-8"))
        ctx = context(lang, site, content)
        OUT[lang].parent.mkdir(exist_ok=True)
        OUT[lang].write_text(render(page, ctx), encoding="utf-8")
        print("wrote", OUT[lang].relative_to(ROOT))
        for tmpl in shares:
            name = tmpl.name.replace(".tmpl.html", f"-{lang}.html")
            (ROOT / "share-src" / "build" / name).write_text(render(tmpl.read_text(encoding="utf-8"), ctx), encoding="utf-8")
            print("wrote", f"share-src/build/{name}")


if __name__ == "__main__":
    main()
