from PIL import Image, ImageFilter
import cv2
import numpy as np
import os


def remove_solid_background(input_path, output_path, lo_diff=30, up_diff=30):
    """去除图片的纯色背景，保留主体细节（如鼻子/喙部/腮红内部）。

    算法：
    1. 使用 OpenCV floodFill 从四个角填充背景，只填充与角落相连的区域
    2. 主体内部的浅色区域（如脸颊腮红）不会被填充，因为它不与背景连通
    3. 使用形态学 MinFilter 去除主体边缘残留的背景噪点
    4. 边缘像素做 alpha 渐变，使过渡更平滑
    """
    # 读取原图，保留 alpha
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    img_array = np.array(img)
    bgr = cv2.cvtColor(img_array, cv2.COLOR_RGBA2BGR)
    alpha = img_array[:, :, 3].astype(np.float32)

    # 初始化 mask（比原图大 2 像素）
    mask = np.zeros((height + 2, width + 2), np.uint8)

    corners = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    for x, y in corners:
        cv2.floodFill(
            bgr,
            mask,
            seedPoint=(x, y),
            newVal=(0, 0, 0),
            loDiff=(lo_diff, lo_diff, lo_diff),
            upDiff=(up_diff, up_diff, up_diff),
            flags=4 | cv2.FLOODFILL_FIXED_RANGE | cv2.FLOODFILL_MASK_ONLY,
        )

    # mask 中填充过的背景区域为 255（去掉外圈的 padding）
    bg_mask = mask[1:-1, 1:-1] > 0

    # 形态学：对前景做 closing（先膨胀后腐蚀），填补主体内部被 floodFill 误入的小洞
    fg_mask = ~bg_mask
    fg_img = Image.fromarray((fg_mask * 255).astype(np.uint8))
    fg_img = fg_img.filter(ImageFilter.MaxFilter(3))  # 膨胀前景
    fg_img = fg_img.filter(ImageFilter.MinFilter(3))  # 腐蚀前景
    bg_mask = np.array(fg_img) < 128

    # 再轻微腐蚀背景，去除主体边缘附着的少量背景噪点
    mask_img = Image.fromarray((bg_mask * 255).astype(np.uint8))
    mask_img = mask_img.filter(ImageFilter.MinFilter(3))
    bg_mask = np.array(mask_img) > 128

    # 背景透明
    new_alpha = alpha.copy()
    new_alpha[bg_mask] = 0

    # 计算到背景色的距离，用于边缘渐变
    corners = [img.getpixel((0, 0)), img.getpixel((width - 1, 0)),
               img.getpixel((0, height - 1)), img.getpixel((width - 1, height - 1))]
    bg_color = tuple(int(sum(c[i] for c in corners) / 4) for i in range(3))
    rgb = img_array[:, :, :3].astype(np.float32)
    diff = np.sqrt(np.sum((rgb - bg_color) ** 2, axis=2))

    # 边缘渐变：lo_diff ~ lo_diff+25 之间的像素做 alpha 过渡
    edge_mask = (~bg_mask) & (diff >= lo_diff) & (diff < lo_diff + 25)
    factor = (diff[edge_mask] - lo_diff) / 25
    new_alpha[edge_mask] = (new_alpha[edge_mask] * factor).astype(np.float32)

    img_array[:, :, 3] = new_alpha.astype(np.uint8)
    result = Image.fromarray(img_array)
    result.save(output_path)
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
