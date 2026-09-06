from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "周年ガチャ_メイド向け運用フロー.pdf"

INK = HexColor("#243A37")
PINK = HexColor("#D83D73")
PINK_LIGHT = HexColor("#FDEAF1")
GREEN = HexColor("#2F6B61")
GREEN_LIGHT = HexColor("#EAF5F1")
GOLD = HexColor("#C18A25")
GOLD_LIGHT = HexColor("#FBF2D2")
GRAY = HexColor("#D9D9D9")
GRAY_LIGHT = HexColor("#F4F6F5")
RED_LIGHT = HexColor("#FBEAEC")


def register_fonts():
    pdfmetrics.registerFont(TTFont("BIZUD", r"C:\Windows\Fonts\BIZ-UDGothicR.ttc", subfontIndex=0))
    pdfmetrics.registerFont(TTFont("BIZUDB", r"C:\Windows\Fonts\BIZ-UDGothicB.ttc", subfontIndex=0))


def text(c, x, y, value, size=10, color=INK, bold=False, align="center"):
    c.setFillColor(color)
    c.setFont("BIZUDB" if bold else "BIZUD", size)
    if align == "left":
        c.drawString(x, y, value)
    elif align == "right":
        c.drawRightString(x, y, value)
    else:
        c.drawCentredString(x, y, value)


def multiline(c, x, y, lines, size=9, color=INK, bold_first=True, leading=14):
    for index, line in enumerate(lines):
        text(c, x, y - index * leading, line, size=size, color=color, bold=bold_first and index == 0)


def rounded_box(c, x, y, w, h, fill, stroke, lines, size=9, text_color=INK, radius=7, leading=14):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1.2)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)
    total = (len(lines) - 1) * leading
    baseline = y + h / 2 + total / 2 - size * 0.35
    multiline(c, x + w / 2, baseline, lines, size=size, color=text_color, leading=leading)


def diamond(c, cx, cy, w, h, fill, stroke, label, size=10):
    path = c.beginPath()
    path.moveTo(cx, cy + h / 2)
    path.lineTo(cx + w / 2, cy)
    path.lineTo(cx, cy - h / 2)
    path.lineTo(cx - w / 2, cy)
    path.close()
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1.3)
    c.drawPath(path, fill=1, stroke=1)
    text(c, cx, cy - size * 0.34, label, size=size, bold=True)


def arrow(c, x1, y1, x2, y2, color=GREEN):
    c.setStrokeColor(color)
    c.setLineWidth(1.6)
    c.line(x1, y1, x2, y2)
    angle = 5
    if abs(y2 - y1) >= abs(x2 - x1):
        direction = -1 if y2 < y1 else 1
        c.line(x2, y2, x2 - angle, y2 - direction * angle)
        c.line(x2, y2, x2 + angle, y2 - direction * angle)
    else:
        direction = 1 if x2 > x1 else -1
        c.line(x2, y2, x2 - direction * angle, y2 - angle)
        c.line(x2, y2, x2 - direction * angle, y2 + angle)


def build_pdf():
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    width, _ = A4
    c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    c.setTitle("周年ガチャ 店頭対応フロー")
    c.setAuthor("PO TORO")

    text(c, width / 2, 808, "周年ガチャ 店頭対応フロー", size=21, color=HexColor("#000000"), bold=True)
    text(c, width / 2, 784, "ご主人様の受付から終了まで、この順番で操作してください", size=9.5, color=GREEN, bold=True)

    checks = [
        ("営業前 1", "iPadを縦向きにする"),
        ("営業前 2", "音量とBGMを確認する"),
        ("営業前 3", "会員受付キーを確認する"),
    ]
    x0, gap, box_w = 28, 7, 175
    for index, (heading, detail) in enumerate(checks):
        x = x0 + index * (box_w + gap)
        rounded_box(c, x, 727, box_w, 40, GRAY_LIGHT, GRAY, [heading, detail], size=8, leading=12, radius=5)

    arrow(c, width / 2, 726, width / 2, 713)
    rounded_box(c, 87, 676, 421, 32, PINK, PINK, ["1回 1,000円を確認して  ガチャを回す をタップ"], size=11, text_color=white)
    arrow(c, width / 2, 676, width / 2, 660)
    diamond(c, width / 2, 638, 340, 42, GOLD_LIGHT, GOLD, "ポトロパスポートをお持ちですか？", size=11)

    left_x, right_x, branch_w = 31, 307, 257
    arrow(c, 211, 624, 160, 596, PINK)
    arrow(c, 384, 624, 435, 596, GREEN)
    text(c, 165, 607, "持っている", size=8.5, color=PINK, bold=True)
    text(c, 430, 607, "持っていない", size=8.5, color=GREEN, bold=True)
    rounded_box(c, left_x, 492, branch_w, 98, PINK_LIGHT, PINK, ["会員のご主人様", "カメラで会員証QRを読み取る", "名前と会員番号を確認", "このご主人様で回す をタップ"], size=8.7, leading=16)
    rounded_box(c, right_x, 492, branch_w, 98, GREEN_LIGHT, GREEN, ["非会員のご主人様", "お名前を入力する", "この名前で回す をタップ", "結果はガチャ結果シートへ記録"], size=8.7, leading=16)

    arrow(c, 160, 492, 260, 467, PINK)
    arrow(c, 435, 492, 335, 467, GREEN)
    rounded_box(c, 87, 428, 421, 34, GOLD, GOLD, ["ガチャ演出  →  当選アクキーを確認"], size=11, text_color=white)
    text(c, width / 2, 413, "会員の当選はグッズ管理とパスポートへ自動記録", size=8, color=INK)
    arrow(c, width / 2, 407, width / 2, 390)
    diamond(c, width / 2, 368, 280, 38, GOLD_LIGHT, GOLD, "続けて回しますか？", size=10.5)

    arrow(c, 227, 357, 160, 332, PINK)
    arrow(c, 368, 357, 435, 332, GREEN)
    rounded_box(c, left_x, 231, branch_w, 96, PINK_LIGHT, PINK, ["同じご主人様が続ける", "次の1回分を確認", "同じご主人様がもう一度", "ガチャを回す をタップ", "受付なしで次の抽選へ"], size=8.5, leading=14)
    rounded_box(c, right_x, 231, branch_w, 96, GREEN_LIGHT, GREEN, ["終了する", "終了する をタップ", "名前・会員情報・画面履歴をリセット", "最初の受付画面へ戻る"], size=8.5, leading=16)

    text(c, 28, 207, "困ったとき", size=10.5, color=HexColor("#000000"), bold=True, align="left")
    rounded_box(c, 28, 168, 145, 29, RED_LIGHT, HexColor("#C76570"), ["カメラが開かない"], size=8.5)
    rounded_box(c, 180, 168, 387, 29, white, GRAY, ["Safariのカメラ許可とHTTPSのURLを確認"], size=8.5)
    rounded_box(c, 28, 132, 145, 29, RED_LIGHT, HexColor("#C76570"), ["未送信ログがある"], size=8.5)
    rounded_box(c, 180, 132, 387, 29, white, GRAY, ["タイトルを5回タップ → 管理者設定 → 未送信ログを再送"], size=8.3)

    c.setStrokeColor(GRAY)
    c.setLineWidth(0.7)
    c.line(28, 112, 567, 112)
    text(c, width / 2, 92, "注意  演出中は連打しない  ／  終了時は必ず 終了する をタップ", size=8.4, bold=True)
    text(c, width / 2, 76, "未送信ログは 終了する を押しても消えません", size=8, color=GREEN, bold=True)
    text(c, 567, 38, "周年イベント 店頭スタッフ用", size=7.3, color=HexColor("#6B7D78"), align="right")

    c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()
