#!/usr/bin/env python
"""把任意投影的行星遥感 GeoTIFF 转成 Three.js 可用的等距圆柱贴图。

为什么需要这个脚本（对应 docs/06_资源引用.md 的"处理步骤"）：
USGS / PDS 发布的全球拼图多为 "Simple Cylindrical"（可直接用）、
Mercator、Polar Stereographic 或 Sinusoidal 投影；只有后几种才需要重投影，
而它们的官方预览图往往只有 1024px 甚至没有。本脚本用 rasterio（内置 GDAL）
把它们统一到 2:1 等距圆柱，并输出 1024×512 / 2048×1024 的 JPEG。

用法：
  python scripts/tif-to-equirect.py <input.tif> --out <output.jpg> [--width 1024]
  python scripts/tif-to-equirect.py <input.tif> --info        # 只看元数据

约定：
- 输出经度 0° 在左边缘、纬度 +90° 在上边缘（与 three.js SphereGeometry 的 UV 一致）；
- 无观测区（nodata）按**有效像元均值**填充，不做纹理修复、不补造地貌；
- 已经是等距圆柱（地理坐标）的输入直接重采样，不做多余重投影。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.warp import reproject

DEFAULT_RADIUS = 6378137.0


def body_radius(crs: CRS | None) -> tuple[float, bool]:
    """从 CRS 中取天体半径（米）。返回 (半径, 是否真实取到)。"""
    if crs is None:
        return DEFAULT_RADIUS, False
    params = crs.to_dict()
    for key in ("R", "a"):
        value = params.get(key)
        if isinstance(value, (int, float)) and value > 0:
            return float(value), True
    # 部分产品把半径写在 proj 字符串里，退化为解析
    text = crs.to_proj4() or ""
    for token in text.replace("=", " ").split():
        try:
            value = float(token)
        except ValueError:
            continue
        if 1e6 < value < 1e8:
            return value, True
    return DEFAULT_RADIUS, False


def to_rgb(data: np.ndarray, mask: np.ndarray | None) -> np.ndarray:
    """把任意波段数压成 HxWx3 的 uint8，并返回有效掩膜。"""
    if data.ndim == 2:
        data = data[None, :, :]
    bands, height, width = data.shape
    if bands >= 3:
        rgb = np.stack([data[0], data[1], data[2]], axis=-1)
    else:
        rgb = np.repeat(data[0][:, :, None], 3, axis=2)

    valid = np.isfinite(rgb).all(axis=2)
    if mask is not None and mask.shape == (height, width):
        valid &= mask > 0

    finite = np.where(valid[:, :, None], rgb, np.nan)
    with np.errstate(invalid="ignore"):
        mean = np.nanmean(finite.reshape(-1, 3), axis=0)
    mean = np.where(np.isfinite(mean), mean, 0.0)
    rgb = np.where(valid[:, :, None], rgb, mean[None, None, :])

    # 归一化到 0-255：8bit 产品原样，浮点产品按 2%-98% 分位拉伸
    peak = float(np.nanmax(rgb)) if np.isfinite(rgb).any() else 0.0
    if peak <= 1.5:
        rgb = rgb * 255.0
    elif rgb.dtype != np.uint8 and peak > 255.5:
        lo, hi = np.nanpercentile(rgb, 2), np.nanpercentile(rgb, 98)
        if hi > lo:
            rgb = (rgb - lo) / (hi - lo) * 255.0
    return np.clip(rgb, 0, 255).astype(np.uint8)


def convert(src_path: Path, out_path: Path, width: int, quality: int) -> dict:
    with rasterio.open(src_path) as src:
        radius, radius_known = body_radius(src.crs)
        geographic = bool(src.crs) and src.crs.is_geographic
        bounds = tuple(src.bounds)

        if geographic:
            out_h = max(2, round(src.height * width / src.width))
            data = src.read(out_shape=(src.count, out_h, width), resampling=Resampling.cubic)
            mask = src.read_masks(1, out_shape=(out_h, width), resampling=Resampling.nearest)
            if src.nodata is None and mask.min() == 255:
                mask = None
            if out_h != width // 2:
                # 非 2:1 的地理产品（如 Titan 近全球拼图）居中放进 2:1 画布，
                # 空带用 NaN 占位，最终按有效像元均值填充（不补造地貌）
                canvas = np.full((src.count, width // 2, width), np.nan, dtype="float32")
                top = (width // 2 - out_h) // 2
                canvas[:, top:top + out_h, :] = data
                valid_mask = np.zeros((width // 2, width), dtype="uint8")
                valid_mask[top:top + out_h, :] = mask if mask is not None else 255
                data, mask = canvas, valid_mask
            method = "geographic-resample"
        else:
            dst_crs = CRS.from_proj4(f"+proj=longlat +R={radius} +no_defs")
            dst = np.zeros((3, width // 2, width), dtype="float32")
            reproject(
                source=rasterio.band(src, list(range(1, min(src.count, 3) + 1))),
                destination=dst,
                src_transform=src.transform,
                src_crs=src.crs,
                src_nodata=src.nodata,
                dst_transform=rasterio.transform.from_bounds(-180, -90, 180, 90, width, width // 2),
                dst_crs=dst_crs,
                dst_nodata=np.nan,
                resampling=Resampling.cubic,
            )
            data = dst
            mask = np.isfinite(dst).any(axis=0)
            method = f"warp-from-projected(radius={radius:.0f})"

        rgb = to_rgb(data, mask)
        height = rgb.shape[0]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb, mode="RGB").save(out_path, "JPEG", quality=quality, optimize=True)

    return {
        "input": str(src_path),
        "output": str(out_path),
        "method": method,
        "radius_known": radius_known,
        "size": [rgb.shape[1], height],
        "bounds": [round(v, 4) for v in bounds],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="GeoTIFF → 2:1 等距圆柱 JPEG")
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--width", type=int, default=1024, help="输出宽度（高度自动为一半）")
    parser.add_argument("--quality", type=int, default=88)
    parser.add_argument("--info", action="store_true", help="只打印元数据")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"找不到输入文件：{args.input}", file=sys.stderr)
        return 1

    with rasterio.open(args.input) as src:
        radius, known = body_radius(src.crs)
        info = {
            "size": [src.width, src.height],
            "bands": src.count,
            "dtype": src.dtypes[0],
            "crs": src.crs.to_string() if src.crs else None,
            "projection": (src.crs.to_dict().get("proj") if src.crs else None),
            "geographic": bool(src.crs) and src.crs.is_geographic,
            "body_radius_m": radius if known else None,
            "nodata": src.nodata,
        }
        print(json.dumps(info, indent=2, ensure_ascii=False))
        if args.info:
            return 0

    if not args.out:
        print("需要 --out 指定输出文件", file=sys.stderr)
        return 2

    result = convert(args.input, args.out, args.width, args.quality)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
