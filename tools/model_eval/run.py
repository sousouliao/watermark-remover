#!/usr/bin/env python3
"""Run a bounded Ark image-edit comparison against a licensed sample manifest."""

import argparse
import concurrent.futures
import hashlib
import json
import math
import os
import re
import shutil
import statistics
import subprocess
import threading
import time
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps, ImageStat


KEY = re.compile(r"^[a-z0-9_-]+$")
STOP_WORDS = ("unauthorized", "accessdenied", "invalidapikey", "quota", "rate limit", "429")


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def command(args, timeout=30):
    environment = dict(os.environ)
    environment["ARKCLI_NO_UPDATE_NOTIFIER"] = "1"
    if caller := environment.get("MODEL_EVAL_CALLER_NAME"):
        environment.update(ARKCLI_CALLER_TYPE="ai_agent", ARKCLI_CALLER_NAME=caller,
                           ARKCLI_SKILL_NAME="arkcli-gen")
    return subprocess.run(args, env=environment, text=True, capture_output=True, timeout=timeout)


def preflight(config):
    status = command(["arkcli", "auth", "status", "--format", "json"])
    if status.returncode or not json.loads(status.stdout).get("logged_in"):
        raise ValueError("Ark CLI 未登录或凭证失效；先完成认证")
    required = {"model", "prompt", "image", "size", "output_format", "watermark"}
    for model, endpoint in config["request"]["models"].items():
        resolved = command(["arkcli", "resources", "resolve", endpoint, "--format", "json"])
        if resolved.returncode:
            raise ValueError(f"接入点无法解析：{model}")
        metadata = json.loads(resolved.stdout)
        if (metadata.get("endpoint_status") != "Running"
                or metadata.get("generation_modality") != "image"
                or "image" not in metadata.get("input_modalities", [])
                or "gen" not in metadata.get("supported_workflows", [])):
            raise ValueError(f"接入点未运行或不是图片生成：{model}")
        model_id = metadata.get("model_id")
        if not model_id:
            raise ValueError(f"接入点缺少绑定模型：{model}")
        params = command(["arkcli", "models", "get", model_id,
                          "--transform", "supported_params", "--format", "json"])
        if params.returncode:
            raise ValueError(f"无法查询模型参数：{model}")
        supported = {item["name"] for item in json.loads(params.stdout) if item.get("support") is True}
        if missing := required - supported:
            raise ValueError(f"{model} 缺少参数能力：{', '.join(sorted(missing))}")


def validate(manifest, config):
    request = config["request"]
    if not manifest or len({item["id"] for item in manifest}) != len(manifest):
        raise ValueError("样本为空或 ID 重复")
    if not request.get("models") or not config.get("prices_cny"):
        raise ValueError("请配置模型接入点和每张输出图的目录价")
    if request.get("watermark") is not False:
        raise ValueError("评测请求必须显式设置 watermark=false")
    if request.get("response_format") != "url":
        raise ValueError("此执行器使用 URL 响应并立即下载图片")
    if request.get("output_format") not in ("png", "jpeg") or not request.get("size"):
        raise ValueError("请指定支持的输出格式 png/jpeg 和统一的输出尺寸")
    for mode in ("direct", "bbox"):
        if not isinstance(request.get(f"{mode}_prompt"), str):
            raise ValueError(f"缺少 {mode}_prompt")
    for model, endpoint in request["models"].items():
        if not KEY.fullmatch(model) or not endpoint.startswith("ep-"):
            raise ValueError(f"模型键或接入点格式无效：{model}")
        price = config["prices_cny"].get(model)
        if not isinstance(price, (int, float)) or not math.isfinite(price) or price < 0:
            raise ValueError(f"缺少有效目录价：{model}")
    if set(config["prices_cny"]) != set(request["models"]):
        raise ValueError("价格模型列表与接入点列表不一致")
    if config.get("modes") != ["direct", "bbox"]:
        raise ValueError("固定评测矩阵要求 modes 为 [direct, bbox]")
    if not isinstance(config.get("date"), str) or not config["date"].strip():
        raise ValueError("请在配置中填写本轮日期")
    for sample in manifest:
        if not KEY.fullmatch(sample["id"]):
            raise ValueError(f"无效样本 ID：{sample['id']}")
        if sample["watermark_type"] not in request["labels"]:
            raise ValueError(f"缺少水印类型文字：{sample['watermark_type']}")
        if len(sample["watermark_bbox_px"]) != 4 or len(sample["watermark_bbox_norm"]) != 4:
            raise ValueError(f"无效区域坐标：{sample['id']}")
        try:
            for mode in ("direct", "bbox"):
                prompt_for(config, sample, mode)
        except (KeyError, ValueError, IndexError) as error:
            raise ValueError(f"样本 {sample['id']} 提示词无法填充：{error}") from error


def checked_input(root: Path, sample):
    path = (root / sample["marked"]).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError(f"输入图不存在或超出样本目录：{sample['id']}")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != sample["marked_sha256"]:
        raise ValueError(f"输入图 SHA-256 不符：{sample['id']}")
    return path


def checked_sample(root: Path, sample):
    marked = checked_input(root, sample)
    clean = (root / sample["clean"]).resolve()
    if not clean.is_relative_to(root.resolve()) or not clean.is_file():
        raise ValueError(f"干净参照图不存在或超出目录：{sample['id']}")
    with Image.open(clean) as image:
        clean_size = image.size
        image.verify()
    with Image.open(marked) as image:
        marked_size = image.size
        image.verify()
    if clean_size != marked_size:
        raise ValueError(f"干净图和标记图尺寸不同：{sample['id']}")
    x1, y1, x2, y2 = sample["watermark_bbox_px"]
    if not (0 <= x1 < x2 <= clean_size[0] and 0 <= y1 < y2 <= clean_size[1]):
        raise ValueError(f"像素区域越界：{sample['id']}")
    if any(not isinstance(value, int) or value < 0 or value > 999
           for value in sample["watermark_bbox_norm"]):
        raise ValueError(f"归一化区域越界：{sample['id']}")
    return marked


def prompt_for(config, sample, mode):
    label = config["request"]["labels"][sample["watermark_type"]]
    bbox = sample["watermark_bbox_norm"]
    template = config["request"][f"{mode}_prompt"]
    return template.format(label=label, x1=bbox[0], y1=bbox[1], x2=bbox[2], y2=bbox[3])


def masked_mae(left, right, mask):
    difference = ImageChops.difference(left, right)
    return statistics.mean(ImageStat.Stat(difference, mask).mean)


def measure(clean_path: Path, marked_path: Path, output_path: Path, bbox):
    with Image.open(clean_path) as raw:
        clean = ImageOps.exif_transpose(raw).convert("RGB")
    with Image.open(marked_path) as raw:
        marked = ImageOps.exif_transpose(raw).convert("RGB")
    with Image.open(output_path) as raw:
        size = list(raw.size)
        output_format = raw.format
        result = ImageOps.exif_transpose(raw).convert("RGB").resize(clean.size, Image.Resampling.LANCZOS)
    if marked.size != clean.size:
        raise ValueError("干净图与待处理图尺寸不同")
    x1, y1, x2, y2 = bbox
    width, height = clean.size
    target = Image.new("L", clean.size)
    ImageDraw.Draw(target).rectangle((x1, y1, x2 - 1, y2 - 1), fill=255)
    outside = Image.new("L", clean.size, 255)
    pad = 20
    ImageDraw.Draw(outside).rectangle((max(0, x1 - pad), max(0, y1 - pad),
                                      min(width - 1, x2 + pad - 1), min(height - 1, y2 + pad - 1)), fill=0)
    base = masked_mae(clean, marked, target)
    restored = masked_mae(clean, result, target)
    return {
        "base_target_mae": round(base, 3),
        "result_target_mae": round(restored, 3),
        "target_improvement": round(1 - restored / base, 3) if base else None,
        "outside_mae": round(masked_mae(clean, result, outside), 3),
        "output_size": size,
        "output_format": output_format,
    }


def safe_error(message):
    message = re.sub(r"https?://\S+", "[url]", message)
    message = re.sub(r"ark-[A-Za-z0-9_-]+", "[key]", message)
    return message[-700:]


def run_one(sample, model, mode, config, manifest_dir, output_dir, timeout):
    key = f"{sample['id']}-{model}-{mode}"
    folder = output_dir / "_ark_downloads" / key
    folder.mkdir(parents=True, exist_ok=True)
    marked = checked_input(manifest_dir, sample)
    text = prompt_for(config, sample, mode)
    request = config["request"]
    args = ["arkcli", "+gen", "--model", request["models"][model], "--modality", "image",
            "--input", f"@{marked}", "--size", request["size"],
            "--output-format", request["output_format"], "--response-format", "url",
            "--watermark=false", "--no-open", "--save-to", str(folder), "--format", "json", text]
    row = {"sample": sample["id"], "model": model, "mode": mode, "prompt": text}
    start = time.monotonic()
    try:
        result = command(args, timeout)
        row["latency_seconds"] = round(time.monotonic() - start, 2)
        if result.returncode:
            row.update(status="failed", error=safe_error(result.stderr))
            return row, any(word in result.stderr.lower() for word in STOP_WORDS)
        response = json.loads(result.stdout)
        local_path = response.get("local_path")
        if response.get("status") != "succeeded" or not local_path:
            row.update(status="unknown", error="Ark CLI 未返回唯一成功图片")
            return row, True
        source = Path(local_path).resolve()
        if not source.is_relative_to(folder.resolve()) or not source.is_file():
            row.update(status="unknown", error="Ark CLI 输出文件路径异常")
            return row, True
        extension = source.suffix.lower()
        if extension not in (".png", ".jpg", ".jpeg"):
            row.update(status="unknown", error="输出不是预期图片格式")
            return row, True
        relative = Path("outputs") / f"{key}{extension}"
        target = output_dir / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            raise ValueError(f"输出文件已存在：{target}")
        shutil.move(source, target)
        row.update(measure(manifest_dir / sample["clean"], marked, target,
                           sample["watermark_bbox_px"]))
        row.update(status="succeeded", output_path=str(relative))
        actual = row["output_format"].lower()
        expected = "jpeg" if request["output_format"] == "jpeg" else "png"
        if actual != expected:
            row.update(status="unknown", error="实际输出格式与统一请求规格不同")
            return row, True
        return row, False
    except subprocess.TimeoutExpired:
        row.update(status="unknown", latency_seconds=round(time.monotonic() - start, 2),
                   error="请求超时；服务端可能已生成，请人工核对后再决定是否重试")
        return row, True
    except Exception as error:
        row.update(status="unknown", latency_seconds=round(time.monotonic() - start, 2),
                   error=safe_error(str(error)))
        return row, True
    finally:
        if folder.exists() and not any(folder.iterdir()):
            folder.rmdir()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--max-cost-cny", required=True, type=float)
    parser.add_argument("--workers", type=int, default=1)
    parser.add_argument("--timeout", type=int, default=240)
    parser.add_argument("--dry-run", action="store_true", help="只核对样本与预算，不访问 Ark")
    args = parser.parse_args()
    try:
        manifest_path = args.manifest.resolve()
        config_path = args.config.resolve()
        output_dir = args.output_dir.resolve()
        manifest = read_json(manifest_path)
        config = read_json(config_path)
        validate(manifest, config)
        if (args.workers < 1 or args.workers > 4 or args.timeout < 10
                or not math.isfinite(args.max_cost_cny) or args.max_cost_cny < 0):
            raise ValueError("workers 须为 1–4，timeout 至少 10 秒，预算不能为负数")
        for sample in manifest:
            checked_sample(manifest_path.parent, sample)
        prices = config["prices_cny"]
        ceiling = len(manifest) * len(config["modes"]) * sum(prices.values())
        total = len(manifest) * len(config["modes"]) * len(config["request"]["models"])
        print(f"计划 {total} 次请求；按目录价上限 ¥{ceiling:.2f}；并发 {args.workers}", flush=True)
        if ceiling > args.max_cost_cny:
            raise ValueError(f"目录价上限超过 --max-cost-cny ¥{args.max_cost_cny:.2f}")
        if args.dry_run:
            return
        preflight(config)
        output_dir.mkdir(parents=True, exist_ok=True)
        config_hash = hashlib.sha256(config_path.read_bytes()).hexdigest()
        manifest_hash = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
        evaluation_file = output_dir / "evaluation.json"
        if evaluation_file.exists():
            evaluation = read_json(evaluation_file)
            if (evaluation.get("config_sha256"), evaluation.get("manifest_sha256")) != (config_hash, manifest_hash):
                raise ValueError("已有运行记录的配置或样本不同，请使用新的输出目录")
        else:
            evaluation = {"date": config["date"], "sample_set": str(manifest_path),
                          "request": config["request"], "prices_cny": prices,
                          "modes": config["modes"], "comparison_count": total,
                          "run_options": {"workers": args.workers, "timeout_seconds": args.timeout,
                                          "catalog_cost_ceiling_cny": round(ceiling, 2)},
                          "config_sha256": config_hash, "manifest_sha256": manifest_hash,
                          "results": []}
            write_json(evaluation_file, evaluation)
        recorded = {(row["sample"], row["model"], row["mode"]) for row in evaluation["results"]}
        tasks = [(sample, model, mode) for sample in manifest
                 for model in config["request"]["models"] for mode in config["modes"]
                 if (sample["id"], model, mode) not in recorded]
        print(f"剩余 {len(tasks)} 次；已有记录不会自动重试", flush=True)
        lock = threading.Lock()
        stopped = False
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            iterator = iter(tasks)
            pending = {}
            for _ in range(args.workers):
                if (task := next(iterator, None)) is not None:
                    pending[pool.submit(run_one, *task, config, manifest_path.parent,
                                        output_dir, args.timeout)] = task
            while pending:
                for future in concurrent.futures.as_completed(pending):
                    task = pending.pop(future)
                    row, fatal = future.result()
                    with lock:
                        evaluation["results"].append(row)
                        write_json(evaluation_file, evaluation)
                    print(f"{task[0]['id']} / {task[1]} / {task[2]}: {row['status']}", flush=True)
                    stopped = stopped or fatal
                    if not stopped and (next_task := next(iterator, None)) is not None:
                        pending[pool.submit(run_one, *next_task, config, manifest_path.parent,
                                            output_dir, args.timeout)] = next_task
                    break
        if stopped:
            raise ValueError("遇到鉴权、额度、限流或状态未知；已停止提交新请求，查看 evaluation.json")
        print(f"完成：{evaluation_file}")
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
