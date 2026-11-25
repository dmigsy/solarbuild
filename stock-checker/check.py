#!/usr/bin/env python3
"""Smyths Toys Ireland - PS5 console stock checker. Standard library only.

Usage:
  NTFY_TOPIC=your-private-topic python3 stock-checker/check.py
  python3 stock-checker/check.py --dry-run     # print results, send nothing
  NTFY_TOPIC=... python3 stock-checker/check.py --test-notify

Exit codes: 0 = ran fine (in stock or not), 1 = could not read Smyths
(blocked / page layout changed). A failing GitHub Actions run emails you.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from html import unescape
from urllib.parse import urljoin

BASE = "https://www.smythstoys.com"
# Pages scanned for product links. Override with SMYTHS_PAGES (comma-separated).
PAGES = [
    BASE + "/ie/en-ie/search/?text=ps5+console",
    BASE + "/ie/en-ie/video-games-and-tablets/playstation-5/playstation-5-consoles/c/SM100108",
]
# Extra product URLs to always check. Set SMYTHS_PRODUCTS (comma-separated).
EXTRA_PRODUCTS = [u for u in os.environ.get("SMYTHS_PRODUCTS", "").split(",") if u.strip()]
if os.environ.get("SMYTHS_PAGES"):
    PAGES = [u.strip() for u in os.environ["SMYTHS_PAGES"].split(",") if u.strip()]

WANT = re.compile(r"playstation\s*5|ps5", re.I)
IS_CONSOLE = re.compile(r"console|digital edition|disc edition|\bpro\b", re.I)
NOT_CONSOLE = re.compile(
    r"controller|dualsense|headset|pulse|charg|stand|cover|voucher|gift|card|"
    r"game|bundle with|camera|remote|case|skin|faceplate|drive|subscription",
    re.I,
)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IE,en;q=0.9",
}


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def product_links(html):
    links = set()
    for m in re.finditer(r'href="([^"#]*?/p/\d+[^"#]*)"', html):
        links.add(urljoin(BASE, unescape(m.group(1)).split("?")[0]))
    return links


def title_of(html):
    m = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', html, re.I)
    if not m:
        m = re.search(r"<title>([^<]+)</title>", html, re.I)
    return unescape(m.group(1)).strip() if m else ""


def availability(html):
    """Return True / False / None (unknown) for a product page."""
    # 1. schema.org JSON-LD (most reliable)
    for blob in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.S | re.I):
        try:
            data = json.loads(blob)
        except ValueError:
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            node = stack.pop()
            if isinstance(node, list):
                stack.extend(node)
            elif isinstance(node, dict):
                av = node.get("availability")
                if isinstance(av, str):
                    return av.rsplit("/", 1)[-1].lower() in ("instock", "limitedavailability", "preorder", "onlineonly")
                stack.extend(v for v in node.values() if isinstance(v, (dict, list)))
    # 2. Fallback: visible text
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    if re.search(r"out of stock|currently unavailable|sold out", text, re.I):
        return False
    if re.search(r"add to basket|click\s*&\s*collect|home delivery", text, re.I):
        return True
    return None


def notify(title, message, click=None, priority="high"):
    topic = os.environ.get("NTFY_TOPIC")
    if not topic:
        print("NTFY_TOPIC not set - not sending push.")
        return
    headers = {"Title": title.encode("ascii", "replace").decode(), "Priority": priority, "Tags": "video_game"}
    if click:
        headers["Click"] = click
    req = urllib.request.Request(
        "https://ntfy.sh/" + topic, data=message.encode("utf-8"), headers=headers, method="POST"
    )
    urllib.request.urlopen(req, timeout=30).read()
    print("Push sent.")


def main():
    dry = "--dry-run" in sys.argv
    if "--test-notify" in sys.argv:
        notify("Smyths checker test", "If you see this, push alerts work.", priority="default")
        return 0

    urls, errors = set(EXTRA_PRODUCTS), []
    for page in PAGES:
        try:
            urls |= product_links(fetch(page))
        except (urllib.error.URLError, OSError) as e:
            errors.append(f"{page}: {e}")
    print(f"Found {len(urls)} candidate product links.")

    results = []
    for url in sorted(urls):
        try:
            html = fetch(url)
        except (urllib.error.URLError, OSError) as e:
            errors.append(f"{url}: {e}")
            continue
        title = title_of(html)
        explicit = url in EXTRA_PRODUCTS
        if not explicit and not (
            (WANT.search(title) or WANT.search(url))
            and (IS_CONSOLE.search(title) or IS_CONSOLE.search(url))
            and not NOT_CONSOLE.search(title)
        ):
            continue
        results.append((title or url, url, availability(html)))

    for title, url, av in results:
        print(f"[{'IN STOCK' if av else 'out' if av is False else '?'}] {title} - {url}")

    if not results:
        print("No PS5 console products found - blocked or layout changed.", file=sys.stderr)
        for e in errors:
            print("  error:", e, file=sys.stderr)
        return 1

    in_stock = [(t, u) for t, u, av in results if av]
    if in_stock and not dry:
        notify(
            "PS5 in stock at Smyths IE!",
            "\n".join(f"{t}\n{u}" for t, u in in_stock),
            click=in_stock[0][1],
            priority="urgent",
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
