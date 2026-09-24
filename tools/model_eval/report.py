#!/usr/bin/env python3
"""Build a portable, offline image comparison report from an evaluation run."""

import argparse
import html
import json
import re
import statistics
from pathlib import Path

from PIL import Image, ImageOps


HERE = Path(__file__).resolve().parent
SAFE_KEY = re.compile(r"^[a-z0-9_-]+$")
TYPE_LABELS = {
    "corner_text": "角落小字",
    "semi_transparent": "半透明文字",
    "large_logo": "大块标识",
    "central_text": "中央文字",
}
MODE_LABELS = {"direct": "直接编辑", "bbox": "指定区域"}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def parse_prices(values):
    prices = {}
    for value in values:
        key, separator, amount = value.partition("=")
        if not separator or not SAFE_KEY.fullmatch(key):
            raise ValueError(f"单价格式应为 model=amount：{value}")
        price = float(amount)
        if price < 0:
            raise ValueError(f"单价不能为负数：{value}")
        prices[key] = price
    return prices


def source_file(base: Path, name: str):
    """Resolve a manifest path without allowing it to escape its root."""
    path = (base / name).resolve()
    if not path.is_relative_to(base.resolve()) or not path.is_file():
        raise ValueError(f"样本文件不存在或超出目录：{name}")
    return path


def output_file(root: Path, row: dict):
    if row.get("output_path"):
        candidate = (root / row["output_path"]).resolve()
        if not candidate.is_relative_to(root.resolve()):
            raise ValueError("输出路径超出结果目录")
        return candidate
    key = f"{row['sample']}-{row['model']}-{row['mode']}"
    for candidate in (
        root / key / "ark-gen.png",  # stage 0 Ark CLI layout
        root / "outputs" / f"{key}.png",  # reusable runner layout
        root / "outputs" / f"{key}.jpg",
    ):
        if candidate.is_file():
            return candidate
    return root / key / "ark-gen.png"


def save_preview(source: Path, target: Path):
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert("RGB")
        image.thumbnail((960, 960), Image.Resampling.LANCZOS)
        image.save(target, "JPEG", quality=78, optimize=True, progressive=True)


def median(values):
    numbers = [value for value in values if isinstance(value, (int, float))]
    return round(statistics.median(numbers), 2) if numbers else None


def build(args):
    manifest_path = args.manifest.resolve()
    evaluation_path = args.evaluation.resolve()
    results_dir = args.results_dir.resolve()
    destination = args.output_dir.resolve()
    if (destination / "index.html").exists():
        raise ValueError(f"报告已存在：{destination / 'index.html'}；请使用新目录")
    if not results_dir.is_dir():
        raise ValueError(f"结果目录不存在：{results_dir}")

    samples = read_json(manifest_path)
    evaluation = read_json(evaluation_path)
    notes = read_json(args.notes) if args.notes else {}
    prices = dict(evaluation.get("prices_cny", {}))
    prices.update(parse_prices(args.price))
    rows = evaluation["results"]
    models = list(evaluation["request"]["models"])
    modes = evaluation.get("modes") or list(dict.fromkeys(row["mode"] for row in rows))
    for key in models + modes:
        if not SAFE_KEY.fullmatch(key):
            raise ValueError(f"模型或模式键仅允许小写字母、数字、_、-：{key}")
    if len({sample["id"] for sample in samples}) != len(samples):
        raise ValueError("样本 ID 重复")

    row_by_key = {}
    for row in rows:
        key = (row["sample"], row["model"], row["mode"])
        if key in row_by_key:
            raise ValueError(f"重复结果：{key}")
        row_by_key[key] = row

    destination.mkdir(parents=True, exist_ok=True)
    asset_dir = destination / "assets"
    cases = []
    for sample in samples:
        sample_id = sample["id"]
        if not SAFE_KEY.fullmatch(sample_id):
            raise ValueError(f"无效样本 ID：{sample_id}")
        before = f"assets/{sample_id}-before.jpg"
        clean = f"assets/{sample_id}-clean.jpg"
        save_preview(source_file(manifest_path.parent, sample["marked"]), destination / before)
        save_preview(source_file(manifest_path.parent, sample["clean"]), destination / clean)
        variants = {}
        for model in models:
            for mode in modes:
                row = row_by_key.get((sample_id, model, mode))
                if not row:
                    continue
                variant = {key: row.get(key) for key in
                           ("status", "latency_seconds", "outside_mae", "target_improvement", "error")}
                variant["image"] = None
                if row.get("status") == "succeeded":
                    original = output_file(results_dir, row)
                    if not original.is_file():
                        raise ValueError(f"成功结果缺少图片：{sample_id} / {model} / {mode}")
                    image_name = f"assets/{sample_id}-{model}-{mode}.jpg"
                    save_preview(original, destination / image_name)
                    variant["image"] = image_name
                variants[f"{model}:{mode}"] = variant
        cases.append({
            "id": sample_id,
            "type": sample["watermark_type"],
            "typeLabel": TYPE_LABELS.get(sample["watermark_type"], sample["watermark_type"]),
            "sourceTitle": sample.get("source_title", ""),
            "sourcePage": sample.get("source_page", ""),
            "license": sample.get("license", ""),
            "before": before,
            "clean": clean,
            "variants": variants,
            "note": notes.get("sample_notes", {}).get(sample_id, ""),
        })

    summaries = []
    for model in models:
        for mode in modes:
            subset = [row for row in rows if row["model"] == model and row["mode"] == mode]
            successes = [row for row in subset if row.get("status") == "succeeded"]
            summaries.append({
                "model": model,
                "mode": mode,
                "total": len(samples),
                "success": len(successes),
                "latency": median(row.get("latency_seconds") for row in successes),
                "outsideMae": median(row.get("outside_mae") for row in successes),
                "catalogCost": round(len(successes) * prices[model], 2) if model in prices else None,
            })

    data = {
        "title": notes.get("title", "图像去水印模型对照"),
        "subtitle": notes.get("subtitle", "相同样本、相同输出规格，对照直接编辑与指定区域编辑。"),
        "date": evaluation.get("date", ""),
        "sampleCount": len(samples),
        "resultCount": len(rows),
        "successCount": sum(row.get("status") == "succeeded" for row in rows),
        "models": models,
        "modelLabels": notes.get("model_labels", {}),
        "modes": modes,
        "modeLabels": MODE_LABELS,
        "summaries": summaries,
        "cases": cases,
        "findings": notes.get("findings", []),
        "methodNote": notes.get("method_note", "像素差用于辅助筛查，最终仍需目视检查水印残留与非目标区域。"),
        "costNote": notes.get("cost_note", "费用为输出张数乘目录单价的估算，实际账单以账号结算为准。"),
        "defaultVariant": notes.get("default_variant", f"{models[0]}:{modes[0]}"),
    }
    if data["defaultVariant"] not in {f"{model}:{mode}" for model in models for mode in modes}:
        raise ValueError("default_variant 不在模型和模式组合中")

    template = (HERE / "template.html").read_text(encoding="utf-8")
    css = (HERE / "report.css").read_text(encoding="utf-8")
    js = (HERE / "report.js").read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    document = (template.replace("__TITLE__", html.escape(data["title"]))
                .replace("__CSS__", css)
                .replace("__DATA__", payload)
                .replace("__JS__", js))
    (destination / "index.html").write_text(document, encoding="utf-8")
    print(f"报告：{destination / 'index.html'}")
    print(f"样本 {len(samples)} 张，结果 {len(rows)} 条，成功 {data['successCount']} 条")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--evaluation", required=True, type=Path)
    parser.add_argument("--results-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--notes", type=Path, help="人工结论与重点样本说明 JSON")
    parser.add_argument("--price", action="append", default=[], help="目录价，格式 model=元/输出图")
    args = parser.parse_args()
    try:
        build(args)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
