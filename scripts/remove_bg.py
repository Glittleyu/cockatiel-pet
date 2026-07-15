from PIL import Image
import os
import sys


def remove_solid_background(input_path, output_path, threshold=30):
    """去除图片的纯色背景，保留主体。
    通过四个角采样背景色，再用颜色距离阈值将背景设为透明。
    """
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()

    # 采样四个角的背景色
    corners = [
        pixels[0, 0],
        pixels[width - 1, 0],
        pixels[0, height - 1],
        pixels[width - 1, height - 1],
    ]

    # 取平均背景色
    bg_r = sum(c[0] for c in corners) // 4
    bg_g = sum(c[1] for c in corners) // 4
    bg_b = sum(c[2] for c in corners) // 4

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            # 计算与背景色的欧氏距离
            dist = ((r - bg_r) ** 2 + (g - bg_g) ** 2 + (b - bg_b) ** 2) ** 0.5
            if dist < threshold:
                # 背景色设为完全透明
                pixels[x, y] = (r, g, b, 0)
            else:
                # 保留原透明度（处理边缘半透明）
                # 对于边缘像素，根据距离降低透明度，实现平滑过渡
                if dist < threshold + 20:
                    alpha = int((1 - (dist - threshold) / 20) * 255)
                    pixels[x, y] = (r, g, b, alpha)

    img.save(output_path)
    print(f"Saved: {output_path}")


def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    raw_dir = os.path.join(base_dir, "assets", "raw")
    out_dir = os.path.join(base_dir, "assets")
    os.makedirs(out_dir, exist_ok=True)

    mappings = [
        ("cute.png", "idle.png"),
        ("eat.png", "eat.png"),
        ("sleep.png", "sleep.png"),
    ]

    for src, dst in mappings:
        input_path = os.path.join(raw_dir, src)
        output_path = os.path.join(out_dir, dst)
        if not os.path.exists(input_path):
            print(f"Missing: {input_path}")
            continue
        remove_solid_background(input_path, output_path)


if __name__ == "__main__":
    main()
