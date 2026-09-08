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
    c.setTitle("周年ガチャオペレーション")
    c.setAuthor("PO TORO")

    text(c, width / 2, 808, "周年ガチャオペレーション", size=21, color=HexColor("#000000"), bold=True)
    text(c, width / 2, 772, "料金：ガチャ1回　1,000円", size=16, color=PINK, bold=True)

    rounded_box(c, 72, 724, 451, 38, PINK, PINK, ["会計を済ませてからガチャを回すをタップ"], size=12, text_color=white)
    arrow(c, width / 2, 724, width / 2, 706)
    diamond(c, width / 2, 682, 360, 44, GOLD_LIGHT, GOLD, "ポトロパスポートをお持ちですか？", size=12)

    left_x, right_x, branch_w = 31, 307, 257
    arrow(c, 211, 668, 160, 638, PINK)
    arrow(c, 384, 668, 435, 638, GREEN)
    text(c, 164, 647, "持っている", size=9.5, color=PINK, bold=True)
    text(c, 431, 647, "持っていない", size=9.5, color=GREEN, bold=True)
    rounded_box(c, left_x, 500, branch_w, 130, PINK_LIGHT, PINK, ["会員のご主人様", "カメラで会員証QRを読み取る", "名前と会員番号を確認", "このご主人様で回す をタップ"], size=10, leading=22)
    rounded_box(c, right_x, 500, branch_w, 130, GREEN_LIGHT, GREEN, ["非会員のご主人様", "お名前を入力する", "この名前で回す をタップ"], size=10, leading=24)

    arrow(c, 160, 500, 260, 472, PINK)
    arrow(c, 435, 500, 335, 472, GREEN)
    rounded_box(c, 72, 430, 451, 36, GOLD, GOLD, ["ガチャ演出  →  当選アクキーを確認"], size=12, text_color=white)
    arrow(c, width / 2, 430, width / 2, 409)
    diamond(c, width / 2, 385, 300, 44, GOLD_LIGHT, GOLD, "続けて回しますか？", size=11.5)

    arrow(c, 227, 373, 160, 328, PINK)
    arrow(c, 368, 373, 435, 328, GREEN)
    rounded_box(c, left_x, 190, branch_w, 130, PINK_LIGHT, PINK, ["同じご主人様が続ける", "次の1回分の料金を頂戴する", "「同じご主人様がもう一度ガチャを回す」をタップ", "受付なしで次の抽選へ"], size=8.7, leading=23)
    rounded_box(c, right_x, 190, branch_w, 130, GREEN_LIGHT, GREEN, ["終了する", "終了する をタップ", "最初の受付画面へ戻る"], size=10, leading=27)

    c.setStrokeColor(GRAY)
    c.setLineWidth(0.7)
    c.line(28, 165, 567, 165)
    text(c, 52, 145, "注意", size=12, color=PINK, bold=True, align="left")
    text(c, 68, 123, "・ガチャを回す際は必ずメイドさんが立ち会うこと", size=10, bold=True, align="left")
    text(c, 68, 101, "・演出中は連打しない　／　終了時は必ず「終了する」をタップ", size=10, bold=True, align="left")
    text(c, 68, 79, "・分からないことがあればおうまさんに確認", size=10, bold=True, align="left")
    text(c, 567, 38, "周年イベント 店頭スタッフ用", size=7.3, color=HexColor("#6B7D78"), align="right")

    c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()
