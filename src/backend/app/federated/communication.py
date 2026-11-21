"""
Deterministic Wire Serialization, Per-Round / Cumulative Communication Accounting,
and Efficiency Analysis for TrafficFlow AI (PS-003 Prompt 4).

Accounting Conventions:
- Client-to-server UPLOAD payload is measured strictly from serialized binary wire bytes
  constructed from actual model weights, bias, sparse indices, and quantization metadata
  using a fixed 44-byte framing envelope (`TFL1` protocol header).
- Server-to-client DOWNLOAD (global broadcast) is simulated/modelled as full-precision
  dense global model broadcast (`(n_params + 1) * 4 + 44` bytes per client per round)
  and is explicitly separated from upload-only totals as `download_bytes_modeled`.
- Serialized payload size reflects application-layer model payloads and does NOT include
  physical NIC/TCP/IP transport headers or live WAN timing measurements.
"""

from __future__ import annotations

import struct
import zlib
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

WIRE_MAGIC = b"TFL1"
WIRE_HEADER_BYTES = 44
BIAS_SCALAR_BYTES = 4
QUANT_METADATA_BYTES = 8  # scale (float32, 4B) + x_min (float32, 4B)
CENTRALIZED_RAW_ROW_BYTES = 48  # 8B ts + 4B sensor + 4B flow + 4B speed + 4B occ + 24B framing
BYTES_PER_MB = 1024.0 * 1024.0

SUPPORTED_COMPRESSION_METHODS: Tuple[str, ...] = (
    "full_precision",
    "top_k",
    "int8",
    "top_k_int8",
)

METHOD_CODES: Dict[str, int] = {
    "full_precision": 0,
    "top_k": 1,
    "int8": 2,
    "top_k_int8": 3,
}


@dataclass(frozen=True)
class CompressionConfig:
    method: str
    apply_compression: bool
    top_k_retention_pct: float
    int8_quantization: bool
    description: str


@dataclass(frozen=True)
class SerializedUpdatePacket:
    packet_bytes: bytes
    reconstructed_weights: np.ndarray
    reconstructed_bias: float
    compression_method: str
    parameter_count: int
    retained_weights_count: int
    header_bytes: int
    bias_bytes: int
    values_bytes: int
    index_bytes: int
    index_width_bytes: int
    quant_metadata_bytes: int
    total_bytes: int
    uncompressed_bytes: int


def resolve_compression_config(
    apply_compression: bool = False,
    top_k_retention_pct: float = 100.0,
    int8_quantization: bool = False,
    compression_method: Optional[str] = None,
) -> CompressionConfig:
    """Validate and resolve compression parameters deterministically into one of four strategies."""
    if not isinstance(top_k_retention_pct, (int, float)) or isinstance(top_k_retention_pct, bool):
        raise ValueError(f"top_k_retention_pct must be numeric; got {top_k_retention_pct!r}.")
    if top_k_retention_pct <= 0.0 or top_k_retention_pct > 100.0:
        raise ValueError(
            f"top_k_retention_pct must be in (0, 100]; got {top_k_retention_pct}."
        )

    if compression_method is not None:
        if compression_method not in SUPPORTED_COMPRESSION_METHODS:
            raise ValueError(
                f"Unsupported compression_method '{compression_method}'. "
                f"Supported: {list(SUPPORTED_COMPRESSION_METHODS)}."
            )
        if compression_method == "full_precision":
            return CompressionConfig(
                method="full_precision",
                apply_compression=False,
                top_k_retention_pct=100.0,
                int8_quantization=False,
                description="Full Precision FP32 Dense Update",
            )
        if compression_method == "int8":
            return CompressionConfig(
                method="int8",
                apply_compression=True,
                top_k_retention_pct=100.0,
                int8_quantization=True,
                description="Dense Uniform INT8 Quantization (with FP32 scale & min metadata)",
            )
        # top_k or top_k_int8
        effective_pct = float(top_k_retention_pct) if top_k_retention_pct < 100.0 else 50.0
        use_int8 = compression_method == "top_k_int8"
        return CompressionConfig(
            method=compression_method,
            apply_compression=True,
            top_k_retention_pct=effective_pct,
            int8_quantization=use_int8,
            description=(
                f"Top-K ({effective_pct:g}%) Sparsification + Uniform INT8 Quantization"
                if use_int8
                else f"Top-K ({effective_pct:g}%) Magnitude Sparsification (FP32 Retained Values + Sparse Indices)"
            ),
        )

    if not apply_compression or (top_k_retention_pct >= 100.0 and not int8_quantization):
        return CompressionConfig(
            method="full_precision",
            apply_compression=False,
            top_k_retention_pct=100.0,
            int8_quantization=False,
            description="Full Precision FP32 Dense Update",
        )
    if top_k_retention_pct >= 100.0 and int8_quantization:
        return CompressionConfig(
            method="int8",
            apply_compression=True,
            top_k_retention_pct=100.0,
            int8_quantization=True,
            description="Dense Uniform INT8 Quantization (with FP32 scale & min metadata)",
        )
    if int8_quantization:
        return CompressionConfig(
            method="top_k_int8",
            apply_compression=True,
            top_k_retention_pct=float(top_k_retention_pct),
            int8_quantization=True,
            description=f"Top-K ({top_k_retention_pct:g}%) Sparsification + Uniform INT8 Quantization",
        )
    return CompressionConfig(
        method="top_k",
        apply_compression=True,
        top_k_retention_pct=float(top_k_retention_pct),
        int8_quantization=False,
        description=f"Top-K ({top_k_retention_pct:g}%) Magnitude Sparsification (FP32 Retained Values + Sparse Indices)",
    )


def _index_dtype_and_width(n_params: int) -> Tuple[np.dtype, int]:
    if n_params <= 255:
        return np.dtype("<u1"), 1
    if n_params <= 65535:
        return np.dtype("<u2"), 2
    return np.dtype("<u4"), 4


def _pack_wire_packet(
    method: str,
    idx_width: int,
    round_num: int,
    client_id: str,
    n_params: int,
    k_retained: int,
    bias_val: float,
    body_bytes: bytes,
) -> bytes:
    """
    Assemble the exact 44-byte TFL1 header + body bytes:
    - 4B magic ('TFL1')
    - 1B method_code (uint8)
    - 1B index_width (uint8: 0=dense, 1=uint8, 2=uint16, 4=uint32)
    - 2B round_num (uint16)
    - 16B client_slot (utf-8 zero-padded)
    - 4B n_params (uint32)
    - 4B k_retained (uint32)
    - 4B bias_echo_flags (uint32, reserved/version=1)
    - 4B crc32 (uint32 over body+bias)
    - 4B body_len (uint32)
    Header total = 44 bytes; followed immediately by 4B bias float32 + tensor body bytes.
    """
    client_slot = client_id.encode("utf-8")[:16].ljust(16, b"\x00")
    bias_bytes = struct.pack("<f", float(bias_val))
    full_body = bias_bytes + body_bytes
    crc = zlib.crc32(full_body) & 0xFFFFFFFF
    header = struct.pack(
        "<4sBBH16sIIIII",
        WIRE_MAGIC,
        METHOD_CODES[method],
        idx_width,
        int(max(0, min(65535, round_num))),
        client_slot,
        int(n_params),
        int(k_retained),
        1,  # protocol flags
        crc,
        len(full_body),
    )
    assert len(header) == WIRE_HEADER_BYTES
    return header + full_body


def serialize_model_update(
    weights: np.ndarray,
    bias: float,
    config: CompressionConfig,
    round_num: int = 1,
    client_id: str = "client",
) -> SerializedUpdatePacket:
    """
    Serialize client/server model parameters into an actual deterministic binary wire packet,
    measuring exact byte counts including values, sparse indices, INT8 metadata, bias, and framing.
    """
    w = np.asarray(weights, dtype=np.float64)
    n_params = int(w.shape[0])
    if n_params <= 0:
        raise ValueError("Cannot serialize empty model weights vector (n_params <= 0).")

    uncompressed_bytes = WIRE_HEADER_BYTES + BIAS_SCALAR_BYTES + n_params * 4
    reconstructed_bias = float(bias)

    if config.method == "full_precision":
        values_buf = w.astype("<f4").tobytes()
        packet = _pack_wire_packet(
            method="full_precision",
            idx_width=0,
            round_num=round_num,
            client_id=client_id,
            n_params=n_params,
            k_retained=n_params,
            bias_val=reconstructed_bias,
            body_bytes=values_buf,
        )
        return SerializedUpdatePacket(
            packet_bytes=packet,
            reconstructed_weights=w.copy(),
            reconstructed_bias=reconstructed_bias,
            compression_method="full_precision",
            parameter_count=n_params + 1,
            retained_weights_count=n_params,
            header_bytes=WIRE_HEADER_BYTES,
            bias_bytes=BIAS_SCALAR_BYTES,
            values_bytes=len(values_buf),
            index_bytes=0,
            index_width_bytes=0,
            quant_metadata_bytes=0,
            total_bytes=len(packet),
            uncompressed_bytes=uncompressed_bytes,
        )

    if config.method == "int8":
        w_min = float(np.min(w))
        w_max = float(np.max(w))
        scale = max(1e-7, (w_max - w_min) / 255.0)
        q_vals = np.clip(np.round((w - w_min) / scale), 0, 255).astype(np.uint8)
        quant_meta = struct.pack("<ff", float(scale), float(w_min))
        values_buf = q_vals.tobytes()
        body = quant_meta + values_buf

        # Match serialized FP32 scale & min reconstruction cleanly
        s_f32, min_f32 = struct.unpack("<ff", quant_meta)
        recon_w = q_vals.astype(w.dtype) * float(s_f32) + float(min_f32)

        packet = _pack_wire_packet(
            method="int8",
            idx_width=0,
            round_num=round_num,
            client_id=client_id,
            n_params=n_params,
            k_retained=n_params,
            bias_val=reconstructed_bias,
            body_bytes=body,
        )
        return SerializedUpdatePacket(
            packet_bytes=packet,
            reconstructed_weights=recon_w,
            reconstructed_bias=reconstructed_bias,
            compression_method="int8",
            parameter_count=n_params + 1,
            retained_weights_count=n_params,
            header_bytes=WIRE_HEADER_BYTES,
            bias_bytes=BIAS_SCALAR_BYTES,
            values_bytes=len(values_buf),
            index_bytes=0,
            index_width_bytes=0,
            quant_metadata_bytes=len(quant_meta),
            total_bytes=len(packet),
            uncompressed_bytes=uncompressed_bytes,
        )

    # Sparse modes: top_k or top_k_int8
    retention = max(0.05, min(1.0, config.top_k_retention_pct / 100.0))
    k = max(1, min(n_params, int(round(n_params * retention))))
    top_idx = np.sort(np.argsort(np.abs(w))[-k:])
    retained_vals = w[top_idx]
    idx_dtype, idx_width = _index_dtype_and_width(n_params)
    idx_buf = top_idx.astype(idx_dtype).tobytes()

    if config.method == "top_k":
        vals_buf = retained_vals.astype("<f4").tobytes()
        body = idx_buf + vals_buf
        recon_w = np.zeros_like(w)
        recon_w[top_idx] = np.frombuffer(vals_buf, dtype="<f4").astype(w.dtype)

        packet = _pack_wire_packet(
            method="top_k",
            idx_width=idx_width,
            round_num=round_num,
            client_id=client_id,
            n_params=n_params,
            k_retained=k,
            bias_val=reconstructed_bias,
            body_bytes=body,
        )
        return SerializedUpdatePacket(
            packet_bytes=packet,
            reconstructed_weights=recon_w,
            reconstructed_bias=reconstructed_bias,
            compression_method="top_k",
            parameter_count=n_params + 1,
            retained_weights_count=k,
            header_bytes=WIRE_HEADER_BYTES,
            bias_bytes=BIAS_SCALAR_BYTES,
            values_bytes=len(vals_buf),
            index_bytes=len(idx_buf),
            index_width_bytes=idx_width,
            quant_metadata_bytes=0,
            total_bytes=len(packet),
            uncompressed_bytes=uncompressed_bytes,
        )

    # top_k_int8
    v_min = float(np.min(retained_vals))
    v_max = float(np.max(retained_vals))
    scale = max(1e-7, (v_max - v_min) / 255.0)
    q_vals = np.clip(np.round((retained_vals - v_min) / scale), 0, 255).astype(np.uint8)
    quant_meta = struct.pack("<ff", float(scale), float(v_min))
    vals_buf = q_vals.tobytes()
    body = quant_meta + idx_buf + vals_buf

    s_f32, min_f32 = struct.unpack("<ff", quant_meta)
    recon_w = np.zeros_like(w)
    recon_w[top_idx] = q_vals.astype(w.dtype) * float(s_f32) + float(min_f32)

    packet = _pack_wire_packet(
        method="top_k_int8",
        idx_width=idx_width,
        round_num=round_num,
        client_id=client_id,
        n_params=n_params,
        k_retained=k,
        bias_val=reconstructed_bias,
        body_bytes=body,
    )
    return SerializedUpdatePacket(
        packet_bytes=packet,
        reconstructed_weights=recon_w,
        reconstructed_bias=reconstructed_bias,
        compression_method="top_k_int8",
        parameter_count=n_params + 1,
        retained_weights_count=k,
        header_bytes=WIRE_HEADER_BYTES,
        bias_bytes=BIAS_SCALAR_BYTES,
        values_bytes=len(vals_buf),
        index_bytes=len(idx_buf),
        index_width_bytes=idx_width,
        quant_metadata_bytes=len(quant_meta),
        total_bytes=len(packet),
        uncompressed_bytes=uncompressed_bytes,
    )


def deserialize_model_update(packet_bytes: bytes) -> Tuple[np.ndarray, float, Dict[str, Any]]:
    """Decode and verify CRC32 checksum + wire framing for a serialized client/server packet."""
    if len(packet_bytes) < WIRE_HEADER_BYTES + BIAS_SCALAR_BYTES:
        raise ValueError(f"Corrupted update packet: length {len(packet_bytes)} < minimum envelope size.")

    magic, method_code, idx_width, round_num, _, n_params, k_retained, _, crc, body_len = struct.unpack(
        "<4sBBH16sIIIII", packet_bytes[:WIRE_HEADER_BYTES]
    )
    if magic != WIRE_MAGIC:
        raise ValueError(f"Invalid packet magic {magic!r}; expected {WIRE_MAGIC!r}.")

    payload = packet_bytes[WIRE_HEADER_BYTES:]
    if len(payload) != body_len or (zlib.crc32(payload) & 0xFFFFFFFF) != crc:
        raise ValueError("Update packet failed length or CRC32 integrity verification.")

    bias_val = float(struct.unpack("<f", payload[:BIAS_SCALAR_BYTES])[0])
    body = payload[BIAS_SCALAR_BYTES:]
    code_to_method = {v: k for k, v in METHOD_CODES.items()}
    method = code_to_method.get(method_code)
    if method is None:
        raise ValueError(f"Unknown wire compression code: {method_code}.")

    weights = np.zeros(n_params, dtype=np.float64)
    if method == "full_precision":
        weights = np.frombuffer(body, dtype="<f4").astype(np.float64)
    elif method == "int8":
        s_f32, min_f32 = struct.unpack("<ff", body[:QUANT_METADATA_BYTES])
        q_vals = np.frombuffer(body[QUANT_METADATA_BYTES:], dtype=np.uint8)
        weights = q_vals.astype(np.float64) * float(s_f32) + float(min_f32)
    else:
        idx_dtype = np.dtype(f"<u{idx_width}")
        offset = QUANT_METADATA_BYTES if method == "top_k_int8" else 0
        idx_bytes_len = k_retained * idx_width
        idx_arr = np.frombuffer(body[offset : offset + idx_bytes_len], dtype=idx_dtype)
        val_bytes = body[offset + idx_bytes_len :]
        if method == "top_k":
            vals = np.frombuffer(val_bytes, dtype="<f4").astype(np.float64)
        else:
            s_f32, min_f32 = struct.unpack("<ff", body[:QUANT_METADATA_BYTES])
            q_vals = np.frombuffer(val_bytes, dtype=np.uint8)
            vals = q_vals.astype(np.float64) * float(s_f32) + float(min_f32)
        weights[idx_arr] = vals

    return weights, bias_val, {
        "compression_method": method,
        "round": round_num,
        "n_params": n_params,
        "k_retained": k_retained,
        "total_bytes": len(packet_bytes),
    }


def safe_ratio(numerator: float, denominator: float) -> Optional[float]:
    """Return finite ratio numerator/denominator or None cleanly when denominator is <= 0."""
    if denominator <= 0.0:
        return None
    val = float(numerator) / float(denominator)
    return val if np.isfinite(val) else None


def safe_efficiency_per_mb(
    improvement_vs_initial: float,
    transmitted_bytes: int,
) -> Tuple[Optional[float], str]:
    """
    Compute error improvement per transmitted MB safely.
    - Returns (None, 'undefined_zero_bytes') when transmitted_bytes <= 0.
    - Returns (None, 'non_improving') when improvement_vs_initial <= 0.
    - Returns (improvement / mb, 'valid') otherwise.
    Never returns inf, NaN, or fabricated positive efficiency.
    """
    if transmitted_bytes <= 0:
        return None, "undefined_zero_bytes"
    mb = transmitted_bytes / BYTES_PER_MB
    if mb <= 0.0 or not np.isfinite(mb):
        return None, "undefined_zero_bytes"
    if improvement_vs_initial <= 0.0 or not np.isfinite(improvement_vs_initial):
        return None, "non_improving"
    eff = float(improvement_vs_initial) / mb
    if not np.isfinite(eff):
        return None, "non_improving"
    return eff, "valid"


def build_round_communication_record(
    round_num: int,
    participating_clients: int,
    client_packets: List[SerializedUpdatePacket],
    broadcast_packets: List[SerializedUpdatePacket],
    prev_cumulative_upload: int,
    prev_cumulative_download: int,
    initial_mae: float,
    initial_rmse: float,
    round_mae_raw: float,
    round_rmse_raw: float,
    weights_norm: float,
) -> Dict[str, Any]:
    """Build complete per-round and cumulative communication + convergence record."""
    sample_pkt = client_packets[0]
    uncompressed_per_client = sample_pkt.uncompressed_bytes
    actual_per_client = sample_pkt.total_bytes
    round_upload = sum(p.total_bytes for p in client_packets)
    round_download_modeled = sum(p.total_bytes for p in broadcast_packets)
    round_total = round_upload + round_download_modeled

    uncompressed_round_upload = uncompressed_per_client * participating_clients
    uncompressed_round_total = uncompressed_round_upload + sum(
        p.uncompressed_bytes for p in broadcast_packets
    )

    cum_upload = prev_cumulative_upload + round_upload
    cum_download_modeled = prev_cumulative_download + round_download_modeled
    cum_total = cum_upload + cum_download_modeled

    upload_ratio = safe_ratio(uncompressed_round_upload, round_upload)
    upload_reduction_pct = (
        ((uncompressed_round_upload - round_upload) / uncompressed_round_upload) * 100.0
        if uncompressed_round_upload > 0
        else None
    )
    bidir_ratio = safe_ratio(uncompressed_round_total, round_total)
    bidir_reduction_pct = (
        ((uncompressed_round_total - round_total) / uncompressed_round_total) * 100.0
        if uncompressed_round_total > 0
        else None
    )

    mae_imp = float(initial_mae - round_mae_raw)
    rmse_imp = float(initial_rmse - round_rmse_raw)
    mae_per_mb_up, mae_eff_status = safe_efficiency_per_mb(mae_imp, cum_upload)
    rmse_per_mb_up, rmse_eff_status = safe_efficiency_per_mb(rmse_imp, cum_upload)
    mae_per_mb_total, _ = safe_efficiency_per_mb(mae_imp, cum_total)
    rmse_per_mb_total, _ = safe_efficiency_per_mb(rmse_imp, cum_total)

    return {
        "round": round_num,
        "test_mae": round(round_mae_raw, 2),
        "test_rmse": round(round_rmse_raw, 2),
        "test_mae_exact": round_mae_raw,
        "test_rmse_exact": round_rmse_raw,
        "weights_norm": round(weights_norm, 4),
        "participating_clients": participating_clients,
        "model_parameter_count": sample_pkt.parameter_count,
        "retained_weights_count": sample_pkt.retained_weights_count,
        "compression_method": sample_pkt.compression_method,
        "uncompressed_update_bytes_per_client": uncompressed_per_client,
        "actual_upload_bytes_per_client": actual_per_client,
        "upload_header_bytes_per_client": sample_pkt.header_bytes,
        "upload_bias_bytes_per_client": sample_pkt.bias_bytes,
        "upload_values_bytes_per_client": sample_pkt.values_bytes,
        "upload_index_bytes_per_client": sample_pkt.index_bytes,
        "upload_quant_metadata_bytes_per_client": sample_pkt.quant_metadata_bytes,
        "uncompressed_round_upload_bytes": uncompressed_round_upload,
        "upload_bytes": round_upload,
        "download_bytes_modeled": round_download_modeled,
        "total_round_bytes": round_total,
        "cumulative_upload_bytes": cum_upload,
        "cumulative_download_bytes_modeled": cum_download_modeled,
        "cumulative_total_bytes": cum_total,
        "cumulative_upload_mb": cum_upload / BYTES_PER_MB,
        "cumulative_download_mb_modeled": cum_download_modeled / BYTES_PER_MB,
        "cumulative_total_mb": cum_total / BYTES_PER_MB,
        "upload_compression_ratio": upload_ratio,
        "upload_reduction_pct": upload_reduction_pct,
        "bidirectional_compression_ratio": bidir_ratio,
        "bidirectional_reduction_pct": bidir_reduction_pct,
        "mae_improvement_vs_initial": mae_imp,
        "rmse_improvement_vs_initial": rmse_imp,
        "mae_improvement_per_mb_upload": mae_per_mb_up,
        "rmse_improvement_per_mb_upload": rmse_per_mb_up,
        "mae_improvement_per_mb_total": mae_per_mb_total,
        "rmse_improvement_per_mb_total": rmse_per_mb_total,
        "mae_efficiency_status": mae_eff_status,
        "rmse_efficiency_status": rmse_eff_status,
    }


def build_communication_summary(
    config: CompressionConfig,
    round_records: List[Dict[str, Any]],
    participating_clients: int,
    parameter_count: int,
    initial_mae: float,
    initial_rmse: float,
    final_mae: float,
    final_rmse: float,
    central_raw_upload_bytes: int,
) -> Dict[str, Any]:
    """Compile run-level upload, modeled download, compression ratio, and efficiency metrics."""
    last = round_records[-1]
    total_upload = int(last["cumulative_upload_bytes"])
    total_download_modeled = int(last["cumulative_download_bytes_modeled"])
    total_bidir = int(last["cumulative_total_bytes"])
    uncompressed_upload_total = int(last["uncompressed_round_upload_bytes"]) * len(round_records)
    uncompressed_bidir_total = uncompressed_upload_total + total_download_modeled

    mae_imp = float(initial_mae - final_mae)
    rmse_imp = float(initial_rmse - final_rmse)
    mae_per_mb_up, mae_status = safe_efficiency_per_mb(mae_imp, total_upload)
    rmse_per_mb_up, rmse_status = safe_efficiency_per_mb(rmse_imp, total_upload)
    mae_per_mb_total, _ = safe_efficiency_per_mb(mae_imp, total_bidir)
    rmse_per_mb_total, _ = safe_efficiency_per_mb(rmse_imp, total_bidir)

    upload_ratio = safe_ratio(uncompressed_upload_total, total_upload)
    upload_red_pct = (
        ((uncompressed_upload_total - total_upload) / uncompressed_upload_total) * 100.0
        if uncompressed_upload_total > 0
        else None
    )
    bidir_ratio = safe_ratio(uncompressed_bidir_total, total_bidir)
    bidir_red_pct = (
        ((uncompressed_bidir_total - total_bidir) / uncompressed_bidir_total) * 100.0
        if uncompressed_bidir_total > 0
        else None
    )
    central_vs_fed_ratio = safe_ratio(central_raw_upload_bytes, total_bidir)
    central_vs_fed_upload_ratio = safe_ratio(central_raw_upload_bytes, total_upload)

    return {
        "accounting_convention": (
            "Measured application-layer TFL1 binary serialized update payloads (`struct` + numpy `.tobytes()`) "
            "for client-to-server UPLOAD; simulated/modelled full-precision dense global model broadcast for "
            "server-to-client DOWNLOAD (`download_bytes_modeled`). Upload-only and bidirectional totals are "
            "tracked and reported separately."
        ),
        "compression_method": config.method,
        "compression_description": config.description,
        "top_k_retention_pct": config.top_k_retention_pct,
        "int8_quantization": config.int8_quantization,
        "rounds_executed": len(round_records),
        "participating_clients": participating_clients,
        "model_parameter_count": parameter_count,
        "retained_weights_per_client": last["retained_weights_count"],
        "uncompressed_update_bytes_per_client": last["uncompressed_update_bytes_per_client"],
        "actual_upload_bytes_per_client": last["actual_upload_bytes_per_client"],
        "payload_breakdown_per_client": {
            "header_bytes": last["upload_header_bytes_per_client"],
            "bias_bytes": last["upload_bias_bytes_per_client"],
            "values_bytes": last["upload_values_bytes_per_client"],
            "index_bytes": last["upload_index_bytes_per_client"],
            "quant_metadata_bytes": last["upload_quant_metadata_bytes_per_client"],
            "total_bytes": last["actual_upload_bytes_per_client"],
        },
        "total_upload_bytes": total_upload,
        "total_download_bytes_modeled": total_download_modeled,
        "total_bidirectional_bytes": total_bidir,
        "uncompressed_upload_bytes_baseline": uncompressed_upload_total,
        "uncompressed_bidirectional_bytes_baseline": uncompressed_bidir_total,
        "upload_compression_ratio": upload_ratio,
        "upload_reduction_pct": upload_red_pct,
        "bidirectional_compression_ratio": bidir_ratio,
        "bidirectional_reduction_pct": bidir_red_pct,
        "vs_centralized_raw_upload_bytes": central_raw_upload_bytes,
        "vs_centralized_upload_only_reduction_factor": central_vs_fed_upload_ratio,
        "vs_centralized_bidirectional_reduction_factor": central_vs_fed_ratio,
        "initial_model_mae": initial_mae,
        "initial_model_rmse": initial_rmse,
        "final_model_mae": final_mae,
        "final_model_rmse": final_rmse,
        "mae_improvement_vs_initial": mae_imp,
        "rmse_improvement_vs_initial": rmse_imp,
        "mae_improvement_per_mb_upload": mae_per_mb_up,
        "rmse_improvement_per_mb_upload": rmse_per_mb_up,
        "mae_improvement_per_mb_total": mae_per_mb_total,
        "rmse_improvement_per_mb_total": rmse_per_mb_total,
        "mae_efficiency_status": mae_status,
        "rmse_efficiency_status": rmse_status,
        "efficiency_baseline_note": (
            "Accuracy improvements measured against initial pre-training global weights (Round 0) "
            "evaluated on identical held-out test set. Efficiency reported as None when bytes <= 0 "
            "or no positive accuracy improvement was achieved."
        ),
    }
