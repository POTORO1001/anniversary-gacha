from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "周年ガチャ_メイド向け運用フロー.pdf"
PAGE_SIZE = (170 * mm, 240 * mm)

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


def step_label(c, x, y, number, label, color):
    c.setFillColor(color)
    c.circle(x, y, 10, fill=1, stroke=0)
    text(c, x, y - 3.4, str(number), size=9, color=white, bold=True)
    text(c, x + 17, y - 3.4, label, size=10, color=color, bold=True, align="left")


def branch_card(c, x, y, w, h, fill, stroke, title, steps, button_label, button_size=8.5):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1.2)
    c.roundRect(x, y, w, h, 7, fill=1, stroke=1)
    text(c, x + w / 2, y + h - 20, title, size=10.5, color=stroke, bold=True)
    for index, line in enumerate(steps):
        text(c, x + 13, y + h - 40 - index * 16, line, size=8.3, align="left")
    button_y = y + 10
    c.setFillColor(white)
    c.setStrokeColor(stroke)
    c.roundRect(x + 10, button_y, w - 20, 23, 5, fill=1, stroke=1)
    text(c, x + w / 2, button_y + 7.2, button_label, size=button_size, color=stroke, bold=True)


def build_pdf():
    register_fonts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    width, height = PAGE_SIZE
    c = canvas.Canvas(str(OUTPUT), pagesize=PAGE_SIZE, pageCompression=1)
    c.setTitle("周年ガチャオペレーション")
    c.setAuthor("PO TORO")

    text(c, width / 2, height - 31, "周年ガチャオペレーション", size=18.5, color=HexColor("#111111"), bold=True)
    text(c, width / 2, height - 48, "店頭スタッフ用", size=7.5, color=HexColor("#6B7D78"), bold=True)

    c.setFillColor(PINK_LIGHT)
    c.setStrokeColor(PINK)
    c.setLineWidth(1.4)
    c.roundRect(63, height - 91, width - 126, 29, 6, fill=1, stroke=1)
    text(c, width / 2, height - 81, "料金：ガチャ1回　1,000円", size=14.5, color=PINK, bold=True)

    step_label(c, 32, height - 115, 1, "会計後、ガチャを開始", PINK)
    rounded_box(c, 30, height - 160, width - 60, 32, PINK, PINK, ["「ガチャを回す」をタップ"], size=11, text_color=white)
    arrow(c, width / 2, height - 160, width / 2, height - 174)

    step_label(c, 32, height - 192, 2, "ポトロパスポートを確認", GOLD)
    diamond(c, width / 2, height - 224, width - 105, 39, GOLD_LIGHT, GOLD, "ポトロパスポートはありますか？", size=10.5)

    left_x, gap, branch_w = 18, 14, (width - 50) / 2
    right_x = left_x + branch_w + gap
    arrow(c, width / 2 - 57, height - 236, left_x + branch_w / 2, height - 256, PINK)
    arrow(c, width / 2 + 57, height - 236, right_x + branch_w / 2, height - 256, GREEN)
    text(c, left_x + branch_w / 2, height - 251, "ある", size=8.5, color=PINK, bold=True)
    text(c, right_x + branch_w / 2, height - 251, "ない", size=8.5, color=GREEN, bold=True)
    branch_card(c, left_x, height - 353, branch_w, 91, PINK_LIGHT, PINK, "会員のご主人様", ["1  カメラでQRを読み取る", "2  名前・会員番号を確認"], "このご主人様で回す")
    branch_card(c, right_x, height - 353, branch_w, 91, GREEN_LIGHT, GREEN, "非会員のご主人様", ["1  お名前を入力する"], "この名前で回す")

    arrow(c, left_x + branch_w / 2, height - 353, width / 2 - 38, height - 369, PINK)
    arrow(c, right_x + branch_w / 2, height - 353, width / 2 + 38, height - 369, GREEN)
    step_label(c, 32, height - 382, 3, "ガチャ演出と結果確認", GOLD)
    rounded_box(c, 30, height - 424, width - 60, 31, GOLD, GOLD, ["ガチャ演出  →  当選アクキーを確認"], size=10.5, text_color=white)
    arrow(c, width / 2, height - 424, width / 2, height - 438)

    step_label(c, 32, height - 456, 4, "続けるか終了するかを選択", GREEN)
    diamond(c, width / 2, height - 484, width - 150, 36, GOLD_LIGHT, GOLD, "続けて回しますか？", size=10.5)
    arrow(c, width / 2 - 48, height - 494, left_x + branch_w / 2, height - 516, PINK)
    arrow(c, width / 2 + 48, height - 494, right_x + branch_w / 2, height - 516, GREEN)
    branch_card(c, left_x, height - 603, branch_w, 81, PINK_LIGHT, PINK, "同じご主人様が続ける", ["1  次の1回分の料金を頂戴する"], "同じご主人様がもう一度ガチャを回す", button_size=6.8)
    branch_card(c, right_x, height - 603, branch_w, 81, GREEN_LIGHT, GREEN, "終了する", ["最初の受付画面へ戻る"], "終了する", button_size=9)

    notice_y = 10
    notice_h = 60
    c.setFillColor(RED_LIGHT)
    c.setStrokeColor(PINK)
    c.setLineWidth(1.2)
    c.roundRect(18, notice_y, width - 36, notice_h, 6, fill=1, stroke=1)
    text(c, 31, notice_y + notice_h - 17, "重要", size=10.5, color=PINK, bold=True, align="left")
    text(c, 31, notice_y + 31, "・ガチャを回す際は必ずメイドさんが立ち会うこと", size=8.2, bold=True, align="left")
    text(c, 31, notice_y + 17, "・演出中は連打しない ／ 終了時は必ず「終了する」をタップ", size=8.2, bold=True, align="left")
    text(c, 31, notice_y + 3, "・分からないことがあればおうまさんに確認", size=8.2, bold=True, align="left")

    c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()
